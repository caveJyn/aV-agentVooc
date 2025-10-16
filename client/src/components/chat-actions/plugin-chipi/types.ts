import { CreateWalletParams } from "@chipi-stack/chipi-react";




export interface WalletActionFormProps {
  action: string;
  metadata?: WalletMetadata;
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}


export interface CreateWalletInput {
  params: CreateWalletParams;
  bearerToken: string;
}


export interface CreateWalletProps {
  agentId: string;
  onClose: (cancelled?: boolean) => void;
}

export interface WalletMetadata {
  action?: string;
  externalUserId?: string;
  walletId?: string;
  wallets?: Array<{
    walletId: string;
    address?: string;
    balance?: string;
    status?: string;
    details?: string;
  }>;
  publicKey?: string;
  txHash?: string;
  promptConfirmation?: boolean;
  promptApproveConfirmation?: boolean;
  promptPin?: boolean;
  amount?: string;
  contractAddress?: string;
  spender?: string;
}

export interface ContentWithUser {
  text: string;
  user: string;
  createdAt: number;
  isLoading?: boolean;
  source?: string;
  metadata?: {
    action?: string;
    externalUserId?: string;
    wallets?: Array<{
      walletId: string;
      address?: string;
      balance?: string;
      status?: string;
      details?: string;
    }>;
    walletId?: string;
    emails?: any[];
    emailId?: string;
    pendingReply?: any;
    imageAssetId?: string;
    publicKey?: string;
    txHash?: string;
    promptConfirmation?: boolean;
    promptApproveConfirmation?: boolean;
    promptPin?: boolean;
    amount?: string;
    contractAddress?: string;
    spender?: string;
  };
}

export interface WalletActionProps {
  agentId: string;
  message: {
    text: string;
    source?: string;
    metadata?: {
      action?: string;
      externalUserId?: string;
      wallets?: Array<{
        walletId: string;
        address?: string;
        balance?: string;
        status?: string;
        details?: string;
      }>;
      promptConfirmation?: boolean;
      promptApproveConfirmation?: boolean;
      promptPin?: boolean;
      publicKey?: string;
      txHash?: string;
      amount?: string;
      contractAddress?: string;
      spender?: string;
      imageAssetId?: string;
    };
  };
  setInput: (value: string) => void;
  handleSendMessage: (event: any) => void;
}

export interface WalletListDisplayProps {
  wallets: Array<{
    walletId: string;
    address?: string;
    balance?: string;
    status?: string;
    details?: string;
  }>;
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}