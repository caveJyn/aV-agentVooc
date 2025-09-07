import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { doesSessionExist } from "supertokens-web-js/recipe/session";
import { useEffect, useState } from "react";

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  itemType: string;
  features?: string[]; // List of key features
  isPopular?: boolean; // Flag for "Most Popular" badge
  trialInfo?: string; // e.g., "7-day free trial"
  useCase?: string; // e.g., "Best for individuals"
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const sessionExists = await doesSessionExist();
        setIsAuthenticated(sessionExists);
      } catch (error) {
        console.error("[SUBSCRIPTIONS] Error checking session:", error);
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  const itemsQuery = useQuery({
    queryKey: ["subscriptionItems"],
    queryFn: async () => {
      const data = await apiClient.getItems({ itemType: "subscription" });
      console.log("[SUBSCRIPTIONS] Fetched subscription items:", data.items);
      return data.items;
    },
  });

  const handleStartSubscription = (item: Item) => {
    if (isAuthenticated) {
      navigate("/payment", { state: { selectedItem: item } });
    } else {
      navigate("/auth/email", {
        state: { defaultIsSignUp: true, selectedItem: item },
      });
    }
  };

  if (isAuthenticated === null || itemsQuery.isLoading) {
    return (
      <div className="text-agentvooc-secondary flex items-center justify-center p-4">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-agentvooc-accent" />
        Loading subscriptions...
      </div>
    );
  }

  if (itemsQuery.error) {
    return (
      <div className="p-4 text-agentvooc-secondary">
        Error loading subscriptions: {(itemsQuery.error as Error).message}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h2 className="text-4xl font-bold mb-8 text-center text-agentvooc-primary">
        Choose Your Plan
      </h2>
      {itemsQuery.data?.length === 0 ? (
        <p className="text-center text-agentvooc-secondary">
          No subscription plans available at this time.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {itemsQuery.data?.map((item: Item) => (
            <Card
              key={item.id}
              className="flex flex-col bg-agentvooc-secondary-accent border-agentvooc-accent/10 transition-all relative hover:shadow-lg"
              aria-labelledby={`plan-${item.id}-title`}
            >
              {item.isPopular && (
                <div className="absolute top-0 right-0 bg-agentvooc-accent text-agentvooc-primary-bg px-3 py-1 rounded-bl-lg text-sm font-semibold">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle
                  id={`plan-${item.id}-title`}
                  className="text-xl text-agentvooc-primary"
                >
                  {item.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-agentvooc-secondary mb-4">{item.description}</p>
                <p className="text-lg font-semibold text-agentvooc-primary">
                  ${(item.price / 100).toFixed(2)}/month
                </p>
                {item.useCase && (
                  <p className="text-sm text-agentvooc-secondary mt-2 italic">
                    {item.useCase}
                  </p>
                )}
                {item.features && item.features.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {item.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center text-agentvooc-secondary text-sm"
                      >
                        <svg
                          className="w-4 h-4 mr-2 text-agentvooc-accent"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
                {item.trialInfo && (
                  <p className="text-sm text-agentvooc-accent mt-4">
                    {item.trialInfo}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full"
                  onClick={() => handleStartSubscription(item)}
                  aria-label={`Start ${item.name} subscription`}
                >
                  {item.isPopular
                    ? "Unlock Premium"
                    : item.name.includes("Pro")
                    ? "Unlock Pro"
                    : "Get Started"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}