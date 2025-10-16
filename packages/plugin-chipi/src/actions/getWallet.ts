// plugin-starknet/src/actions/connectWallet.ts
import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, UUID } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { createClient } from "@sanity/client";
import { resolveUserIdFromCreatedBy, type CreatedByRef } from "@elizaos-plugins/plugin-shared-email-sanity";

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

interface ExtendedState extends State {
  createdBy?: CreatedByRef;
}

interface ConnectMetadata {
  action?: string;
  promptConfirmation?: boolean;
  promptPin?: boolean;
  expiresAt?: number;
  address?: string;
}

export const connectWalletAction: Action = {
  name: "CONNECT_WALLET",
  similes: ["CONNECT_WALLET", "UNLOCK_WALLET"],
  description: "Connects to the user's wallet, prompting for PIN verification.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isValidText = text.includes("connect wallet") || text.includes("unlock wallet") || text.includes("confirm wallet connection");
    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId][0]`,
      { characterId: runtime.character.id }
    );
    return isValidText && characterDoc && !characterDoc.isLocked;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: ExtendedState,
    options?: any,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.info("[CONNECT_WALLET] Executing action", { messageText: message.content.text });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const characterId = runtime.character.id;
      const roomId = message.roomId || characterId;

      const createdBy = state?.createdBy || runtime.character.createdBy;
      const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
      const userId = resolvedUserId as UUID;

      const characterDoc = await sanityClient.fetch(
        `*[_type == "character" && id == $characterId][0]`,
        { characterId }
      );
      if (!characterDoc) {
        throw new Error("Character not found");
      }

      const existingWallet = await sanityClient.fetch(
        `*[_type == "Wallet" && character._ref == $characterRef][0]`,
        { characterRef: characterDoc._id }
      );

      let response: Content;

      if (!existingWallet) {
        response = {
          text: "No wallet found. Please create one first.",
          thought: "No wallet exists",
          source: "CONNECT_WALLET",
          user: userId,
          createdAt: Date.now(),
        };
      } else if (text.includes("confirm wallet connection")) {
        response = {
          text: "Please enter your 4-digit PIN in the dialog to connect your wallet.",
          thought: "Prompting PIN for connection",
          source: "CONNECT_WALLET",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "CONNECT_WALLET",
            promptPin: true,
          },
        };
      } else {
        response = {
          text: "Would you like to connect your wallet? Say 'confirm wallet connection' to proceed.",
          thought: "Prompting confirmation for connection",
          source: "CONNECT_WALLET",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "CONNECT_WALLET",
            promptConfirmation: true,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          },
        };
      }

      const notificationMemory: Memory = {
        id: stringToUuid(`CONNECT_WALLET_RESPONSE_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId,
        userId,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);

      if (callback) await callback(response);

      return true;
    } catch (error: any) {
      // Error handling similar to createWallet.ts
      // ...
      return false;
    }
  },

  examples: [
    // Similar to createWallet examples
  ] as ActionExample[][],
};