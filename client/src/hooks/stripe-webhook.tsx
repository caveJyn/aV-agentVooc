// In client/src/hooks/stripe-webhook.ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export function useSubscriptionStatus(userId?: string) {
  return useQuery({
    queryKey: ["subscription-status", userId],
    queryFn: async () => {
      if (!userId) return { 
        status: "none", 
        isTrialActive: false, 
        activePriceIds: [], 
        activePlugins: [], 
        items: [], 
        trialEndDate: "", 
        cancelAtPeriodEnd: false, 
        currentPeriodEnd: "" 
      };
      const [statusResponse, itemsResponse] = await Promise.all([
        apiClient.getSubscriptionStatus(),
        apiClient.getSubscriptionItems({ includeDetails: true }),
      ]);
      return {
        status: statusResponse.status,
        isTrialActive: statusResponse.isTrialActive,
        activePriceIds: itemsResponse.priceIds || [],
        activePlugins: itemsResponse.plugins || [],
        items: itemsResponse.items || [],
        trialEndDate: itemsResponse.items[0]?.trialEndDate || statusResponse.trialEndDate || "",
        cancelAtPeriodEnd: itemsResponse.cancelAtPeriodEnd || false,
        currentPeriodEnd: itemsResponse.currentPeriodEnd || "",
      };
    },
    enabled: !!userId,
  });
}