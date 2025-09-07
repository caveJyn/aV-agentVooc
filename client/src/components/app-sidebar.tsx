import { useQuery } from "@tanstack/react-query";
import info from "@/lib/info.json";
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
} from "@/components/ui/sidebar";
import { apiClient } from "@/lib/api";
import { NavLink, useLocation } from "react-router-dom";
import type { UUID } from "@elizaos/core";
import { Cog, User, Edit } from "lucide-react";
import ConnectionStatus from "./connection-status";
import { signOut } from "supertokens-web-js/recipe/session";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const query = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
    refetchInterval: 5_000,
  });

  const agents = query?.data?.agents || [];

  // Filter agents based on search query
  const filteredAgents = agents.filter((agent: { id: UUID; name: string }) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Success!",
        description: "Logged out successfully.",
      });
      navigate("/auth?mode=signin");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to log out. Please try again.",
      });
    }
  };

  const handleEditAgent = (agentId: UUID) => {
    toast({
      title: "Edit Agent",
      description: `Editing agent ${agentId} (not implemented).`,
    });
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <NavLink to="/">
                <img
                  alt="elizaos-icon"
                  src="/elizaos-icon.png"
                  width="100%"
                  height="100%"
                  className="size-7"
                />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">ElizaOS</span>
                  <span className="">v{info?.version}</span>
                </div>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarTrigger className="w-full justify-start">
              <span>Toggle Sidebar</span>
            </SidebarTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Agents</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarInput
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mx-2"
                />
              </SidebarMenuItem>
              {query?.isPending ? (
                <>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <SidebarMenuItem key={`skeleton-${index}`}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))}
                </>
              ) : filteredAgents.length === 0 ? (
                <SidebarMenuItem>
                  <span className="text-sm text-sidebar-foreground/70 px-2">
                    No agents found
                  </span>
                </SidebarMenuItem>
              ) : (
                filteredAgents.map((agent: { id: UUID; name: string }) => (
                  <SidebarMenuItem key={agent.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.includes(agent.id)}
                      tooltip={`Chat with ${agent.name}`}
                    >
                      <NavLink to={`/chat/${agent.id}`}>
                        <User />
                        <span>{agent.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={() => handleEditAgent(agent.id)}
                      showOnHover
                    >
                      <Edit />
                    </SidebarMenuAction>
                    <SidebarMenuBadge>.</SidebarMenuBadge>
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
              >
                <span>Documentation</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <Cog />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              Logout
            </Button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ConnectionStatus />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}