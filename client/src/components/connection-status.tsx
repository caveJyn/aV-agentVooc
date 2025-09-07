import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Activity } from "lucide-react";

export default function ConnectionStatus() {
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const [lastConnected, setLastConnected] = useState<boolean>(true); // Track last known connection state

  const query = useQuery({
    queryKey: ["status"],
    queryFn: async () => {
      const start = performance.now();
      const data = await apiClient.getAgents();
      const end = performance.now();
      setQueryTime(end - start);
      return data;
    },
    refetchInterval: 5_000,
    retry: 1,
    refetchOnWindowFocus: "always",
  });

  // Update connection state based on query status
  useEffect(() => {
    if (query.isSuccess) {
      setLastConnected(true);
    } else if (query.isError) {
      setLastConnected(false);
    }
  }, [query.isSuccess, query.isError]);

  const isLoading = query.isRefetching || query.isPending;
  const connected = lastConnected; // Use last known state

  // Only show "Connecting..." on initial load, not during refetches
  const displayStatus = isLoading && queryTime === null ? "Connecting..." : connected ? "Connected" : "Disconnected";

  return (
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
  );
}