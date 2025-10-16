import type { Plugin } from "@elizaos/core";
// import { transferUSDCAction } from "./actions/transferUSDC";
// import { stakeVesuUsdcAction } from "./actions/stakeVesuUsdc";
// import { withdrawVesuUsdcAction } from "./actions/withdrawVesuUsdc";
// import { webhookHandlerAction } from "./api/webhooks";
import { ChipiClientInterface } from "./client/index.ts";
// import { tokenProvider } from "./providers/tokenProvider";
import { CreateWalletModal } from "./ui/createWalletModal.tsx"; // <-- import it



export const chipiClientPlugin: Plugin = {
  name: "chipiclient",
  description: "Starknet L2 integration with Chipi Pay for payments/wallets and Atomiq DEX (roadmap)",
  actions: [
  ],
  clients: [ChipiClientInterface],
};

export { CreateWalletModal };
export default chipiClientPlugin;