// // plugin-starknet/src/actions/transferUSDC.ts
// import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, UUID } from "@elizaos/core";
// import { useTransfer, useGetWallet } from "@chipi-stack/chipi-react";
// import { resolveUserIdFromCreatedBy } from "@elizaos-plugins/plugin-shared-email-sanity";
// import { elizaLogger } from "@elizaos/core";

// interface CustomTransferInput {
//   encryptKey: string;
//   wallet: { publicKey: string; encryptedPrivateKey: string };
//   contractAddress: string;
//   recipient: string;
//   amount: string;
//   decimals?: number;
//   bearerToken: string;
// }

// export const transferUSDCAction: Action = {
//   name: "TRANSFER_USDC",
//   similes: ["SEND_USDC"],
//   description: "Transfer USDC on Starknet using Chipi Pay",
//   validate: async (runtime: IAgentRuntime, message: Memory) => {
//     const text = message.content.text?.toLowerCase() || "";
//     return text.includes("transfer usdc") || text.includes("send usdc");
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
//         elizaLogger.info("[TRANSFER_USDC] CreatedBy value:", { createdBy });
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
//           text: `Please provide the missing parameters: ${missingParams.join(", ")} (e.g., 'Transfer USDC amount: 100 recipient: 0x... pin: 1234').`,
//           thought: `Missing parameters: ${missingParams.join(", ")}`,
//           source: "TRANSFER_USDC",
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

//       const { getWalletAsync, isLoading: walletLoading, error: walletError } = useGetWallet();
//       const { transferAsync, isLoading: transferLoading, error: transferError } = useTransfer();

//       interface CustomGetWalletResponse {
//         accountAddress?: string;
//         publicKey?: string;
//         encryptedPrivateKey?: string;
//       }

//       const bearerToken = options?.bearerToken || ""; // Ensure bearerToken is provided from options or another source
//       const wallet = await getWalletAsync({ externalUserId: userId, encryptKey: pin, bearerToken }) as CustomGetWalletResponse;
//       elizaLogger.info("[TRANSFER_USDC] Wallet response:", { wallet });
//       if (walletError) {
//         throw new Error(walletError.message);
//       }
//       if (!wallet?.accountAddress) {
//         throw new Error("No wallet found for this user. Please create or connect a wallet first.");
//       }

//       const USDC_CONTRACT = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";

//       const transferResponse = await transferAsync({
//         params: {
//           encryptKey: pin,
//           wallet: {
//             publicKey: wallet.publicKey || "",
//             encryptedPrivateKey: wallet.encryptedPrivateKey || "",
//           },
//           token: {
//             chain: "starknet",
//             symbol: "USDC",
//             contractAddress: USDC_CONTRACT,
//             decimals: 6,
//           },
//           recipient,
//           amount: String(amount),
//           decimals: 6,
//         },
//       });

//       if (transferError) {
//         throw new Error(transferError.message);
//       }

//       const response = {
//         text: `USDC transfer successful. Transaction Hash: ${transferResponse}`,
//         thought: "Transfer completed successfully",
//         source: "TRANSFER_USDC",
//         user: runtime.character.id,
//         createdAt: Date.now(),
//       };
//       if (callback) await callback(response);
//       return true;
//     } catch (error: any) {
//       elizaLogger.error("[TRANSFER_USDC] Error:", {
//         message: error.message,
//         stack: error.stack,
//       });
//       const errorResponse = {
//         text: `Failed to transfer USDC: ${error.message}`,
//         thought: "Transfer failed",
//         source: "TRANSFER_USDC",
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
//         content: { text: "Transfer USDC amount: 100 recipient: 0x... pin: 1234" },
//       },
//       {
//         user: "{{agent}}",
//         content: { text: "USDC transfer successful. Transaction Hash: 0x...", action: "TRANSFER_USDC" },
//       },
//     ],
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "Transfer USDC" },
//       },
//       {
//         user: "{{agent}}",
//         content: { text: "Please provide the missing parameters: amount, recipient, pin (e.g., 'Transfer USDC amount: 100 recipient: 0x... pin: 1234').", action: "TRANSFER_USDC" },
//       },
//     ],
//   ] as ActionExample[][],
// };