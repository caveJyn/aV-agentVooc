// // packages/plugin-starknet/src/actions/createWallet.ts
// import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, UUID } from "@elizaos/core";
// import { elizaLogger, stringToUuid } from "@elizaos/core";
// import { createClient } from "@sanity/client";
// import { resolveUserIdFromCreatedBy, type CreatedByRef } from "@elizaos-plugins/plugin-shared-email-sanity";

// export const sanityClient = createClient({
//   projectId: process.env.SANITY_PROJECT_ID,
//   dataset: process.env.SANITY_DATASET,
//   apiVersion: process.env.SANITY_API_VERSION,
//   useCdn: false,
//   token: process.env.SANITY_API_TOKEN,
// });

// interface ExtendedState extends State {
//   createdBy?: CreatedByRef;
// }

// interface WalletPendingReply {
//   userId: UUID;
//   characterId: UUID;
// }

// interface WalletMetadata {
//   action?: string;
//   promptConfirmation?: boolean;
//   promptPin?: boolean;
//   pendingChipiWalletConfirmation?: WalletPendingReply;
//   pendingReplyId?: string;
//   expiresAt?: number;
//   txHash?: string;
//   publicKey?: string;
// }

// interface WalletMemory extends Memory {
//   content: {
//     text: string;
//     metadata?: WalletMetadata;
//     source?: string;
//     thought?: string;
//     user?: string;
//     createdAt?: number;
//   };
// }

// function hasWalletMetadataWithSuccess(metadata: WalletMetadata | undefined): metadata is WalletMetadata & { txHash: string; publicKey: string } {
//   return !!(metadata && metadata.txHash && metadata.publicKey);
// }

// export const createChipiWalletAction: Action = {
//   name: "CREATE_CHIPI_WALLET",
//   similes: ["CREATE_CHIPI_WALLET", "MAKE_CHIPI_WALLET", "NEW_CHIPI_WALLET"],
//   description: "Creates a new Chipi wallet for the user on Starknet, prompting for PIN confirmation and handling success confirmation.",
//   suppressInitialMessage: true,

//   validate: async (runtime: IAgentRuntime, message: Memory) => {
//     const text = message.content.text?.toLowerCase() || "";
//     const isSuccessMessage = text.includes("your wallet was successfully created") &&
//                             text.includes("txhash") &&
//                             text.includes("publickey") &&
//                             message.content.source === "CREATE_CHIPI_WALLET";
//     const isValidText = (
//       text.includes("create a chipi wallet") ||
//       text.includes("create chipi wallet") ||
//       text.includes("new chipi wallet") ||
//       text.includes("confirm chipi wallet creation") ||
//       text.includes("cancel chipi wallet creation") ||
//       isSuccessMessage
//     );
//     const characterDoc = await sanityClient.fetch(
//       `*[_type == "character" && id == $characterId][0]`,
//       { characterId: runtime.character.id }
//     );
//     return isValidText && characterDoc && !characterDoc.isLocked;
//   },

//   handler: async (
//     runtime: IAgentRuntime,
//     message: Memory,
//     state?: ExtendedState,
//     options?: any,
//     callback?: HandlerCallback
//   ): Promise<boolean> => {
//     elizaLogger.info("[CREATE_CHIPI_WALLET] Executing CREATE_CHIPI_WALLET action", {
//       messageText: message.content.text,
//       roomId: runtime.character.id,
//       source: message.content.source,
//     });

//     try {
//       const text = message.content.text?.toLowerCase() || "";
//       const characterId = runtime.character.id;
//       const roomId = message.roomId || characterId;

//       const createdBy = state?.createdBy || runtime.character.createdBy;
//       const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
//       if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
//         throw new Error(`Invalid userId format: ${resolvedUserId}`);
//       }
//       const userId = resolvedUserId as UUID;
//       elizaLogger.info("[CREATE_CHIPI_WALLET] UserId resolved", { userId });

//       const characterDoc = await sanityClient.fetch(
//         `*[_type == "character" && id == $characterId][0]`,
//         { characterId }
//       );
//       if (!characterDoc) {
//         throw new Error("Character not found in Sanity");
//       }

//       const existingWallet = await sanityClient.fetch(
//         `*[_type == "Wallet" && character._ref == $characterRef][0]`,
//         { characterRef: characterDoc._id }
//       );

