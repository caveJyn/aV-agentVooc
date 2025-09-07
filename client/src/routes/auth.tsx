// /client/src/routes/auth.tsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { signInAndUp } from "supertokens-web-js/recipe/thirdparty";
import { doesSessionExist } from "supertokens-web-js/recipe/session";
import AuthForm from "@/components/auth-form";
import AuthSelection from "@/components/auth-selection";
import Navbar from "@/components/navbar";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    async function handleAuth() {
      const startTime = performance.now();
      console.log("[AUTH] Starting auth handling, path:", location.pathname, "state:", location.state);

      try {
        if (location.pathname === "/auth/callback/google") {
          console.log("[AUTH] Processing Google callback");
          const response = await signInAndUp();
          console.log("[AUTH] Google signInAndUp response:", response);

          if (response.status === "OK") {
            toast({
              title: "Success",
              description: response.createdNewRecipeUser ? "Signed up with Google!" : "Signed in with Google!",
            });
            const redirectTo = location.state?.selectedItem ? "/payment" : "/home";
            console.log("[AUTH] Google auth successful, redirecting to:", redirectTo);
            navigate(redirectTo, {
              state: { selectedItem: location.state?.selectedItem },
              replace: true,
            });
          } else {
            console.error("[AUTH] Google sign-in/up failed:", response);
            toast({
              variant: "destructive",
              title: "Error",
              description:
                response.status === "SIGN_IN_UP_NOT_ALLOWED"
                  ? response.reason
                  : response.status === "NO_EMAIL_GIVEN_BY_PROVIDER"
                  ? "No email provided by Google. Please use another login method."
                  : "Failed to process Google signup.",
            });
            navigate("/auth", { replace: true });
          }
          return;
        }

        const sessionExists = await doesSessionExist();
        console.log("[AUTH] Session exists:", sessionExists);

        if (sessionExists && location.pathname !== "/auth/callback/google") {
          const redirectTo = location.state?.selectedItem ? "/payment" : "/home";
          console.log("[AUTH] Session found, redirecting to:", redirectTo, "with selectedItem:", location.state?.selectedItem);
          navigate(redirectTo, {
            state: { selectedItem: location.state?.selectedItem },
            replace: true,
          });
        } else {
          console.log("[AUTH] No session or on callback path, rendering auth UI");
          setIsProcessing(false);
        }
      } catch (err: any) {
        console.error("[AUTH] Error during auth handling:", err);
        toast({
          variant: "destructive",
          title: "Error",
          description: err.isSuperTokensGeneralError ? err.message : "Authentication failed.",
        });
        navigate("/auth", { replace: true });
      } finally {
        const endTime = performance.now();
        console.log("[AUTH] Auth handling completed in", (endTime - startTime).toFixed(2), "ms");
      }
    }

    handleAuth();
  }, [navigate, location.pathname, location.state, toast]);

  if (isProcessing) {
    console.log("[AUTH] Processing auth, showing loading state");
    return (
      <div className="text-agentvooc-secondary flex items-center justify-center min-h-screen bg-gradient-to-br from-agentvooc-primary-bg to-agentvooc-primary-bg-dark">
        Loading...
      </div>
    );
  }

  if (location.pathname === "/auth/email") {
    console.log("[AUTH] Rendering email auth form");
    return (
      <div className="min-h-screen bg-gradient-to-br from-agentvooc-primary-bg to-agentvooc-primary-bg-dark text-agentvooc-primary relative">
        <Navbar />
     
        <section className="flex flex-col items-center justify-center text-center py-20 relative z-10">
          <h1 className="text-5xl font-bold mb-4">Email Sign In</h1>
          <p className="text-xl max-w-2xl mb-6 text-agentvooc-secondary">
            Sign in or sign up with your email to access AgentVooc.
          </p>
          <div className="absolute inset-0 opacity-20 flex items-center justify-center mt-64">
          <div className="w-64 h-64 bg-agentvooc-secondary rounded-full shadow-agentvooc-glow absolute " />
        </div>
        </section>
        <section id="auth" className="flex justify-center py-20 relative z-10">
          <AuthForm />
        </section>
      </div>
    );
  }

  if (location.pathname === "/auth/phantom") {
    console.log("[AUTH] Rendering Phantom Wallet placeholder");
    return (
      <div className="min-h-screen bg-gradient-to-br from-agentvooc-primary-bg to-agentvooc-primary-bg-dark text-agentvooc-primary relative">
        <Navbar />
       
        <section className="flex flex-col items-center justify-center text-center py-20 relative z-10">
          <h1 className="text-5xl font-bold mb-4">Connect Phantom Wallet</h1>
          <p className="text-xl max-w-2xl mb-6 text-agentvooc-secondary">
            Connect your Phantom Wallet to sign in to AgentVooc.
          </p>
          <div className="absolute inset-0 opacity-20 flex items-center justify-center mt-64">
          <div className="w-64 h-64 bg-agentvooc-secondary rounded-full shadow-agentvooc-glow absolute " />
        </div>
        </section>
        <section id="auth" className="flex justify-center py-20 relative z-10">
          <AuthForm isPhantom={true} />
        </section>
      </div>
    );
  }

  console.log("[AUTH] Rendering auth selection");
  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--agentvooc-primary-bg))] to-[hsl(var(--agentvooc-primary-bg-dark))] text-agentvooc-primary">
      <Navbar />
      <section className="flex flex-col items-center justify-center text-center py-20">
        <h1 className="text-5xl font-bold mb-4">Welcome to AgentVooc</h1>
        <p className="text-xl max-w-2xl mb-6 text-agentvooc-secondary">
          Discover the future of AI agent services with AgentVooc. Sign in or sign up to experience intelligent automation.
        </p>
      </section>
      <section id="auth" className="flex justify-center py-12">
        <AuthSelection />
      </section>
    </div>
  );
}