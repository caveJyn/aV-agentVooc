import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cog, Plus, Trash2, Loader2, Book } from "lucide-react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { NavLink } from "react-router-dom";
import type { UUID } from "@elizaos/core";
import { formatAgentName } from "@/lib/utils";
import { useEffect, useState } from "react";
import { doesSessionExist } from "supertokens-web-js/recipe/session";
import PaymentSection from "@/components/payment-selection";
import CreateCharacter from "@/components/create-character";
import { useSubscriptionStatus } from "@/hooks/stripe-webhook";
import { Item } from "@/types/index.ts";
import { toast } from "@/hooks/use-toast";

interface User {
  userId: string;
  userType: string;
  email: string;
  name: string;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStatus?: string;
}

interface Agent {
  id: UUID;
  name: string;
  username?: string;
  bio?: string[];
  clients?: string[];
}

export default function Home() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const queryClient = useQueryClient();

  const { data: subscriptionData } = useSubscriptionStatus(user?.userId);

  useEffect(() => {
    async function initialize() {
      console.log("[HOME] Initializing Home component");
      try {
        const sessionExists = await doesSessionExist();
        console.log("[HOME] Session exists:", sessionExists);
        if (sessionExists) {
          console.log("[HOME] Fetching user data");
          const userData = await apiClient.getUser();
          console.log("[HOME] Fetched user data:", userData);
          if (userData.user) {
            const userInfo: User = {
              userId: userData.user.userId,
              userType: userData.user.userType,
              email: userData.user.email,
              name: userData.user.name,
              trialStartDate: userData.user.trialStartDate,
              trialEndDate: userData.user.trialEndDate,
              subscriptionStatus: userData.user.subscriptionStatus,
            };
            setUser(userInfo);
            console.log("[HOME] User state updated:", userInfo);
          } else {
            console.warn("[HOME] No user data in response:", userData);
            setError("No user data returned. Please try logging in again.");
            setUser(null);
            if (window.location.pathname !== "/auth") {
              window.location.href = "/auth";
            }
          }
        } else {
          console.log("[HOME] No session exists, proceeding as guest");
          setUser(null);
        }
      } catch (err: any) {
        console.error("[HOME] Error handling session or user data:", err);
        setError("Failed to load user data: " + (err.message || "Unknown error"));
        setUser(null);
      }
    }
    initialize();
  }, []);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      try {
        const data = await apiClient.getAgents();
        console.log("[HOME] Fetched agents:", data.agents);
        return data;
      } catch (err: any) {
        const errorMessage =
          err.message.includes("Unauthorized")
            ? "Please log in to perform actions on characters."
            : err.message.includes("User not found")
            ? "Your account is not registered. Please sign up again."
            : "Failed to fetch characters: " + (err.message || "Unknown error");
        setError(errorMessage);
        console.error("[HOME] Error fetching agents:", err.message, "Status:", err.status);
        throw err;
      }
    },
    refetchInterval: 50_000,
  });

  const itemsQuery = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const data = await apiClient.getItems({ itemType: "subscription" });
      console.log("[HOME] Fetched subscription items:", data.items);
      return data;
    },
    enabled: !!user?.userId && (subscriptionData?.isTrialActive || ["active", "trialing"].includes(subscriptionData?.status)),
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: (characterId: string) => apiClient.deleteCharacter(characterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({
        title: "Success",
        description: "Character deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error("[HOME] Error deleting character:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete character.",
      });
    },
  });

  const agents: Agent[] = agentsQuery?.data?.agents || [];
  const items = itemsQuery?.data?.items || [];

  const toggleCreateForm = () => {
    setShowCreateForm(!showCreateForm);
    setError(null);
  };

  const handleDeleteCharacter = (characterId: string, characterName: string) => {
    if (window.confirm(`Are you sure you want to delete the character "${characterName}"? This action cannot be undone.`)) {
      deleteCharacterMutation.mutate(characterId);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await apiClient.createPortalSession();
      window.location.href = response.url;
    } catch (err: any) {
      setError("Failed to open subscription portal: " + (err.message || "Unknown error"));
    }
  };

  const handleCancelSubscription = async () => {
    if (window.confirm("Are you sure you want to cancel your subscription? It will remain active until the end of the billing period.")) {
      try {
        await apiClient.cancelSubscription();
        setError(null);
        window.location.reload();
      } catch (err: any) {
        setError("Failed to cancel subscription: " + (err.message || "Unknown error"));
      }
    }
  };

  const formatTrialEndDate = (trialEndDate?: string) => {
    if (!trialEndDate) {
      console.warn("[HOME] trialEndDate is missing");
      return "Unknown";
    }
    try {
      return new Date(trialEndDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (err) {
      console.error("[HOME] Error formatting trialEndDate:", err);
      return "Invalid Date";
    }
  };

  const statusMessages: { [key: string]: string } = {
    active: "Your subscription is active!",
    trialing: `Your trial ends on ${formatTrialEndDate(user?.trialEndDate)}`,
    past_due: "Payment failed. Please update your payment method.",
    incomplete: "Your subscription setup is incomplete. Please complete payment.",
    canceled: "Your subscription has been canceled.",
    none: "No active subscription. Subscribe to access premium features.",
  };

  try {
    return (
      <div className="flex flex-col gap-4 h-full p-4 md:p-8 bg-agentvooc-primary-bg">
        <div className="flex items-center justify-between">
          <PageTitle title="Your AI Agents" />
          <Button
            variant="default"
            size="sm"
            onClick={toggleCreateForm}
            className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full"
            disabled={!user?.userId} // Disable for non-authenticated users
          >
            <Plus className="mr-2 h-4 w-4" />
            {showCreateForm ? "Cancel" : "Create Character"}
          </Button>
        </div>

        {user && (
          <div className="bg-agentvooc-secondary-accent p-4 rounded-md border border-agentvooc-accent/30 shadow-agentvooc-glow">
            <h2 className="text-lg font-semibold text-agentvooc-primary">Subscription Status</h2>
            <p className="text-agentvooc-secondary">{statusMessages[subscriptionData?.status || "none"]}</p>
            {["active", "trialing"].includes(subscriptionData?.status) && (
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleManageSubscription}
                  className="border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg"
                >
                  Manage Subscription
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Cancel Subscription
                </Button>
              </div>
            )}
            {["past_due", "incomplete"].includes(subscriptionData?.status) && (
              <Button
                className="mt-4 bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full"
                onClick={handleManageSubscription}
              >
                Update Payment Method
              </Button>
            )}
            {["none", "canceled"].includes(subscriptionData?.status) && (
              <NavLink to="/payment">
                <Button className="mt-4 bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full">
                  Subscribe Now
                </Button>
              </NavLink>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500 text-white p-2 rounded">{error}</div>
        )}
        {agentsQuery.isLoading && (
          <div className="text-agentvooc-secondary flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-agentvooc-accent" />
            Loading characters...
          </div>
        )}
        {user && showCreateForm && (
          <CreateCharacter
            toggleForm={toggleCreateForm}
            agentsQuery={agentsQuery}
            setError={setError}
          />
        )}
        {user && (
          <PaymentSection
            user={user}
            items={items}
            itemsQuery={itemsQuery}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {!agentsQuery.isLoading && !error && agents.length === 0 && (
            <div className="text-agentvooc-secondary col-span-full text-center">
              No characters available. {user ? 'Click "Create Character" to get started!' : "Log in to create characters."}
            </div>
          )}
          {agents.map((agent: Agent) => (
            <Card
              key={agent.id}
              className="bg-agentvooc-secondary-accent border-agentvooc-accent/30 hover:border-agentvooc-accent transition-all shadow-agentvooc-glow"
            >
              <CardHeader>
                <CardTitle className="text-agentvooc-primary">{agent?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md bg-agentvooc-primary-bg aspect-square w-full grid place-items-center">
                  <div className="text-6xl font-bold uppercase text-agentvooc-accent">
                    {formatAgentName(agent?.name)}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex items-center gap-2 w-full">
                  <NavLink to={`/chat/${agent.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg"
                    >
                      Chat
                    </Button>
                  </NavLink>
                  <NavLink to={`/settings/${agent.id}`}>
                    <Button
                      size="icon"
                      variant="outline"
                      className="border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg"
                    >
                      <Cog />
                    </Button>
                  </NavLink>
                  <NavLink to={`/knowledge/${agent.id}`}>
                    <Button
                      size="icon"
                      variant="outline"
                      className="border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg"
                    >
                      <Book />
                    </Button>
                  </NavLink>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => handleDeleteCharacter(agent.id, agent.name)}
                    className="bg-red-500 text-white hover:bg-red-600"
                    disabled={deleteCharacterMutation.isPending || !user} // Disable for non-authenticated users
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  } catch (renderError: any) {
    console.error("[HOME] Render error in Home component:", renderError);
    return (
      <div className="p-4">
        <h1 className="text-agentvooc-primary">Error rendering page</h1>
        <p className="text-agentvooc-secondary">Check the console for details.</p>
      </div>
    );
  }
}