import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signUp, signIn } from "supertokens-web-js/recipe/emailpassword";
import { getAuthorisationURLWithQueryParamsAndSetState } from "supertokens-web-js/recipe/thirdparty";
import { useNavigate, useLocation } from "react-router-dom";
import { doesSessionExist } from "supertokens-web-js/recipe/session";
import { apiClient } from "@/lib/api";
import { Item } from "@/types/index.ts";

interface AuthFormData {
  name: string;
  email: string;
  password: string;
}

interface AuthFormProps {
  defaultIsSignUp?: boolean;
  isPhantom?: boolean; // New prop to toggle Phantom dialog
}

export default function AuthForm({ defaultIsSignUp = false, isPhantom = false }: AuthFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSignUp, setIsSignUp] = useState(
    location.state?.defaultIsSignUp ?? defaultIsSignUp
  );
  const [formData, setFormData] = useState<AuthFormData>({
    name: "",
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log("[AUTH_FORM] Starting sign-up process, location.state:", location.state);
      const response = await signUp({
        formFields: [
          { id: "email", value: formData.email },
          { id: "password", value: formData.password },
          { id: "name", value: formData.name },
        ],
      });

      if (response.status === "FIELD_ERROR") {
        console.log("[AUTH_FORM] Sign-up field error:", response.formFields);
        response.formFields.forEach((formField) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: formField.error,
          });
        });
      } else if (response.status === "SIGN_UP_NOT_ALLOWED") {
        console.log("[AUTH_FORM] Sign-up not allowed:", response.reason);
        toast({
          variant: "destructive",
          title: "Error",
          description: response.reason,
        });
      } else {
        let attempts = 0;
        const maxAttempts = 5;
        const checkSession = async () => {
          const sessionExists = await doesSessionExist();
          console.log("[AUTH_FORM] Session check attempt", attempts + 1, "Session exists:", sessionExists);
          if (sessionExists || attempts >= maxAttempts) {
            if (sessionExists) {
              toast({
                title: "Success!",
                description: "Sign up successful! Redirecting...",
              });
              window.dispatchEvent(new Event("signupSuccess"));

              const selectedItem: Item | undefined = location.state?.selectedItem;
              console.log("[AUTH_FORM] Selected item:", selectedItem);
              if (selectedItem) {
                try {
                  const userData = await apiClient.getUser();
                  const userId = userData.user?.userId;
                  if (!userId) {
                    throw new Error("User ID not found after sign-up");
                  }

                  console.log("[AUTH_FORM] Initiating checkout for:", { userId, selectedItem });
                  const checkoutResponse = await apiClient.createCheckoutSession({
                    userId,
                    items: [{
                      id: selectedItem.id,
                      name: selectedItem.name,
                      description: selectedItem.description,
                      price: selectedItem.price,
                      itemType: selectedItem.itemType,
                    }],
                  });

                  if (checkoutResponse.checkoutUrl) {
                    console.log("[AUTH_FORM] Redirecting to Stripe Checkout:", checkoutResponse.checkoutUrl);
                    window.location.assign(checkoutResponse.checkoutUrl);
                  } else {
                    throw new Error("Checkout URL not returned");
                  }
                } catch (checkoutError: any) {
                  console.error("[AUTH_FORM] Checkout error:", checkoutError);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to initiate checkout. Please try again.",
                  });
                  console.log("[AUTH_FORM] Redirecting to /home due to checkout error");
                  navigate("/home", { replace: true });
                }
              } else {
                console.log("[AUTH_FORM] No selected item, redirecting to /home");
                navigate("/home", { replace: true, state: {} });
              }
            } else {
              console.log("[AUTH_FORM] Session not established after max attempts");
              toast({
                variant: "destructive",
                title: "Error",
                description: "Session not established. Please sign in.",
              });
              navigate("/auth", { replace: true });
            }
            setIsSubmitting(false);
          } else {
            attempts++;
            setTimeout(checkSession, 500);
          }
        };
        checkSession();
      }
    } catch (err: any) {
      console.error("[AUTH_FORM] Signup error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err.isSuperTokensGeneralError === true
            ? err.message
            : "Failed to sign up. Please try again.",
      });
      setIsSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log("[AUTH_FORM] Starting sign-in process, location.state:", location.state);
      const response = await signIn({
        formFields: [
          { id: "email", value: formData.email },
          { id: "password", value: formData.password },
        ],
      });

      if (response.status === "FIELD_ERROR") {
        console.log("[AUTH_FORM] Sign-in field error:", response.formFields);
        response.formFields.forEach((formField) => {
          toast({
            variant: "destructive",
            title: "Error",
            description: formField.error,
          });
        });
      } else if (response.status === "WRONG_CREDENTIALS_ERROR") {
        console.log("[AUTH_FORM] Wrong credentials error");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Email or password is incorrect.",
        });
      } else if (response.status === "SIGN_IN_NOT_ALLOWED") {
        console.log("[AUTH_FORM] Sign-in not allowed:", response.reason);
        toast({
          variant: "destructive",
          title: "Error",
          description: response.reason,
        });
      } else {
        toast({
          title: "Success!",
          description: "Sign in successful! Redirecting...",
        });
        const redirectTo = location.state?.selectedItem ? "/payment" : "/home";
        console.log("[AUTH_FORM] Sign-in successful, redirecting to:", redirectTo);
        navigate(redirectTo, {
          state: { selectedItem: location.state?.selectedItem },
          replace: true,
        });
      }
    } catch (err: any) {
      console.error("[AUTH_FORM] Signin error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err.isSuperTokensGeneralError === true
            ? err.message
            : "Failed to sign in. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      console.log("[AUTH_FORM] Initiating Google sign-in");
      const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
        thirdPartyId: "google",
        frontendRedirectURI: "http://localhost:5173/auth/callback/google",
      });
      window.location.assign(authUrl);
    } catch (err: any) {
      console.error("[AUTH_FORM] Google sign-in error:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err.isSuperTokensGeneralError === true
            ? err.message
            : "Failed to initiate Google login.",
      });
    }
  };

  const handleSubmit = isSignUp ? handleSignUp : handleSignIn;

  if (isPhantom) {
    return (
      <Card className="w-full max-w-md bg-agentvooc-secondary-accent border-agentvooc-accent/10 shadow-agentvooc-glow">
        <CardHeader>
          <CardTitle className="text-agentvooc-primary text-2xl">Phantom Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-agentvooc-secondary">Phantom Wallet integration is coming soon!</p>
          <Button
            onClick={() => navigate("/auth")}
            className="w-full bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full py-3"
          >
            Back to Sign-In Options
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md bg-agentvooc-secondary-accent border-agentvooc-accent/10 shadow-agentvooc-glow">
      <CardHeader>
        <CardTitle className="text-agentvooc-primary text-2xl">{isSignUp ? "Sign Up" : "Sign In"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <Label htmlFor="name" className="text-agentvooc-secondary">Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="bg-agentvooc-primary-bg text-agentvooc-primary border-agentvooc-accent/30 focus:ring-agentvooc-accent"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-agentvooc-secondary">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="bg-agentvooc-primary-bg text-agentvooc-primary border-agentvooc-accent/30 focus:ring-agentvooc-accent"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-agentvooc-secondary">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="bg-agentvooc-primary-bg text-agentvooc-primary border-agentvooc-accent/30 focus:ring-agentvooc-accent"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full py-3"
          >
            {isSubmitting ? "Submitting..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
        </form>
        <Button
          variant="outline"
          className="w-full flex items-center gap-2 mt-4 border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg"
          onClick={handleGoogleSignIn}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
            />
          </svg>
          Sign in with Google
        </Button>
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-agentvooc-secondary hover:text-agentvooc-accent"
          >
            {isSignUp
              ? "Already have an account? Sign In"
              : "Need an account? Sign Up"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}