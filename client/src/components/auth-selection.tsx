// client/src/components/auth-selection.tsx
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent } from "./ui/card";
// import { SignIn } from "@clerk/clerk-react";

export default function AuthSelection() {
  const navigate = useNavigate();

  const handleEmailSignIn = () => {
    navigate("/auth");
  };

  return (
    <Card className="text-2xl font-bold shadow-lg">
      <CardHeader>
        <h2>Sign In to agentVooc</h2>
      </CardHeader>
      <CardContent className="space-y-4 py-4">
        <Button
          variant="default"
          size="lg"
          onClick={handleEmailSignIn}
        >
          Email Sign In
        </Button>
        {/* <SignIn
          signUpUrl="/auth"
          appearance={{
            elements: {
              socialButtonsBlockButton: "flex items-center w-full gap-2 mt-4 text-agentvooc-primary border-agentvooc-accent/30 hover:bg-agentvooc-accent hover:text-agentvooc-white",
              socialButtonsBlockButtonText: "Sign in with Google",
            },
          }}
        /> */}
      </CardContent>
    </Card>
  );
}