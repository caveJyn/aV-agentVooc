// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-actions/plugin-starknet/walletActionHandler.tsx
import { Content } from "@elizaos/core";
import { StarknetWalletIntentDetector } from "./starknetWalletIntentDetector";
import { ConnectStarknetWallet } from "./connectStarknetWallet";

interface WalletActionHandlerProps {
  agentId: string;
  message: Content & {
    user: string;
    createdAt: number;
    metadata?: {
      action?: string;
      promptStarknetConfirmation?: boolean;
      promptZkProof?: boolean;
      zkProofHash?: string;
      runesVerified?: boolean;
    };
  };
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}

export function WalletActionHandler({
  agentId,
  message,
  setInput,
  handleSendMessage,
}: WalletActionHandlerProps) {
  const text = message.text?.toLowerCase() || "";
  const { metadata = {} } = message;

  if (
    message.source === "CONNECT_STARKNET_WALLET" ||
    metadata.action === "CONNECT_STARKNET_WALLET" ||
    metadata.promptStarknetConfirmation ||
    metadata.promptZkProof ||
    StarknetWalletIntentDetector.detectConnectStarknet(text) ||
    StarknetWalletIntentDetector.detectConfirmStarknet(text) ||
    StarknetWalletIntentDetector.detectCancelStarknet(text)
  ) {
    return (
      <div>
        <p>{message.text}</p>
        {(metadata.promptStarknetConfirmation || metadata.promptZkProof) && (
          <ConnectStarknetWallet
            agentId={agentId}
            onClose={(cancelled?: boolean) => {
              setInput(
                cancelled
                  ? "cancel starknet connection"
                  : "confirm starknet connection"
              );
              handleSendMessage({
                preventDefault: (): void => {},
              } as React.FormEvent<HTMLFormElement>);
            }}
          />
        )}
      </div>
    );
  }

  return <p>{message.text}</p>;
}