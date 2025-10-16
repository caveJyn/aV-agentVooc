// client/src/components/chat-actions/plugin-starknet/walletCreationForm.tsx
import { Button } from "@/components/ui/button";
import { WalletActionFormProps } from "./types";

export function WalletCreationForm({
  setInput,
  handleSendMessage,
}: WalletActionFormProps) {
  const handleConfirmCreation = () => {
    console.log("[WalletCreationForm] Confirming Chipi wallet creation");
    setInput("confirm chipi wallet creation");
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  const handleCancelCreation = () => {
    console.log("[WalletCreationForm] Cancelling Chipi wallet creation");
    setInput("cancel chipi wallet creation");
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  return (
    <div className="mt-2 flex gap-2">
      <Button
        variant="default"
        onClick={handleConfirmCreation}
        aria-label="Confirm Chipi Wallet Creation"
      >
        Confirm Chipi Wallet Creation
      </Button>
      <Button
        variant="outline"
        onClick={handleCancelCreation}
        aria-label="Cancel Chipi Wallet Creation"
      >
        Cancel
      </Button>
    </div>
  );
}