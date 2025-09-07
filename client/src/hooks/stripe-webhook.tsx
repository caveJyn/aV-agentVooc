import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useSubscriptionStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscription-status", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }
      const response = await apiClient.getSubscriptionStatus();
      return response; // { status, isTrialActive }
    },
    enabled: !!userId,
    retry: 2,
  });
}