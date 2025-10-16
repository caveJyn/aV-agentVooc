import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  Calendar,
  DollarSign,
  Activity,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { useUser, useAuth } from "@clerk/clerk-react";
import { useSubscriptionStatus } from "@/hooks/stripe-webhook";
import PageTitle from "@/components/page-title";
import InvoiceHistory from "@/components/invoice-history";
import { Item } from "@/types/index.ts";
import { toast } from "@/hooks/use-toast";

interface User {
  userId: string;
  userType: string;
  email: string;
  name: string;
  trialStartDate?: string;
  trialEndDate?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  responseCount: number;
  tokenCount: number;
  subscriptionStatus: string;
  activePlugins: string[];
  activePriceIds: string[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  hasUsedTrial: boolean;
  cancelAtPeriodEnd: boolean;
  isConnected: boolean;
}

interface AnalyticsMetric {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}

interface SubscriptionItem extends Item {
  price: number;
  stripePriceId: string;
  itemType: string;
  name: string;
  pluginName?: string;
}

interface SubscriptionData {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  isTrialActive: boolean;
  trialEndDate: string;
  activePriceIds: string[];
  activePlugins: string[];
  items: SubscriptionItem[];
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user: clerkUser, isLoaded } = useUser();
  const { isSignedIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [selectedBaseItem, setSelectedBaseItem] = useState<Item | null>(null);
  const [showInvoiceHistory, setShowInvoiceHistory] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);

  useEffect(() => {
    async function initialize() {
      if (!isLoaded || !isSignedIn) return;
      try {
        const userData = await apiClient.getUser();
        if (userData?.user) {
          setUser(userData.user);
        } else {
          setError("No user data returned.");
          console.error("[Settings] No user data returned");
        }
      } catch (err: any) {
        setError("Failed to load user data: " + err.message);
        console.error("[Settings] Error loading user data:", err.message);
      }
    }
    initialize();
  }, [clerkUser, isLoaded, isSignedIn]);

  const { data: subscriptionData, isLoading: isSubscriptionLoading } = useSubscriptionStatus(
    user?.userId
  );

  const allItemsQuery = useQuery({
    queryKey: ["all-items"],
    queryFn: async () => {
      const data = await apiClient.getItems();
      return data.items;
    },
    enabled: !!user?.userId,
  });

  const isTrialEnded =
    user?.trialEndDate &&
    new Date(user.trialEndDate) < new Date() &&
    subscriptionData?.status !== "active";

  if (!isLoaded || !isSignedIn) {
    window.location.href = "/auth";
    return null;
  }

