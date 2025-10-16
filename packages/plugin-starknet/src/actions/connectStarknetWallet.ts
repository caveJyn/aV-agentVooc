// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/packages/plugin-starknet/src/actions/connectStarknetWallet.ts
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

interface StarknetPendingReply {
  userId: UUID;
  characterId: UUID;
}

interface StarknetMetadata {
  action?: string;
  promptStarknetConfirmation?: boolean;
  promptZkProof?: boolean;
  pendingConnectionConfirmation?: StarknetPendingReply;
  pendingReplyId?: string;
  expiresAt?: number;
  zkProofHash?: string;
  runesVerified?: boolean;
}

interface StarknetMemory extends Memory {
  content: {
    text: string;
    metadata?: StarknetMetadata;
    source?: string;
    thought?: string;
    user?: string;
    createdAt?: number;
  };
}

function hasStarknetMetadataWithSuccess(metadata: StarknetMetadata | undefined): metadata is StarknetMetadata & { zkProofHash: string } {
  return !!(metadata && metadata.zkProofHash);
}

export const connectStarknetWalletAction: Action = {
  name: "CONNECT_STARKNET_WALLET",
  similes: ["CONNECT_STARKNET", "LINK_STARKNET_WALLET", "VERIFY_RUNES"],
  description: "Connects a Starknet wallet, verifies Runes anonymously with a ZK proof hash, and stores non-sensitive data.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isSuccessMessage = text.includes("starknet wallet connected") &&
                            text.includes("zkproof") &&
                            message.content.source === "CONNECT_STARKNET_WALLET";
    const isValidText = (
      text.includes("connect starknet") ||
      text.includes("link starknet wallet") ||
      text.includes("verify runes") ||
      text.includes("confirm starknet connection") ||
      text.includes("cancel starknet connection") ||
      isSuccessMessage
    );
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
    elizaLogger.info("[STARKNET-PLUGIN] Executing CONNECT_STARKNET_WALLET action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
      source: message.content.source,
    });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const characterId = runtime.character.id;
      const roomId = message.roomId || characterId;

      const createdBy = state?.createdBy || runtime.character.createdBy;
      const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
        throw new Error(`Invalid userId format: ${resolvedUserId}`);
      }
      const userId = resolvedUserId as UUID;
      elizaLogger.info("[CONNECT_STARKNET_WALLET] UserId resolved", { userId });

      const characterDoc = await sanityClient.fetch(
        `*[_type == "character" && id == $characterId][0]`,
        { characterId }
      );
      if (!characterDoc) {
        throw new Error("Character not found in Sanity");
      }

      let response: Content;

      if (
        text.includes("starknet wallet connected") &&
        message.content.source === "CONNECT_STARKNET_WALLET" &&
        hasStarknetMetadataWithSuccess(message.content.metadata)
      ) {
        const { zkProofHash, runesVerified } = message.content.metadata;
        elizaLogger.info("[CONNECT_STARKNET_WALLET] Processing success message", { zkProofHash, runesVerified });

        await sanityClient.createIfNotExists({
          _id: `starknet-wallet-${characterId}`,
          _type: "StarknetWallet",
          character: { _type: "reference", _ref: characterDoc._id },
          zkProofHash,
          runesVerified: !!runesVerified,
          createdAt: new Date().toISOString(),
        });

        response = {
          text: `✅ Starknet wallet connected! Connection verified with ZK proof. ${
            runesVerified ? "Runes verified anonymously." : "No Runes detected."
          }`,
          thought: "Starknet wallet connection confirmed with ZK proof hash.",
          source: "CONNECT_STARKNET_WALLET",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "CONNECT_STARKNET_WALLET",
            zkProofHash,
            runesVerified,
          },
        };
      } else if (text.includes("cancel starknet connection")) {
        response = {
          text: "❌ Starknet wallet connection cancelled. You can connect later by saying 'connect starknet wallet'.",
          thought: "Starknet connection cancelled by user.",
          source: "CONNECT_STARKNET_WALLET",
          user: userId,
          createdAt: Date.now(),
          metadata: { action: "CONNECT_STARKNET_WALLET" },
        };
      } else if (text.includes("confirm starknet connection")) {
        const recentMemories = await runtime.messageManager.getMemories({
          roomId,
          count: 100,
          start: Date.now() - 24 * 60 * 60 * 1000,
        }) as StarknetMemory[];

        const pendingMemory = recentMemories.find(
          (m) =>
            m.content.metadata?.promptStarknetConfirmation &&
            m.content.metadata.action === "CONNECT_STARKNET_WALLET" &&
            (!m.content.metadata.expiresAt || m.content.metadata.expiresAt > Date.now())
        );

        if (!pendingMemory) {
          response = {
            text: "No pending Starknet wallet connection found. Please say 'connect starknet wallet' to start the process.",
            thought: "No pending Starknet connection confirmation found.",
            source: "CONNECT_STARKNET_WALLET",
            user: userId,
            createdAt: Date.now(),
          };
        } else {
          response = {
            text: "Please confirm the wallet connection in the dialog.",
            thought: "Prompting user to confirm wallet connection via client-side dialog.",
            source: "CONNECT_STARKNET_WALLET",
            user: userId,
            createdAt: Date.now(),
            metadata: {
              action: "CONNECT_STARKNET_WALLET",
              promptZkProof: true,
            },
          };
        }
      } else {
        const pendingReplyId = stringToUuid(`PENDING_STARKNET_${userId}_${Date.now()}`);
        response = {
          text: "Would you like to connect your Starknet wallet for Runes verification? Say 'confirm starknet connection' to proceed or 'cancel starknet connection' to cancel.",
          thought: "Prompting user for Starknet connection confirmation.",
          source: "CONNECT_STARKNET_WALLET",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "CONNECT_STARKNET_WALLET",
            promptStarknetConfirmation: true,
            pendingConnectionConfirmation: { userId, characterId },
            pendingReplyId,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          },
        };
      }

      const notificationMemory: Memory = {
        id: stringToUuid(`CONNECT_STARKNET_RESPONSE_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId,
        userId,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.info("[CONNECT_STARKNET_WALLET] Response stored in memory", {
        memoryId: notificationMemory.id,
        userId,
        roomId,
        text: response.text,
      });

      if (callback) {
        await callback(response);
      } else {
        elizaLogger.warn("[CONNECT_STARKNET_WALLET] No callback provided, response stored in memory", { response });
      }

      return true;
    } catch (error: any) {
      elizaLogger.error("[CONNECT_STARKNET_WALLET] Action failed", {
        error: error.message,
        stack: error.stack,
        roomId: runtime.character.id,
      });

      const fallbackUserId = await resolveUserIdFromCreatedBy(state?.createdBy || runtime.character.createdBy).catch(() => stringToUuid("fallback-error-user"));
      const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackUserId)
        ? (fallbackUserId as UUID)
        : stringToUuid("error-fallback");

      const response: Content = {
        text: `❌ Sorry, couldn't connect Starknet wallet: ${error.message}. Please try again.`,
        thought: `Failed Starknet connection: ${error.message}`,
        source: "CONNECT_STARKNET_WALLET",
        user: userId,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory({
        id: stringToUuid(`CONNECT_STARKNET_ERROR_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId,
        createdAt: Date.now(),
      });

      if (callback) await callback(response);
      return false;
    }
  },

  examples: [
    [
      { user: "{{user1}}", content: { text: "connect starknet wallet" } },
      { user: "{{agent}}", content: { text: "Would you like to connect...? Say 'confirm...' or 'cancel...'", metadata: { promptStarknetConfirmation: true } } },
    ],
    [
      { user: "{{user1}}", content: { text: "confirm starknet connection" } },
      { user: "{{agent}}", content: { text: "Please confirm the wallet connection in the dialog.", metadata: { promptZkProof: true } } },
    ],
    [
      { user: "{{user1}}", content: { text: "cancel starknet connection" } },
      { user: "{{agent}}", content: { text: "❌ Starknet wallet connection cancelled." } },
    ],
    [
      { user: "{{agent}}", content: { text: "Starknet wallet connected. zkProof: ..., Runes verified.", source: "CONNECT_STARKNET_WALLET", metadata: { zkProofHash: "..." } } },
      { user: "{{agent}}", content: { text: "✅ Starknet wallet connected! Connection verified with ZK proof.", metadata: { zkProofHash: "..." } } },
    ],
  ] as ActionExample[][],
};