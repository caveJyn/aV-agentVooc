import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AuthSelection() {
  const navigate = useNavigate();

  const handleEmailSignIn = () => {
    navigate("/auth/email");
  };

  const handlePhantomWallet = () => {
    navigate("/auth/phantom");
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-agentvooc-secondary-accent rounded-lg shadow-agentvooc-glow border  max-w-md w-full">
      <h2 className="text-3xl font-semibold mb-4 text-agentvooc-primary">Sign In to agentVooc</h2>
      <Button
        onClick={handleEmailSignIn}
        className="w-full bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full py-3 "
      >
        Email Sign In
      </Button>
      <Button
        onClick={handlePhantomWallet}
        className="w-full bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full py-3 "
      >
        Connect to Phantom Wallet
      </Button>
    </div>
  );
}