//       let response: Content;

//       if (
//         text.includes("your wallet was successfully created") &&
//         message.content.source === "CREATE_CHIPI_WALLET" &&
//         hasWalletMetadataWithSuccess(message.content.metadata)
//       ) {
//         const { txHash, publicKey } = message.content.metadata;
//         elizaLogger.info("[CREATE_CHIPI_WALLET] Processing success message", { txHash, publicKey });

//         await sanityClient.createIfNotExists({
//           _id: `wallet-${characterId}`,
//           _type: "Wallet",
//           character: { _type: "reference", _ref: characterDoc._id },
//           publicKey,
//           txHash,
//           createdAt: new Date().toISOString(),
//         });

//         response = {
//           text: `✅ Chipi wallet creation confirmed! Your wallet is ready. Transaction Hash: ${txHash}, Public Key: ${publicKey}.`,
//           thought: "Chipi wallet creation finalized and confirmed",
//           source: "CREATE_CHIPI_WALLET",
//           user: userId,
//           createdAt: Date.now(),
//           metadata: {
//             action: "CREATE_CHIPI_WALLET",
//             txHash,
//             publicKey,
//           },
//         };
//       } else if (existingWallet) {
//         response = {
//           text: "You have already created a Chipi wallet. What would you like to do with it? You could transfer, stake, or pay bills with it.",
//           thought: "Chipi wallet already exists for this character",
//           source: "CREATE_CHIPI_WALLET",
//           user: userId,
//           createdAt: Date.now(),
//         };
//       } else if (text.includes("cancel chipi wallet creation")) {
//         response = {
//           text: "❌ Chipi wallet creation cancelled. You can create a Chipi wallet later by saying 'create a chipi wallet'.",
//           thought: "Chipi wallet creation cancelled by user",
//           source: "CREATE_CHIPI_WALLET",
//           user: userId,
//           createdAt: Date.now(),
//           metadata: {
//             action: "CREATE_CHIPI_WALLET",
//           },
//         };
//       } else if (text.includes("confirm chipi wallet creation")) {
//         const recentMemories = await runtime.messageManager.getMemories({
//           roomId,
//           count: 100,
//           start: Date.now() - 24 * 60 * 60 * 1000,
//         }) as WalletMemory[];

//         const pendingMemory = recentMemories.find(
//           (m) =>
//             m.content.metadata?.promptConfirmation &&
//             m.content.metadata.action === "CREATE_CHIPI_WALLET" &&
//             (!m.content.metadata.expiresAt || m.content.metadata.expiresAt > Date.now())
//         );

//         if (!pendingMemory) {
//           response = {
//             text: "No pending Chipi wallet creation found. Please say 'create a chipi wallet' to start the process.",
//             thought: "No pending Chipi wallet creation confirmation found",
//             source: "CREATE_CHIPI_WALLET",
//             user: userId,
//             createdAt: Date.now(),
//           };
//         } else {
//           response = {
//             text: "Please enter your 4-digit PIN in the dialog to create your Chipi wallet.",
//             thought: "Prompting user to enter PIN via client-side dialog",
//             source: "CREATE_CHIPI_WALLET",
//             user: userId,
//             createdAt: Date.now(),
//             metadata: {
//               action: "CREATE_CHIPI_WALLET",
//               promptPin: true,
//             },
//           };
//         }
//       } else {
//         const pendingReplyId = stringToUuid(`PENDING_CHIPI_WALLET_${userId}_${Date.now()}`);
//         response = {
//           text: "You need to create a PIN to secure your Chipi wallet. Would you like to create a PIN now? Say 'confirm chipi wallet creation' to proceed or 'cancel chipi wallet creation' to cancel.",
//           thought: "Prompting user for PIN creation confirmation",
//           source: "CREATE_CHIPI_WALLET",
//           user: userId,
//           createdAt: Date.now(),
//           metadata: {
//             action: "CREATE_CHIPI_WALLET",
//             promptConfirmation: true,
//             pendingChipiWalletConfirmation: {
//               userId,
//               characterId,
//             },
//             pendingReplyId,
//             expiresAt: Date.now() + 24 * 60 * 60 * 1000,
//           },
//         };
//       }

