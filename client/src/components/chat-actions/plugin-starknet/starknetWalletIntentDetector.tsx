// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-actions/plugin-braavos/walletIntentDetector.tsx
export const StarknetWalletIntentDetector = {
  detectConnectStarknet: (text: string) =>
    text.toLowerCase().includes("connect starknet") ||
    text.toLowerCase().includes("link starknet wallet") ||
    text.toLowerCase().includes("verify runes"),
  detectConfirmStarknet: (text: string) =>
    text.toLowerCase().includes("confirm starknet connection"),
  detectCancelStarknet: (text: string) =>
    text.toLowerCase().includes("cancel starknet connection"),
};