import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNavigate, useLocation } from "react-router-dom"; // Added useLocation
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  itemType: string;
  pluginName?: string;
  features?: string[];
  isPopular?: boolean;
  trialInfo?: string;
  useCase?: string;
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const { state } = useLocation(); // Get navigation state
  const { isSignedIn } = useAuth();
  const [selectedBase, setSelectedBase] = useState<Item | null>(null);
  const [selectedPlugins, setSelectedPlugins] = useState<Item[]>([]);

  const itemsQuery = useQuery({
    queryKey: ["subscriptionItems"],
    queryFn: async () => {
      const data = await apiClient.getItems();
      return data.items;
    },
  });

  // Show trial expired message if navigated from home
  useEffect(() => {
    if (state?.trialExpired) {
      toast({
        title: "Trial Expired",
        description: "Your trial has ended. Please select a subscription plan to continue using agentVooc.",
      });
    }
  }, [state]);

  const handleBaseSelect = (item: Item) => {
    setSelectedBase(item);
  };

  const handlePluginToggle = (item: Item) => {
    setSelectedPlugins((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  const handleStartSubscription = () => {
    if (!selectedBase) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a base plan.",
        className: "text-agentvooc-error-foreground",
      });
      return;
    }
    const items = [selectedBase, ...selectedPlugins];
    if (isSignedIn) {
      navigate("/payment", { state: { selectedItems: items } });
    } else {
      navigate("/auth", {
        state: { defaultIsSignUp: true, selectedItems: items },
      });
    }
  };

  if (itemsQuery.isLoading) {
    return (
      <section
        className="text-agentvooc-secondary flex items-center justify-center p-4"
        aria-label="Loading Subscriptions"
      >
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-agentvooc-accent" />
        <p>Loading subscriptions...</p>
      </section>
    );
  }

  if (itemsQuery.error) {
    return (
      <section className="p-4" aria-label="Error">
        <p>Error loading subscriptions: {(itemsQuery.error as Error).message}</p>
      </section>
    );
  }

  const baseItems =
    itemsQuery.data?.filter((item: Item) =>
      ["base", "subscription"].includes(item.itemType)
    ) || [];
  const pluginItems =
    itemsQuery.data?.filter((item: Item) => item.itemType === "plugin") || [];

  return (
    <section className="py-16 px-4 bg-agentvooc-secondary-bg animate-fade-in" aria-label="Subscriptions">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-8 text-center">
          {state?.trialExpired ? "Subscribe to Continue" : "Choose Your Plan"}
        </h2>
        {state?.trialExpired && (
          <p className="text-center text-agentvooc-accent mb-8">
            Your trial has ended. Select a plan below to unlock full access to agentVooc.
          </p>
        )}
        <div>
          <h3 className="text-2xl font-semibold mb-4">Base Plans (Select One)</h3>
          {baseItems.length === 0 ? (
            <p className="text-center">No base plans available at this time.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {baseItems.map((item: Item) => (
                <Card
                  key={item.id}
                  className={`flex flex-col transition-all relative hover:shadow-lg hover:scale-105 cursor-pointer ${
                    selectedBase?.id === item.id ? "border-agentvooc-accent shadow-agentvooc-glow" : ""
                  }`}
                  onClick={() => handleBaseSelect(item)}
                  aria-labelledby={`base-plan-${item.id}-title`}
                >
                  {item.isPopular && (
                    <div className="absolute top-0 right-0 bg-agentvooc-accent text-agentvooc-primary-bg px-3 py-1 rounded-bl-lg text-sm font-semibold">
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle id={`base-plan-${item.id}-title`}>
                      <h4>{item.name}</h4>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p>{item.description}</p>
                    <h5 className="text-lg font-semibold">${(item.price / 100).toFixed(2)}/month</h5>
                    {item.useCase && (
                      <h6 className="text-sm mt-2 italic">{item.useCase}</h6>
                    )}
                    {item.features && item.features.length > 0 && (
                      <ul className="mt-4 space-y-2 custom-bullets">
                        {item.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-sm">
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
                      <p className="text-sm text-agentvooc-accent mt-4">{item.trialInfo}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        {selectedBase && (
          <div>
            <h3 className="text-2xl font-semibold mb-4">Optional Plugins</h3>
            {pluginItems.length === 0 ? (
              <p className="text-center">No plugins available at this time.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {pluginItems.map((item: Item) => (
                  <Card
                    key={item.id}
                    className={`flex flex-col cursor-pointer ${
                      selectedPlugins.some((i) => i.id === item.id)
                        ? "border-agentvooc-accent shadow-agentvooc-glow"
                        : ""
                    }`}
                    onClick={() => handlePluginToggle(item)}
                    aria-labelledby={`plugin-${item.id}-title`}
                  >
                    <CardHeader>
                      <CardTitle id={`plugin-${item.id}-title`}>
                        <h4>{item.name}</h4>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="mb-4">{item.description}</p>
                      <h5 className="text-lg font-semibold">${(item.price / 100).toFixed(2)}/month</h5>
                      {item.useCase && (
                        <h6 className="text-sm mt-2 italic">{item.useCase}</h6>
                      )}
                      {item.features && item.features.length > 0 && (
                        <ul className="mt-4 space-y-2 custom-bullets">
                          {item.features.map((feature, index) => (
                            <li key={index} className="flex items-center text-sm">
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
                        <p className="text-sm text-agentvooc-accent mt-4">{item.trialInfo}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="text-center">
          <Button
            variant="default"
            size="lg"
            className="animate-glow-pulse"
            onClick={handleStartSubscription}
            disabled={!selectedBase}
            aria-label="Proceed to checkout"
          >
            Proceed to Checkout
          </Button>
        </div>
      </div>
    </section>
  );
}