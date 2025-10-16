import { Content } from "@elizaos/core";

export interface ConnectStarknetWalletProps {
  agentId: string;
  onClose: (cancelled?: boolean) => void;
}

export interface StarknetButtonProps {
  agentId: string;
  onConnect?: (walletInfo: { id: string; name: string }) => void;
  onDisconnect?: () => void;
}

export interface WalletActionHandlerProps {
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