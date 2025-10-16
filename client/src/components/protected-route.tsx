// client/src/components/protected-route.tsx
import { ReactNode } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/stripe-webhook";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const location = useLocation();
  const { data: subscriptionData, isLoading } = useSubscriptionStatus(user?.id);

  if (!isLoaded || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-agentvooc-secondary-bg">
        <Loader2 className="h-8 w-8 animate-spin text-agentvooc-accent" />
        <p className="ml-3">Loading...</p>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!subscriptionData || !["active", "trialing", "incomplete"].includes(subscriptionData.status)) {
    return (
      <Navigate
        to="/settings"
        state={{ from: location, showPaymentPrompt: true }}
        replace
      />
    );
  }

  return <>{children}</>;
}