//       const notificationMemory: Memory = {
//         id: stringToUuid(`CREATE_CHIPI_WALLET_RESPONSE_${Date.now()}`),
//         content: response,
//         agentId: runtime.agentId,
//         roomId,
//         userId,
//         createdAt: Date.now(),
//       };

//       await runtime.messageManager.createMemory(notificationMemory);
//       elizaLogger.info("[CREATE_CHIPI_WALLET] Response stored in memory", {
//         memoryId: notificationMemory.id,
//         userId,
//         roomId,
//         text: response.text,
//       });

//       if (callback) {
//         await callback(response);
//       } else {
//         elizaLogger.warn("[CREATE_CHIPI_WALLET] No callback provided, response stored in memory", {
//           response,
//         });
//       }

//       return true;
//     } catch (error: any) {
//       elizaLogger.error("[CREATE_CHIPI_WALLET] Action failed", {
//         error: error.message,
//         stack: error.stack,
//         roomId: runtime.character.id,
//       });

//       const fallbackUserId = await resolveUserIdFromCreatedBy(state?.createdBy || runtime.character.createdBy).catch(() => stringToUuid("fallback-error-user"));
//       const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackUserId)
//         ? (fallbackUserId as UUID)
//         : stringToUuid("error-fallback");

//       const response: Content = {
//         text: `❌ Sorry, I couldn't process the Chipi wallet creation request due to an error: ${error.message}. Please try again later.`,
//         thought: `Failed to process Chipi wallet creation: ${error.message}`,
//         source: "CREATE_CHIPI_WALLET",
//         user: userId,
//         createdAt: Date.now(),
//       };

//       const errorMemory: Memory = {
//         id: stringToUuid(`CREATE_CHIPI_WALLET_ERROR_${Date.now()}`),
//         content: response,
//         agentId: runtime.agentId,
//         roomId: runtime.character.id,
//         userId,
//         createdAt: Date.now(),
//       };

//       await runtime.messageManager.createMemory(errorMemory);
//       if (callback) await callback(response);
//       return false;
//     }
//   },

//   examples: [
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "create a chipi wallet", action: "CREATE_CHIPI_WALLET" },
//       },
//       {
//         user: "{{agent}}",
//         content: {
//           text: "You need to create a PIN to secure your Chipi wallet. Would you like to create a PIN now? Say 'confirm chipi wallet creation' to proceed or 'cancel chipi wallet creation' to cancel.",
//           action: "CREATE_CHIPI_WALLET",
//           metadata: { promptConfirmation: true, pendingChipiWalletConfirmation: {} },
//         },
//       },
//     ],
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "confirm chipi wallet creation", action: "CREATE_CHIPI_WALLET" },
//       },
//       {
//         user: "{{agent}}",
//         content: {
//           text: "Please enter your 4-digit PIN in the dialog to create your Chipi wallet.",
//           action: "CREATE_CHIPI_WALLET",
//           metadata: { promptPin: true },
//         },
//       },
//     ],
//     [
//       {
//         user: "{{user1}}",
//         content: { text: "cancel chipi wallet creation", action: "CREATE_CHIPI_WALLET" },
//       },
//       {
//         user: "{{agent}}",
//         content: {
//           text: "❌ Chipi wallet creation cancelled.",
//           action: "CREATE_CHIPI_WALLET",
//         },
//       },
//     ],
//     [
//       {
//         user: "{{agent}}",
//         content: {
//           text: "Your Chipi wallet was successfully created. Your txHash is \"0x...\" and your publicKey is \"0x...\".",
//           action: "CREATE_CHIPI_WALLET",
//           source: "CREATE_CHIPI_WALLET",
//           metadata: { action: "CREATE_CHIPI_WALLET", txHash: "0x...", publicKey: "0x..." },
//         },
//       },
//       {
//         user: "{{agent}}",
//         content: {
//           text: "✅ Chipi wallet creation confirmed! Your wallet is ready. Transaction Hash: 0x..., Public Key: 0x....",
//           action: "CREATE_CHIPI_WALLET",
//           source: "CREATE_CHIPI_WALLET",
//           metadata: { action: "CREATE_CHIPI_WALLET", txHash: "0x...", publicKey: "0x..." },
//         },
//       },
//     ],
//   ] as ActionExample[][],
// };