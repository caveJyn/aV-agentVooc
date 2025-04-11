export * from "./providers/token.ts";
export * from "./providers/wallet.ts";
export * from "./providers/trustScoreProvider.ts";
export * from "./evaluators/trust.ts";

import type { Plugin } from "@elizaos/core";

// Actions
// See: https://elizaos.github.io/eliza/docs/core/actions/

import getBalance from "./actions/getBalance.ts";
import transferToken from "./actions/transfer.ts";
import transferSol from "./actions/transfer_sol.ts";

import executeSwap from "./actions/swap.ts";

import take_order from "./actions/takeOrder";
import pumpfun from "./actions/pumpfun.ts";
import fomo from "./actions/fomo.ts";

// Evaluators
// See: https://elizaos.github.io/eliza/docs/core/evaluators/

// Note: Currently doesn't work as trustdb has been removed as a plugin
// import { trustEvaluator } from "./evaluators/trust.ts";

// Providers
// See: https://elizaos.github.io/eliza/docs/core/providers/

import { tokenProvider } from "./providers/token.ts";

// Note: Currently doesn't work as trustdb has been removed as a plugin
// import { trustScoreProvider } from "./providers/trustScoreProvider.ts";

export const solanaPlugin: Plugin = {
    name: "solana",
    description: "Solana Plugin for Eliza",
    actions: [
        getBalance,
        transferToken,
        transferSol,
        executeSwap,
    ],
    evaluators: [],
    providers: [tokenProvider],
};
export default solanaPlugin;