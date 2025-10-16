// client/src/components/chat-actions/plugin-starknet/walletIntentDetector.tsx
export const WalletIntentDetector = {
  detectCreateWallet: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes("create a chipi wallet") ||
      lowerText.includes("create chipi wallet") ||
      lowerText.includes("new chipi wallet") ||
      lowerText.includes("confirm chipi wallet creation") ||
      lowerText.includes("cancel chipi wallet creation") ||
      lowerText.includes("wallet created") // Keep this for success messages
    );
  },

  detectViewWallet: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes("view wallet") ||
      lowerText.includes("show wallet") ||
      lowerText.includes("wallet details") ||
      lowerText.includes("check wallet")
    );
  },

  detectApproveUSDC: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes("approve usdc") ||
      lowerText.includes("approve token") ||
      lowerText.includes("authorize contract") ||
      lowerText.includes("confirm token approval") ||
      lowerText.includes("cancel token approval")
    );
  },

  detectStakeVesuUSDC: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("stake usdc") || lowerText.includes("stake wallet");
  },

  extractWalletId: (text: string): string | undefined => {
    const walletIdMatch = text.match(/walletId:\s*([^\s]+)/i);
    return walletIdMatch ? walletIdMatch[1].replace(/^[<]+|[>]+$/g, "").trim() : undefined;
  },

  detectCreatePinConfirmation: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("confirm chipi wallet creation");
  },

  detectCancelPin: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("cancel chipi wallet creation");
  },

  detectApproveConfirmation: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("confirm token approval");
  },

  detectCancelApproval: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return lowerText.includes("cancel token approval");
  },
};