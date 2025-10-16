// client/src/components/chat-actions/plugin-starknet/walletActionHandler.tsx
import { WalletCreationForm } from "./chipiWalletCreationForm";
import { WalletApproveTokenForm } from "./chipiWalletApproveTokenForm";
import { WalletListDisplay } from "./chipiWalletListDisplay";
import { WalletActionProps } from "./types";
import AIWriter from "react-aiwriter";
import { CreateWallet } from "@/components/chat-Interface/chipi/createWallet";
import { ApproveUSDC } from "@/components/chat-Interface/chipi/approveUSDC";

export function WalletActionHandler({
  agentId,
  message,
  setInput,
  handleSendMessage,
}: WalletActionProps) {
  console.log("[WalletActionHandler] Processing message:", JSON.stringify(message, null, 2));

  if (
    !message.metadata?.action &&
    !message.metadata?.promptConfirmation &&
    !message.metadata?.promptApproveConfirmation &&
    !message.metadata?.promptPin &&
    !message.metadata?.wallets &&
    message.source !== "CHECK_WALLET"
  ) {
    console.log("[WalletActionHandler] No wallet action detected, rendering default text");
    return <AIWriter>{message.text}</AIWriter>;
  }

  if (message.metadata?.promptConfirmation) {
    console.log("[WalletActionHandler] Rendering WalletCreationForm for promptConfirmation");
    return (
      <div>
        <AIWriter>{message.text}</AIWriter>
        <WalletCreationForm
          action="CREATE_CHIPI_WALLET"
          metadata={message.metadata}
          setInput={setInput}
          handleSendMessage={handleSendMessage}
        />
      </div>
    );
  }

  if (message.metadata?.promptApproveConfirmation) {
    console.log("[WalletActionHandler] Rendering WalletApproveTokenForm for promptApproveConfirmation");
    return (
      <div>
        <AIWriter>{message.text}</AIWriter>
        <WalletApproveTokenForm
          action="APPROVE_TOKEN"
          metadata={message.metadata}
          setInput={setInput}
          handleSendMessage={handleSendMessage}
        />
      </div>
    );
  }

  if (message.metadata?.promptPin && message.metadata?.action === "CREATE_CHIPI_WALLET") {
    console.log("[WalletActionHandler] Rendering CreateWallet modal for promptPin");
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="z-50">
          <CreateWallet
            agentId={agentId}
            onClose={(cancelled = true) => {
              if (cancelled) {
                setInput("cancel chipi wallet creation");
                handleSendMessage({ preventDefault: () => {} } as any);
              }
            }}
          />
        </div>
        <div className="w-full max-w-md">
          <AIWriter>{message.text}</AIWriter>
        </div>
      </div>
    );
  }

  if (message.metadata?.promptPin && message.metadata?.action === "APPROVE_TOKEN") {
    console.log("[WalletActionHandler] Rendering ApproveUSDC modal for promptPin");
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="z-50">
          <ApproveUSDC
            agentId={agentId}
            onClose={(cancelled = true) => {
              if (cancelled) {
                setInput("cancel token approval");
                handleSendMessage({ preventDefault: () => {} } as any);
              }
            }}
          />
        </div>
        <div className="w-full max-w-md">
          <AIWriter>{message.text}</AIWriter>
        </div>
      </div>
    );
  }

  if (message.source === "CHECK_WALLET" && message.metadata?.wallets?.length) {
    console.log("[WalletActionHandler] Rendering WalletListDisplay for CHECK_WALLET");
    return (
      <WalletListDisplay
        wallets={message.metadata.wallets}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
      />
    );
  }

  if (message.metadata?.publicKey || message.metadata?.txHash) {
    console.log("[WalletActionHandler] Rendering success message");
    return <AIWriter>{message.text}</AIWriter>;
  }

  console.log("[WalletActionHandler] Falling back to AIWriter for message text");
  return <AIWriter>{message.text}</AIWriter>;
}