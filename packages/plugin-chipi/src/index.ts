import type { Plugin } from "@elizaos/core";
import { approveTokenAction } from "./actions/approveToken";
import { createChipiWalletAction } from "./actions/createChipiWallet";
// import { transferUSDCAction } from "./actions/transferUSDC";
// import { stakeVesuUsdcAction } from "./actions/stakeVesuUsdc";
// import { withdrawVesuUsdcAction } from "./actions/withdrawVesuUsdc";
import { webhookHandlerAction } from "./api/webhooks";
import { chipiProvider } from "./providers/chipiProvider";
// import { tokenProvider } from "./providers/tokenProvider";


export const chipiPlugin: Plugin = {
  name: "chipi",
  description: "Starknet L2 integration with Chipi Pay for payments/wallets and Atomiq DEX (roadmap)",
  actions: [
    approveTokenAction,
    createChipiWalletAction,
    // transferUSDCAction,
    webhookHandlerAction,
  ],
  providers: [chipiProvider],
};

export default chipiPlugin;