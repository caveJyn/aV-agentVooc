import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { doesSessionExist } from "supertokens-web-js/recipe/session";
import { apiClient } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";


export default function SuccessPage() {
  const [user, setUser] = useState<{
    userId: string;
    userType: string;
    email?: string;
    subscriptionStatus?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const maxRetries = 10;
  const retryDelay = 2000; // 2 seconds
  const queryClient = useQueryClient();

  useEffect(() => {
    async function checkSessionAndFetchUser() {
      console.log("[SUCCESS_PAGE] Checking if session exists");
      if (await doesSessionExist()) {
        try {
          console.log("[SUCCESS_PAGE] Session exists, fetching user data");
          const response = await apiClient.getUser();
          const userData = {
            userId: response.user.userId,
            userType: response.user.userType,
            email: response.user.email,
            subscriptionStatus: response.user.subscriptionStatus,
          };
          setUser(userData);
          console.log("[SUCCESS_PAGE] User data fetched:", response);

          if (userData.subscriptionStatus === "active") {
            queryClient.invalidateQueries({ queryKey: ["subscription-status", userData.userId] });
            console.log("[SUCCESS_PAGE] Subscription active, redirecting to /home");
            window.location.href = "/home";
          } else if (retryCount < maxRetries) {
            console.log(`[SUCCESS_PAGE] Subscription not active, retrying (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              setRetryCount(retryCount + 1);
            }, retryDelay);
          } else {
            console.log("[SUCCESS_PAGE] Max retries reached, showing error");
            setError("Subscription not activated. Please try again or contact support.");
          }
        } catch (err: any) {
          console.error("[SUCCESS_PAGE] Failed to fetch user data:", err.message);
          setError("Failed to load user data. Please log in again.");
          if (err.status === 401) {
            console.log("[SUCCESS_PAGE] Unauthorized, redirecting to /auth");
            window.location.href = "/auth";
          }
        }
      } else {
        console.log("[SUCCESS_PAGE] No session exists, redirecting to /auth");
        setError("No active session found. Please log in to continue.");
        window.location.href = "/auth";
      }
    }

    if (sessionId) {
      console.log("[SUCCESS_PAGE] Session ID present, initiating user check");
      checkSessionAndFetchUser();
    } else {
      console.log("[SUCCESS_PAGE] No session_id in URL, showing error");
      setError("Invalid payment session. Please try again or contact support.");
    }
  }, [retryCount, sessionId]);

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold text-red-600 mb-4">Error</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/auth" className="text-blue-500">
            <Button variant="outline">Log In</Button>
          </Link>
          <Button
            onClick={() => {
              setRetryCount(0);
              setError(null);
              console.log("[SUCCESS_PAGE] Retry button clicked, resetting retry count");
            }}
          >
            Retry
          </Button>
          <a
            href="mailto:support@elizaos.com"
            className="text-blue-500 hover:underline flex items-center"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-semibold mb-4">Verifying Subscription...</h1>
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-gray-600">Please wait while we confirm your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">Payment Successful</h1>
      <p className="text-gray-600 mb-6">
        Thank you for your subscription, {user.email || user.userId}!
      </p>
      <Link to="/home" className="text-blue-500">
        <Button>Return to Home</Button>
      </Link>
    </div>
  );
}