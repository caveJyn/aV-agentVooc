import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarTrigger,
  SidebarInput,
  SidebarMenuAction,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar";
import { apiClient } from "@/lib/api";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import type { UUID, Character } from "@elizaos/core";
import { Book, Cog, User, Edit, Plus, Mail } from "lucide-react";
import ConnectionStatus from "./connection-status";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MouseEvent, useState } from "react";
import { Avatar, AvatarImage } from "./ui/avatar";
import { useUser, useClerk } from "@clerk/clerk-react";
import { clearCookies } from "@/lib/clearCookies";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn, isLoaded } = useUser(); // Use Clerk's useUser
  const { signOut } = useClerk(); // Use Clerk's signOut

  // Fetch user data
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: () => apiClient.getUser(),
    enabled: !!isSignedIn && isLoaded,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: false,
  });

  // Fetch all agents/characters
  const query = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    enabled: !!isSignedIn && isLoaded && !!userQuery.data?.user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: false,
  });

  const agents = query?.data?.agents || [];

  // Filter agents based on search query
  const filteredAgents = agents.filter((agent: { id: UUID; name: string }) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch character data for each filtered agent
  const characterQueries = useQuery({
    queryKey: ["characters", filteredAgents.map((a: { id: UUID }) => a.id)],
    queryFn: async () => {
      const results = await Promise.all(
        filteredAgents.map((agent: { id: UUID }) =>
          apiClient
            .getCharacter(agent.id)
            .then((data: { character: Character }) => ({
              agentId: agent.id,
              character: data.character,
            }))
            .catch((_error: Error) => {
              return { agentId: agent.id, character: null };
            })
        )
      );
      return Object.fromEntries(results.map((r) => [r.agentId, r.character]));
    },
    staleTime: 30 * 60 * 1000,
    enabled: filteredAgents.length > 0 && !!isSignedIn && isLoaded,
  });

  const handleLogout = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const cacheBust = `?cb=${Date.now()}`;

    try {
      console.log("[APP_SIDEBAR] Starting logout process");

      // Cancel & clear all queries
      await queryClient.cancelQueries();
      queryClient.invalidateQueries();
      queryClient.clear();

      // Sign out using Clerk
      await signOut();
      console.log("[APP_SIDEBAR] Clerk signOut complete");

      // Clear client-side storage & cookies
      localStorage.clear();
      sessionStorage.clear();
      clearCookies();
      setSearchQuery("");

      // Show success toast
      toast({ title: "Success", description: "Logged out successfully." });

      // Force navigation to auth page
      window.location.href = `/auth${cacheBust}`;
    } catch (err) {
      console.error("[APP_SIDEBAR] Logout error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to log out.";

      // Graceful fallback cleanup
      localStorage.clear();
      sessionStorage.clear();
      clearCookies();
      setSearchQuery("");

      toast({ variant: "destructive", title: "Error", description: errorMessage });

      navigate(`/auth${cacheBust}`, { replace: true });
      if (isMobile) setOpenMobile(false);
      else setOpen(false);

      setTimeout(() => {
        if (window.location.pathname !== "/auth") {
          window.location.href = `/auth${cacheBust}`;
        }
      }, 100);
    }
  };

  const handleLogin = () => {
    navigate("/auth");
  };

  const handleEditAgent = (agentId: UUID) => {
    navigate(`/edit-character/${agentId}`);
  };

  const handleCreateCharacter = () => {
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(true);
    }
    navigate("/create-character");
  };

  if (!isLoaded) return null; // Wait for Clerk to load

  return (
    <Sidebar className="bg-agentvooc-secondary-bg text-agentvooc-primary border-r border-agentvooc-border shadow-agentvooc-glow">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink
                to="/home"
                className="hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent transition-all"
              >
                <div className="flex items-center gap-0.5 leading-none">
                  <Avatar className="size-8 p-1 border rounded-full select-none">
                    <AvatarImage src="/aV-logo.png" />
                  </Avatar>
                  <span className="font-semibold text-agentvooc-primary">
                    agentVooc
                  </span>
                  <span className="text-agentvooc-accent">.</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-end mr-2">
            <SidebarTrigger className="hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent"></SidebarTrigger>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="default"
              className="flex justify-start w-full"
              onClick={handleCreateCharacter}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Character
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="mr-2">
                <SidebarInput
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSearchQuery(e.target.value)
                  }
                  className="mx-2 border-agentvooc-accent/50 focus:ring-agentvooc-accent"
                />
              </SidebarMenuItem>
              {query?.isPending || characterQueries.isPending ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <SidebarMenuItem key={`skeleton-${index}`}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))}
                </>
              ) : filteredAgents.length === 0 ? (
                <SidebarMenuItem>
                  <p className="text-sm text-agentvooc-secondary px-2">
                    No agents found
                  </p>
                </SidebarMenuItem>
              ) : (
                filteredAgents.map((agent: { id: UUID; name: string }) => (
                  <SidebarMenuItem key={agent.id} className="group">
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.includes(agent.id)}
                      tooltip={`Chat with ${agent.name}`}
                      className="transition-all"
                    >
                      <NavLink to={`/chat/${agent.id}`}>
                        <User className="" />
                        <span>{agent.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={() => handleEditAgent(agent.id)}
                      showOnHover
                      className="p-1 text-agentvooc-accent"
                    >
                      <Edit className="h-4 w-4" />
                    </SidebarMenuAction>
                    <SidebarMenuBadge>.</SidebarMenuBadge>
                    <KnowledgeVaultLink
                      agentId={agent.id}
                      agentName={agent.name}
                      character={characterQueries.data?.[agent.id]}
                      isCharacterPending={characterQueries.isPending}
                    />
                    <EmailVaultLink
                      agentId={agent.id}
                      agentName={agent.name}
                      character={characterQueries.data?.[agent.id]}
                      isCharacterPending={characterQueries.isPending}
                    />
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="https://elizaos.github.io/eliza/docs/intro/"
                target="_blank"
                className="hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent"
              >
                <Book className="text-agentvooc-accent" />
                <span>agentVooc OS-Fork of ElizaOS</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="https://agentvooc.com/company/blog/how-it-works"
                className="hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent"
              >
                <Cog className="text-agentvooc-accent" />
                <span>How it works</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className="hover:bg-agentvooc-secondary-accent hover:text-agentvooc-accent"
              >
                <Cog className="text-agentvooc-accent" />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <p className="text-sm text-agentvooc-secondary px-2">
              {isLoaded && isSignedIn && userQuery.isLoading
                ? "Loading..."
                : isSignedIn && userQuery.data?.user?.email
                ? userQuery.data.user.email
                : "User Logged In"}
            </p>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {isSignedIn ? (
              <Button onClick={handleLogout} variant="default" className="">
                Logout
              </Button>
            ) : (
              <Button onClick={handleLogin} variant="default" className="">
                Log In
              </Button>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ConnectionStatus />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// KnowledgeVaultLink and EmailVaultLink remain unchanged
function KnowledgeVaultLink({
  agentId,
  agentName,
  character,
  isCharacterPending,
}: {
  agentId: UUID;
  agentName: string;
  character: Character | null;
  isCharacterPending: boolean;
}) {
  const location = useLocation();

  if (isCharacterPending || !character) {
    return null;
  }

  if (!character.settings?.ragKnowledge) {
    return null;
  }

  return (
    <SidebarMenu className="ml-4">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={location.pathname === `/knowledge/${agentId}`}
          tooltip={`Knowledge Vault for ${agentName}`}
        >
          <NavLink to={`/knowledge/${agentId}`}>
            <Book className="text-agentvooc-accent" />
            <span>Knowledge Vault</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function EmailVaultLink({
  agentId,
  agentName,
  character,
  isCharacterPending,
}: {
  agentId: UUID;
  agentName: string;
  character: Character | null;
  isCharacterPending: boolean;
}) {
  const location = useLocation();

  if (isCharacterPending || !character) {
    return null;
  }

  if (
    !character.plugins?.map((p: any) => (typeof p === "string" ? p : p.name)).includes("email")
  ) {
    return null;
  }

  return (
    <SidebarMenu className="ml-4">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={location.pathname === `/email-vault/${agentId}`}
          tooltip={`Email Vault for ${agentName}`}
        >
          <NavLink to={`/email-vault/${agentId}`}>
            <Mail className="text-agentvooc-accent" />
            <span>Email Vault</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}