  if (!user || isSubscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-agentvooc-secondary-bg">
        <Loader2 className="h-8 w-8 animate-spin text-agentvooc-accent" />
        <p className="ml-3">Analyzing user data...</p>
      </div>
    );
  }

  const baseItems = allItemsQuery.data?.filter((item) => item.itemType === "base") || [];
  const pluginItems = allItemsQuery.data?.filter((item) => item.itemType === "plugin") || [];
  const currentBaseItem = baseItems.find((item) =>
    subscriptionData?.activePriceIds?.includes(item.stripePriceId)
  );
  const currentPluginItems = pluginItems.filter((item) =>
    subscriptionData?.activePlugins?.includes(item.pluginName)
  );
  const availableBaseItems = baseItems.filter((item) => item.id !== currentBaseItem?.id);
  const availablePluginItems = pluginItems.filter((item) =>
    !subscriptionData?.activePlugins?.includes(item.pluginName)
  );

  const calculateAnalytics = (): AnalyticsMetric[] => {
    if (!user || !subscriptionData) return [];

    const totalPrice =
      (subscriptionData as SubscriptionData)?.items?.reduce(
        (sum: number, item: SubscriptionItem) => sum + (item.price || 0),
        0
      ) / 100 || 0;

    const trialDaysLeft = user.trialEndDate
      ? Math.max(
          0,
          Math.ceil(
            (new Date(user.trialEndDate).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    const billingDaysLeft = user.currentPeriodEnd
      ? Math.max(
          0,
          Math.ceil(
            (new Date(user.currentPeriodEnd).getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      : 0;

    const tokenEfficiency =
      user.responseCount > 0 ? (user.tokenCount / user.responseCount).toFixed(0) : 0;

    return [
      {
        label: "Monthly Spend",
        value: `$${totalPrice.toFixed(2)}`,
        icon: <DollarSign className="h-5 w-5" />,
        trend: user.subscriptionStatus === "trialing" ? "Trial Active" : "Active",
        color: "text-green-400",
      },
      {
        label: "API Responses",
        value: user.responseCount.toLocaleString(),
        icon: <Activity className="h-5 w-5" />,
        trend:
          user.responseCount > 100
            ? "High Usage"
            : user.responseCount > 10
            ? "Moderate"
            : "Low Usage",
        color: user.responseCount > 100 ? "text-orange-400" : "text-blue-400",
      },
      {
        label: "Tokens Consumed",
        value: user.tokenCount.toLocaleString(),
        icon: <Zap className="h-5 w-5" />,
        trend: `${tokenEfficiency} avg/response`,
        color: "text-purple-400",
      },
      {
        label: "Active Plugins",
        value: currentPluginItems.length,
        icon: <Shield className="h-5 w-5" />,
        trend: `${availablePluginItems.length} available`,
        color: "text-cyan-400",
      },
      {
        label: user.subscriptionStatus === "trialing" ? "Trial Days Left" : "Billing Days Left",
        value: user.subscriptionStatus === "trialing" ? trialDaysLeft : billingDaysLeft,
        icon: <Calendar className="h-5 w-5" />,
        trend: user.subscriptionStatus === "trialing" ? "Free Trial" : "Paid Plan",
        color: user.subscriptionStatus === "trialing" ? "text-yellow-400" : "text-green-400",
      },
      {
        label: "Account Status",
        value:
          user.subscriptionStatus === "trialing"
            ? "TRIAL"
            : user.subscriptionStatus === "past_due"
            ? "PAST DUE"
            : "ACTIVE",
        icon: <TrendingUp className="h-5 w-5" />,
        trend: user.hasUsedTrial ? "Returning User" : "New User",
        color:
          user.subscriptionStatus === "trialing"
            ? "text-yellow-400"
            : user.subscriptionStatus === "past_due"
            ? "text-red-400"
            : "text-green-400",
      },
    ];
  };

  const analyticsMetrics = calculateAnalytics();

  const handleAddPlugin = async (pluginName: string) => {
    if (isTrialEnded) {
      toast({
        title: "Trial Ended",
        description: "Please subscribe to a plan to add plugins.",
        variant: "destructive",
      });
      return;
    }
    try {
      await apiClient.addPlugin(pluginName);
      setError(null);
      toast({
        title: "Success",
        description: `Plugin "${pluginName}" added successfully.`,
        variant: "default",
      });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      window.location.reload();
    } catch (error: any) {
      const backendError = error.response?.data?.error || "Failed to add plugin.";
      setError(backendError);
      toast({
        title: "Error",
        description: backendError,
        variant: "destructive",
      });
    }
  };

  const handleRemovePlugin = async (pluginName: string) => {
    if (isTrialEnded) {
      toast({
        title: "Trial Ended",
        description: "Please subscribe to a plan to manage plugins.",
        variant: "destructive",
      });
      return;
    }
    try {
      await apiClient.removePlugin(pluginName);
      setError(null);
      toast({
        title: "Success",
        description: `Plugin "${pluginName}" removed successfully.`,
        variant: "default",
      });
      window.location.reload();
    } catch (error: any) {
      const backendError =
        error.response?.data?.error ||
        "Failed to remove plugin. One of the characters is using the plugin.";
      setError(backendError);
      toast({
        title: "Error",
        description: backendError,
        variant: "destructive",
      });
    }
  };

  const handleUpdateBasePlan = async () => {
    if (isTrialEnded) {
      toast({
        title: "Trial Ended",
        description: "Please subscribe to a plan to update your base plan.",
        variant: "destructive",
      });
      return;
    }
    if (selectedBaseItem) {
      try {
        await apiClient.updateBasePlan(selectedBaseItem.id);
        setError(null);
        toast({
          title: "Success",
          description: "Base plan updated successfully.",
          variant: "default",
        });
        window.location.reload();
      } catch (error: any) {
        setError("Failed to update base plan: " + error.message);
        toast({
          title: "Error",
          description: "Failed to update base plan.",
          variant: "destructive",
        });
      }
    }
  };

  const handleCancelSubscription = async () => {
    if (isTrialEnded) {
      toast({
        title: "Trial Ended",
        description: "Please subscribe to a plan to manage your subscription.",
        variant: "destructive",
      });
      return;
    }
    if (
      window.confirm(
        "Are you sure you want to cancel your entire subscription, including the base plan and all plugins? This action cannot be undone."
      )
    ) {
      try {
        const response = await apiClient.cancelSubscription();
        setError(null);
        toast({
          title: "Success",
          description: `Subscription will cancel on ${new Date(
            response.periodEnd
          ).toLocaleDateString()}.`,
          variant: "default",
        });
        window.location.reload();
      } catch (error: any) {
        setError("Failed to cancel subscription: " + error.message);
        toast({
          title: "Error",
          description: "Failed to cancel subscription.",
          variant: "destructive",
        });
      }
    }
  };

  const handleManageSubscription = async () => {
    if (isTrialEnded) {
      toast({
        title: "Trial Ended",
        description: "Please subscribe to a plan to manage your billing.",
        variant: "destructive",
      });
      return;
    }
    try {
      const response = await apiClient.createPortalSession();
      window.location.href = response.url;
    } catch (err: any) {
      setError("Failed to open subscription portal: " + err.message);
      toast({
        title: "Error",
        description: "Failed to open subscription portal.",
        variant: "destructive",
      });
    }
  };

  const handleProceedToPayment = async () => {
  if (!selectedBaseItem) {
    toast({
      title: "Error",
      description: "Please select a base plan to proceed.",
      variant: "destructive",
    });
    return;
  }
  try {
    const items = [
      selectedBaseItem,
      ...selectedItems.filter((item) => item.itemType === "plugin"),
    ].filter((item): item is Item & { stripePriceId: string } => !!item.stripePriceId);
    const response = await apiClient.createCheckoutSession({
      userId: user!.userId,
      items,
    });
    window.location.href = response.url;
  } catch (err: any) {
    setError("Failed to initiate checkout: " + err.message);
    toast({
      title: "Error",
      description: "Failed to initiate checkout.",
      variant: "destructive",
    });
  }
};

  const handleSelectItem = (item: Item) => {
    if (item.itemType === "base") {
      setSelectedBaseItem(item);
    } else {
      setSelectedItems((prev) =>
        prev.some((i) => i.id === item.id)
          ? prev.filter((i) => i.id !== item.id)
          : [...prev, item]
      );
    }
  };

  const totalSelectedPrice =
    ((selectedBaseItem?.price || 0) +
    selectedItems.reduce((sum, item) => sum + (item.price || 0), 0)) / 100;

  const isCancelPending = subscriptionData?.cancelAtPeriodEnd;

  return (
    <div className="min-h-screen bg-agentvooc-secondary-bg p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="h-8 w-8 text-agentvooc-accent" />
          <PageTitle title="Analytics Dashboard" />
        </div>

        {isTrialEnded && (
          <Card className="mb-8 bg-yellow-500/10 border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Calendar className="h-6 w-6 text-yellow-400" />
                Your Trial Has Ended
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-yellow-400 mb-4">
                Your 7-day free trial has ended. Please select a plan to continue using agentVooc.
              </p>
              <Button
                onClick={() => setShowPlanSelection(!showPlanSelection)}
                variant="default"
                className="bg-agentvooc-accent hover:bg-agentvooc-accent/80"
              >
                {showPlanSelection ? "Hide Plan Selection" : "Select Plan"}
              </Button>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-8 border-red-500 bg-red-500/10">
            <CardContent className="p-4">
              <div className="text-red-400 font-medium">{error}</div>
            </CardContent>
          </Card>
        )}

        {isTrialEnded && showPlanSelection && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Select Subscription Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Base Plans</h3>
                  <div className="space-y-3">
                    {baseItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg cursor-pointer ${
                          selectedBaseItem?.id === item.id
                            ? "border-agentvooc-accent bg-agentvooc-accent/10"
                            : "border-agentvooc-secondary-bg"
                        }`}
                        onClick={() => handleSelectItem(item)}
                      >
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm">${(item.price / 100).toFixed(2)}/month</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">Plugins</h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {pluginItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg cursor-pointer ${
                          selectedItems.some((i) => i.id === item.id)
                            ? "border-agentvooc-accent bg-agentvooc-accent/10"
                            : "border-agentvooc-secondary-bg"
                        }`}
                        onClick={() => handleSelectItem(item)}
                      >
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm">${(item.price / 100).toFixed(2)}/month</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {(selectedBaseItem || selectedItems.length > 0) && (
                <div className="mt-6 p-4 bg-agentvooc-secondary-bg rounded-lg">
                  <h4 className="text-lg font-semibold mb-2">Selected Plan</h4>
                  {selectedBaseItem && (
                    <div className="flex justify-between items-center">
                      <span>{selectedBaseItem.name} (Base)</span>
                      <span>${(selectedBaseItem.price / 100).toFixed(2)}/mo</span>
                    </div>
                  )}
                  {selectedItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span>{item.name} (Plugin)</span>
                      <span>${(item.price / 100).toFixed(2)}/mo</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center mt-2 font-bold">
                    <span>Total</span>
                    <span>${totalSelectedPrice.toFixed(2)}/mo</span>
                  </div>
                  <Button
                    onClick={handleProceedToPayment}
                    className="mt-4 w-full bg-agentvooc-accent hover:bg-agentvooc-accent/80"
                    disabled={!selectedBaseItem}
                  >
                    Proceed to Payment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {analyticsMetrics.map((metric, index) => (
            <Card key={index}>
              <CardContent className="flex flex-col items-center justify-center text-center p-4">
                <div className="flex items-center justify-center mb-2">
                  <div className={metric.color}>{metric.icon}</div>
                </div>
                <div className="text-sm font-medium">{metric.label}</div>
                <div className="text-2xl font-bold my-1">{metric.value}</div>
                <div className={`text-xs ${metric.color} font-medium`}>{metric.trend}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-agentvooc-accent" />
              Subscription Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Current Status</h3>
                {isCancelPending ? (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                    <p className="text-red-400 font-medium">⚠️ Cancellation Pending</p>
                    <p className="text-sm mt-1">
                      Subscription ends:{" "}
                      {user.currentPeriodEnd
                        ? new Date(user.currentPeriodEnd).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                    <p className="text-green-400 font-medium">
                      {user.subscriptionStatus === "trialing"
                        ? "🎯 Free Trial Active"
                        : user.subscriptionStatus === "past_due"
                        ? "⚠️ Payment Required"
                        : "✅ Subscription Active"}
                    </p>
                    <p className="text-sm mt-1">
                      {user.subscriptionStatus === "trialing"
                        ? `Trial period: ${
                            user.trialStartDate
                              ? new Date(user.trialStartDate).toLocaleDateString()
                              : "N/A"
                          } - ${
                            user.trialEndDate
                              ? new Date(user.trialEndDate).toLocaleDateString()
                              : "N/A"
                          }`
                        : `Billing cycle: ${
                            user.currentPeriodStart
                              ? new Date(user.currentPeriodStart).toLocaleDateString()
                              : "N/A"
                          } - ${
                            user.currentPeriodEnd
                              ? new Date(user.currentPeriodEnd).toLocaleDateString()
                              : "N/A"
                          }`}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span>Base Plan:</span>
                    <span className="font-medium">{currentBaseItem?.name || "None"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Active Plugins:</span>
                    <span className="font-medium">{currentPluginItems.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Monthly Total:</span>
                    <span className="text-agentvooc-accent font-bold text-lg">
                      ${(subscriptionData as SubscriptionData)?.items?.reduce(
                        (sum: number, item: SubscriptionItem) => sum + (item.price || 0),
                        0
                      ) / 100 || 0}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Usage Analytics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-agentvooc-secondary-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-400" />
                      <span>API Responses</span>
                    </div>
                    <span className="font-bold">{user.responseCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-agentvooc-secondary-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-400" />
                      <span>Tokens Processed</span>
                    </div>
                    <span className="font-bold">{user.tokenCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-agentvooc-secondary-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-400" />
                      <span>Efficiency Ratio</span>
                    </div>
                    <span className="font-bold">
                      {user.responseCount > 0
                        ? (user.tokenCount / user.responseCount).toFixed(0)
                        : 0} tokens/response
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {(subscriptionData as SubscriptionData)?.items?.length > 0 && (
              <div className="mt-6 pt-6 border-t border-agentvooc-accent/20">
                <h4 className="text-lg font-semibold mb-4">Active Subscription Items</h4>
                <div className="space-y-2">
                  {(subscriptionData as SubscriptionData).items.map((item: SubscriptionItem) => (
                    <div
                      key={item.stripePriceId}
                      className="flex items-center justify-between p-3 bg-agentvooc-secondary-bg rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            item.itemType === "base" ? "bg-blue-400" : "bg-green-400"
                          }`}
                        ></div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs px-2 py-1 bg-agentvooc-accent/20 text-agentvooc-accent rounded-full">
                          {item.itemType.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>${(item.price / 100).toFixed(2)}/mo</span>
                        {item.itemType === "plugin" && !isCancelPending && !isTrialEnded && (
                          <Button
                            onClick={() =>
                              item.pluginName && handleRemovePlugin(item.pluginName)
                            }
                            size="sm"
                            variant="destructive"
                            className="h-8 px-3 text-xs"
                            disabled={!item.pluginName}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!isCancelPending && !isTrialEnded && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Update Base Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <select
                    value={selectedBaseItem?.id || ""}
                    onChange={(e) => {
                      const selected =
                        availableBaseItems.find((item) => item.id === e.target.value) || null;
                      setSelectedBaseItem(selected);
                    }}
                    className="w-full p-3 bg-agentvooc-secondary-bg border border-agentvooc-accent/30 rounded-lg focus:border-agentvooc-accent"
                  >
                    <option value="">Select a base plan</option>
                    {availableBaseItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} - ${(item.price / 100).toFixed(2)}/mo
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={handleUpdateBasePlan}
                    className=""
                    disabled={!selectedBaseItem}
                  >
                    Update Base Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Available Plugins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {availablePluginItems.length > 0 ? (
                    availablePluginItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-agentvooc-secondary-bg rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm">${(item.price / 100).toFixed(2)}/month</p>
                        </div>
                        <Button
                          onClick={() => item.pluginName && handleAddPlugin(item.pluginName)}
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          disabled={!item.pluginName}
                        >
                          Add Plugin
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4">No additional plugins available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button
            variant="default"
            onClick={handleManageSubscription}
            disabled={!!isTrialEnded}
          >
            Manage Billing Portal
          </Button>
          <Button
            onClick={() => setShowInvoiceHistory(!showInvoiceHistory)}
            aria-label={showInvoiceHistory ? "Hide invoice history" : "Show invoice history"}
            aria-expanded={showInvoiceHistory}
          >
            {showInvoiceHistory ? "Hide Invoices" : "View Invoices"}
          </Button>
          {!isCancelPending && !isTrialEnded && (
            <Button
              onClick={handleCancelSubscription}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Cancel Entire Subscription
            </Button>
          )}
        </div>

        {showInvoiceHistory && user.userId && (
          <Card className="mb-8 bg-agentvooc-secondary-accent/30 border-agentvooc-accent/30">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-agentvooc-accent" />
                Invoice History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceHistory userId={user.userId} />
            </CardContent>
          </Card>
        )}

        {!isCancelPending && user.subscriptionStatus === "trialing" && !isTrialEnded && (
          <Card className="mt-6 bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-yellow-400 font-medium">Trial Auto-Continue Notice</p>
                  <p className="text-sm mt-1">
                    After your free trial ends on{" "}
                    {user.trialEndDate
                      ? new Date(user.trialEndDate).toLocaleDateString()
                      : "N/A"}
                    , please select a plan to continue your subscription at $
                    {(subscriptionData as SubscriptionData)?.items?.reduce(
                      (sum: number, item: SubscriptionItem) => sum + (item.price || 0),
                      0
                    ) / 100 || 0}
                    /month.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}