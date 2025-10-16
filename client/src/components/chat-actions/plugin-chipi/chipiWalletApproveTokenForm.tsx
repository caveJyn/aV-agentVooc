// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-actions/plugin-starknet/walletApproveTokenForm.tsx
import { Button } from "@/components/ui/button";
import { WalletActionFormProps } from "./types";

export function WalletApproveTokenForm({
  setInput,
  handleSendMessage,
}: WalletActionFormProps) {
  const handleConfirmApproval = () => {
    console.log("[WalletApproveTokenForm] Confirming token approval");
    setInput("confirm token approval");
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  const handleCancelApproval = () => {
    console.log("[WalletApproveTokenForm] Cancelling token approval");
    setInput("cancel token approval");
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  return (
    <div className="mt-2 flex gap-2">
      <Button
        variant="default"
        onClick={handleConfirmApproval}
        aria-label="Confirm Token Approval"
      >
        Confirm Token Approval
      </Button>
      <Button
        variant="outline"
        onClick={handleCancelApproval}
        aria-label="Cancel Token Approval"
      >
        Cancel
      </Button>
    </div>
  );
}