import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useEffect, Component, ErrorInfo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Activity } from "lucide-react";

// Error Boundary Component
class ConnectionStatusErrorBoundary extends Component<React.PropsWithChildren<{}>> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ConnectionStatus ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-red-600" />
          <span className="text-xs text-red-600">Error: Failed to load status</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ConnectionStatus() {
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [lastConnected, setLastConnected] = useState<boolean>(true); // Track last known connection state
  const [lastStatusUpdate, setLastStatusUpdate] = useState<boolean | null>(null); // Track what we last sent to backend

  // Mutation to update connection status in the backend
  const updateConnectionStatus = useMutation({
    mutationFn: (isConnected: boolean) =>
      apiClient.updateConnectionStatus({ isConnected }),
    onError: (_error) => {
      // console.error("[ConnectionStatus] Failed to update connection status:", error);
      // Don't change lastConnected here - this is just a backend sync failure
    },
  });

  // Query to fetch agents - this determines actual connection status
  const query = useQuery({
    queryKey: ["status"],
    queryFn: async () => {
      const start = performance.now();
      const data = await apiClient.getUser();
      const end = performance.now();
      setQueryTime(end - start);
      return data;
    },
    refetchInterval: 30_000,
    retry: 5,
    refetchOnWindowFocus: "always",
  });

  // Update connection state based on query status (original logic)
  useEffect(() => {
    if (query.isSuccess) {
      setLastConnected(true);
    } else if (query.isError) {
      setLastConnected(false);
      // console.error("[ConnectionStatus] Failed to fetch agents:", query.error);
    }
  }, [query.isSuccess, query.isError]);

  // Sync connection status to backend only when it actually changes
  useEffect(() => {
  const currentStatus = query.isSuccess && !query.isError;
  if (lastStatusUpdate !== currentStatus) {
    setLastStatusUpdate(currentStatus);
    updateConnectionStatus.mutate(currentStatus, {
      onSuccess: () => {
        // console.log(`[ConnectionStatus] Backend status updated`, { currentStatus });
      },
      onError: (_error) => {
        // console.log(`[ConnectionStatus] Backend status update failed`, { error });
      }
    });
  }
}, [query.isSuccess, query.isError]);

  const isLoading = query.isRefetching || query.isPending;
  const connected = lastConnected; // Use last known state from API calls

  // Only show "Connecting..." on initial load, not during refetches
  const displayStatus = isLoading && queryTime === null ? "Connecting..." : connected ? "Connected" : "Disconnected";

  return (
    <ConnectionStatusErrorBoundary>
      <div className="flex items-center gap-2 px-4 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 select-none transition-all duration-200">
              <div
                className={cn([
                  "h-2.5 w-2.5 rounded-full",
                  displayStatus === "Connecting..." ? "bg-muted-foreground" : connected ? "bg-green-600" : "bg-red-600",
                ])}
              />
              <span
                className={cn([
                  "text-xs",
                  displayStatus === "Connecting..." ? "text-muted-foreground" : connected ? "text-green-600" : "text-red-600",
                ])}
              >
                {displayStatus}
              </span>
            </div>
          </TooltipTrigger>
          {connected ? (
            <TooltipContent side="top">
              <div className="flex items-center gap-1">
                <Activity className="size-4" />
                <span>{queryTime?.toFixed(2)} ms</span>
              </div>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </ConnectionStatusErrorBoundary>
  );
}