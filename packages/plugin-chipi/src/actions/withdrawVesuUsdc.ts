// // plugin-starknet/src/actions/withdrawVesuUsdc.ts
// import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, UUID } from "@elizaos/core";
// import { useWithdrawVesuUsdc, useGetWallet } from "@chipi-stack/chipi-react";
// import { resolveUserIdFromCreatedBy } from "@elizaos-plugins/plugin-shared-email-sanity";
// import { elizaLogger } from "@elizaos/core";
// import { getBearerToken } from "../utils/getBearerToken";

// export const withdrawVesuUsdcAction: Action = {
//   name: "WITHDRAW_VESU_USDC",
//   similes: ["UNSTAKE_USDC"],
//   description: "Withdraws USDC tokens from the VESU protocol",
//   validate: async (runtime: IAgentRuntime, message: Memory) => {
//     const text = message.content.text?.toLowerCase() || "";
//     return text.includes("withdraw usdc") || text.includes("unstake usdc");
//   },
//   handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback): Promise<boolean> => {
//     try {
//       const text = message.content.text || "";
//       const amountMatch = text.match(/amount:\s*(\d+)/i);
//       const recipientMatch = text.match(/recipient:\s*(\S+)/i);
//       const pinMatch = text.match(/pin:\s*(\S+)/i);

//       // Resolve userId from message or createdBy
//       let userId: UUID;
//       if (message.userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.userId)) {
//         userId = message.userId as UUID;
//       } else {
//         const createdBy = runtime.character.createdBy;
//         elizaLogger.info("[WITHDRAW_VESU_USDC] CreatedBy value:", { createdBy });
//         const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
//         if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
//           throw new Error(`Invalid userId format: ${resolvedUserId}`);
//         }
//         userId = resolvedUserId as UUID;
//       }

//       // Check for missing parameters
//       if (!amountMatch || !recipientMatch || !pinMatch) {
//         const missingParams = [];
//         if (!amountMatch) missingParams.push("amount");
//         if (!recipientMatch) missingParams.push("recipient");
//         if (!pinMatch) missingParams.push("pin");
//         const response = {
//           text: `Please provide the missing parameters: ${missingParams.join(", ")} (e.g., 'Withdraw USDC amount: 100 recipient: 0x... pin: 1234').`,
//           thought: `Missing parameters: ${missingParams.join(", ")}`,
//           source: "WITHDRAW_VESU_USDC",
//           user: runtime.character.id,
//           createdAt: Date.now(),
//         };
//         if (callback) await callback(response);
//         return false;
//       }

//       const amount = amountMatch[1];
//       const recipient = recipientMatch[1];
//       const pin = pinMatch[1];

//       // Get bearerToken using helper function
//       const bearerToken = await getBearerToken(userId, options);

//       const { getWalletAsync, isLoading: walletLoading, error: walletError } = useGetWallet();
//       const { withdrawVesuUsdcAsync, isLoading: withdrawLoading, isError } = useWithdrawVesuUsdc();

//       interface CustomGetWalletResponse {
//         accountAddress?: string;
//         publicKey?: string;
//         encryptedPrivateKey?: string;
//       }

//       const wallet = await getWalletAsync({ externalUserId: userId, encryptKey: pin, bearerToken }) as CustomGetWalletResponse;
//       elizaLogger.info("[WITHDRAW_VESU_USDC] Wallet response:", { wallet });
//       if (walletError) {
//         throw new Error(walletError.message);
//       }
//       if (!wallet?.accountAddress) {
//         throw new Error("No wallet found for this user. Please create or connect a wallet first.");
//       }

//       const withdrawResponse = await withdrawVesuUsdcAsync({
//         encryptKey: pin,
//         wallet: {
//           publicKey: wallet.publicKey || "",
//           encryptedPrivateKey: wallet.encryptedPrivateKey || "",
//         },
//         amount: String(amount),
//         recipient,
//         bearerToken,
//       });

//       if (isError) {
//         throw new Error("Withdrawal failed");
//       }

//       const response = {
//         text: `USDC withdrawal successful. Transaction Hash: ${withdrawResponse}`,
//         thought: "Withdrawal completed successfully",
//         source: "WITHDRAW_VESU_USDC",
//         user: runtime.character.id,
//         createdAt: Date.now(),
//       };
//       if (callback) await callback(response);
//       return true;
//     } catch (error: any) {
//       elizaLogger.error("[WITHDRAW_VESU_USDC] Error:", {
//         message: error.message,
//         stack: error.stack,
//       });
//       const errorResponse = {
//         text: `Failed to withdraw USDC: ${error.message}`,
//         thought: "Withdrawal failed",
//         source: "WITHDRAW_VESU_USDC",
//         user: runtime.character.id,
//         createdAt: Date.now(),
//       };
//       if (callback) await callback(errorResponse);
//       return false;
//     }
//   },
//   examples: [
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "Withdraw USDC amount: 100 recipient: 0x... pin: 1234" },
//       },
//       {
//         user: "{{agent}}",
//         content: { text: "USDC withdrawal successful. Transaction Hash: 0x...", action: "WITHDRAW_VESU_USDC" },
//       },
//     ],
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "Withdraw USDC" },
//       },
//       {
//         user: "{{agent}}",
//         content: { text: "Please provide the missing parameters: amount, recipient, pin (e.g., 'Withdraw USDC amount: 100 recipient: 0x... pin: 1234').", action: "WITHDRAW_VESU_USDC" },
//       },
//     ],
//   ] as ActionExample[][],
// };