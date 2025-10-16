import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cog, Trash2, Edit, Book } from "lucide-react";
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
import { NavLink, useNavigate } from "react-router-dom";
import type { UUID } from "@elizaos/core";
import { formatAgentName } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";


export default function Home() {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isSignedIn } = useUser(); // Use isSignedIn for clarity

  // Redirect if not authenticated
  useEffect(() => {
    if (!isSignedIn) {
      navigate("/auth", { replace: true });
    }
  }, [isSignedIn, navigate]);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      try {
        const data = await apiClient.getAgents();
        return data;
      } catch (err: any) {
        console.error("[HOME] Error fetching agents:", err);
        const errorMessage = err.message.includes("Unauthorized")
          ? "Please log in to view your characters."
          : "Failed to fetch your characters: " + (err.message || "Unknown error");
        setError(errorMessage);

        if (err.message.includes("Unauthorized") && window.location.pathname !== "/auth") {
          navigate("/auth", { replace: true });
        }
        throw err;
      }
    },
    enabled: !!isSignedIn, // Only run query if signed in
    staleTime: 10 * 60 * 1000,
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

  const handleDeleteCharacter = (characterId: string, characterName: string) => {
    if (window.confirm(`Are you sure you want to delete the character "${characterName}"?`)) {
      deleteCharacterMutation.mutate(characterId);
    }
  };

  if (!user) return null; // Wait for Clerk user to load

  const agents = agentsQuery?.data?.agents || [];

  return (
    <div className="flex flex-col gap-4 min-h-screen p-4 md:p-8 bg-agentvooc-secondary-bg">
      <div className="flex items-center justify-between">
        <PageTitle title="Your AI Agents" />
      </div>

      {error && (
        <div className="bg-red-500 text-white p-2 rounded">{error}</div>
      )}
      {agentsQuery.isLoading && (
        <div className="text-agentvooc-secondary flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading your characters...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {!agentsQuery.isLoading && !error && agents.length === 0 && (
          <div className="text-agentvooc-secondary col-span-full text-center">
            You haven't created any characters yet. Click "Create Character" in the sidebar to get started!
          </div>
        )}
        {agents.map((agent: { id: UUID; name: string; profile?: { image?: string } }) => (
          <Card
            key={agent.id}
            className="border-agentvooc-accent/30 hover:border-agentvooc-accent transition-all shadow-agentvooc-glow overflow-hidden min-w-[200px]"
          >
            <CardHeader className="p-4">
              <CardTitle className="text-lg truncate">{agent?.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-md bg-agentvooc-secondary-bg aspect-square w-full grid place-items-center">
                {agent.profile?.image ? (
                  <img
                    src={agent.profile.image}
                    alt={`${agent.name}'s profile`}
                    className="w-full h-full object-cover rounded-md"
                  />
                ) : (
                  <div className="text-4xl md:text-6xl font-bold uppercase text-agentvooc-accent">
                    {formatAgentName(agent?.name)}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="p-4">
              <div className="flex flex-col gap-2 w-full">
                <NavLink to={`/chat/${agent.id}`} className="w-full">
                  <Button variant="default">Chat</Button>
                </NavLink>
                <div className="flex gap-2 justify-center">
                  <NavLink to={`/settings/${agent.id}`}>
                    <Button size="icon" variant="outline" aria-label="Settings">
                      <Cog className="h-4 w-4" />
                    </Button>
                  </NavLink>
                  <NavLink to={`/knowledge/${agent.id}`}>
                    <Button size="icon" variant="outline" aria-label="Knowledge">
                      <Book className="h-4 w-4" />
                    </Button>
                  </NavLink>
                  <NavLink to={`/edit-character/${agent.id}`}>
                    <Button size="icon" variant="outline" aria-label="Edit Character">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </NavLink>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => handleDeleteCharacter(agent.id, agent.name)}
                    disabled={deleteCharacterMutation.isPending}
                    aria-label="Delete Character"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
