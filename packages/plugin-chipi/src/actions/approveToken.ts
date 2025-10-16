// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/packages/plugin-starknet/src/actions/approveToken.ts
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

const VESU_CONTRACT = "0x037ae3f583c8d644b7556c93a04b83b52fa96159b2b0cbd83c14d3122aef80a2";

interface ExtendedState extends State {
  createdBy?: CreatedByRef;
}

interface ApprovePendingReply {
  userId: UUID;
  characterId: UUID;
  amount: string;
  contractAddress: string;
  spender: string;
}

interface ApproveMetadata {
  action?: string;
  promptApproveConfirmation?: boolean;
  promptPin?: boolean;
  pendingApproveConfirmation?: ApprovePendingReply;
  pendingReplyId?: string;
  expiresAt?: number;
  txHash?: string;
  amount?: string;
  contractAddress?: string;
  spender?: string;
}

interface ApproveMemory extends Memory {
  content: {
    text: string;
    metadata?: ApproveMetadata;
    source?: string;
    thought?: string;
    user?: string;
    createdAt?: number;
  };
}

// Type guard to ensure metadata has txHash
function hasApproveMetadataWithSuccess(metadata: ApproveMetadata | undefined): metadata is ApproveMetadata & { txHash: string } {
  return !!(metadata && metadata.txHash);
}

export const approveTokenAction: Action = {
  name: "APPROVE_TOKEN",
  similes: ["APPROVE_USDC", "AUTHORIZE_CONTRACT"],
  description: "Grants permission to a smart contract to spend USDC tokens from the user wallet",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isSuccessMessage = text.includes("token approval successful") &&
                            text.includes("transaction hash") &&
                            message.content.source === "APPROVE_TOKEN";
    const isValidText = (
      text.includes("approve token") ||
      text.includes("approve usdc") ||
      text.includes("authorize contract") ||
      text.includes("confirm token approval") ||
      text.includes("cancel token approval") ||
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
    elizaLogger.info("[APPROVE_TOKEN] Executing APPROVE_TOKEN action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
      source: message.content.source,
    });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const characterId = runtime.character.id;
      const roomId = message.roomId || characterId;

      // Resolve userId from createdBy
      const createdBy = state?.createdBy || runtime.character.createdBy;
      const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedUserId)) {
        throw new Error(`Invalid userId format: ${resolvedUserId}`);
      }
      const userId = resolvedUserId as UUID;
      elizaLogger.info("[APPROVE_TOKEN] UserId resolved", { userId });

      // Fetch character document from Sanity
      const characterDoc = await sanityClient.fetch(
        `*[_type == "character" && id == $characterId][0]`,
        { characterId }
      );
      if (!characterDoc) {
        throw new Error("Character not found in Sanity");
      }

      // Check for existing wallet
      const existingWallet = await sanityClient.fetch(
        `*[_type == "Wallet" && character._ref == $characterRef][0]`,
        { characterRef: characterDoc._id }
      );

      let response: Content;

      // Handle success message
      if (
        text.includes("token approval successful") &&
        message.content.source === "APPROVE_TOKEN" &&
        hasApproveMetadataWithSuccess(message.content.metadata)
      ) {
        const { txHash } = message.content.metadata;
        elizaLogger.info("[APPROVE_TOKEN] Processing success message", { txHash });

        response = {
          text: `✅ Token approval confirmed! Transaction Hash: ${txHash}.`,
          thought: "Token approval finalized and confirmed",
          source: "APPROVE_TOKEN",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "APPROVE_TOKEN",
            txHash,
          },
        };
      } else if (!existingWallet) {
        response = {
          text: "No wallet found. Please create a wallet first by saying 'create a wallet'.",
          thought: "No wallet exists for this character",
          source: "APPROVE_TOKEN",
          user: userId,
          createdAt: Date.now(),
        };
      } else if (text.includes("cancel token approval")) {
        response = {
          text: "❌ Token approval cancelled. You can approve tokens later by saying 'approve usdc'.",
          thought: "Token approval cancelled by user",
          source: "APPROVE_TOKEN",
          user: userId,
          createdAt: Date.now(),
          metadata: {
            action: "APPROVE_TOKEN",
          },
        };
      } else if (text.includes("confirm token approval")) {
        // Check for pending confirmation in recent memories
        const recentMemories = await runtime.messageManager.getMemories({
          roomId,
          count: 100,
          start: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
        }) as ApproveMemory[];

        const pendingMemory = recentMemories.find(
          (m) =>
            m.content.metadata?.promptApproveConfirmation &&
            m.content.metadata.action === "APPROVE_TOKEN" &&
            (!m.content.metadata.expiresAt || m.content.metadata.expiresAt > Date.now())
        );

        if (!pendingMemory) {
          response = {
            text: "No pending token approval found. Please say 'approve usdc' to start the process.",
            thought: "No pending token approval confirmation found",
            source: "APPROVE_TOKEN",
            user: userId,
            createdAt: Date.now(),
          };
        } else {
          response = {
            text: "Please enter your 4-digit PIN and the amount to approve in the dialog.",
            thought: "Prompting user to enter PIN and amount via client-side dialog",
            source: "APPROVE_TOKEN",
            user: userId,
            createdAt: Date.now(),
            metadata: {
              action: "APPROVE_TOKEN",
              promptPin: true,
            },
          };
        }
      } else {
        // Extract parameters from the message
        const amountMatch = text.match(/amount:\s*(\d+(\.\d+)?)/i);
        const contractAddressMatch = text.match(/contractaddress:\s*(\S+)/i);
        const spenderMatch = text.match(/spender:\s*(\S+)/i);

        const amount = amountMatch ? amountMatch[1] : null;
        const contractAddress = contractAddressMatch ? contractAddressMatch[1] : VESU_CONTRACT;
        const spender = spenderMatch ? spenderMatch[1] : VESU_CONTRACT;

        // Validate parameters
        if (!amount) {
          response = {
            text: `Please provide the amount to approve (e.g., 'approve usdc amount: 100').`,
            thought: "Missing amount parameter for token approval",
            source: "APPROVE_TOKEN",
            user: userId,
            createdAt: Date.now(),
          };
        } else {
          // Initial request - prompt for confirmation
          const pendingReplyId = stringToUuid(`PENDING_APPROVE_${userId}_${Date.now()}`);
          response = {
            text: `Would you like to approve ${amount} USDC for the contract ${contractAddress}? Say 'confirm token approval' to proceed or 'cancel token approval' to cancel.`,
            thought: "Prompting user for token approval confirmation",
            source: "APPROVE_TOKEN",
            user: userId,
            createdAt: Date.now(),
            metadata: {
              action: "APPROVE_TOKEN",
              promptApproveConfirmation: true,
              pendingApproveConfirmation: {
                userId,
                characterId,
                amount,
                contractAddress,
                spender,
              },
              pendingReplyId,
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            },
          };
        }
      }

      const notificationMemory: Memory = {
        id: stringToUuid(`APPROVE_TOKEN_RESPONSE_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId,
        userId,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.info("[APPROVE_TOKEN] Response stored in memory", {
        memoryId: notificationMemory.id,
        userId,
        roomId,
        text: response.text,
      });

      if (callback) {
        await callback(response);
      } else {
        elizaLogger.warn("[APPROVE_TOKEN] No callback provided, response stored in memory", {
          response,
        });
      }

      return true;
    } catch (error: any) {
      elizaLogger.error("[APPROVE_TOKEN] Action failed", {
        error: error.message,
        stack: error.stack,
        roomId: runtime.character.id,
      });

      // Fallback userId resolution
      const fallbackUserId = await resolveUserIdFromCreatedBy(state?.createdBy || runtime.character.createdBy).catch(() => stringToUuid("fallback-error-user"));
      const userId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fallbackUserId)
        ? (fallbackUserId as UUID)
        : stringToUuid("error-fallback");

      const response: Content = {
        text: `❌ Sorry, I couldn't process the token approval request due to an error: ${error.message}. Please try again later.`,
        thought: `Failed to process token approval: ${error.message}`,
        source: "APPROVE_TOKEN",
        user: userId,
        createdAt: Date.now(),
      };

      const errorMemory: Memory = {
        id: stringToUuid(`APPROVE_TOKEN_ERROR_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(errorMemory);
      if (callback) await callback(response);
      return false;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "approve usdc amount: 100" },
      },
      {
        user: "{{agent}}",
        content: {
          text: `Would you like to approve 100 USDC for the contract ${VESU_CONTRACT}? Say 'confirm token approval' to proceed or 'cancel token approval' to cancel.`,
          action: "APPROVE_TOKEN",
          metadata: { promptApproveConfirmation: true, pendingApproveConfirmation: {} },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "confirm token approval" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "Please enter your 4-digit PIN and the amount to approve in the dialog.",
          action: "APPROVE_TOKEN",
          metadata: { promptPin: true },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "cancel token approval" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "❌ Token approval cancelled.",
          action: "APPROVE_TOKEN",
        },
      },
    ],
    [
      {
        user: "{{agent}}",
        content: {
          text: "Token approval successful. Transaction Hash: 0x...",
          action: "APPROVE_TOKEN",
          source: "APPROVE_TOKEN",
          metadata: { action: "APPROVE_TOKEN", txHash: "0x..." },
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "✅ Token approval confirmed! Transaction Hash: 0x...",
          action: "APPROVE_TOKEN",
          source: "APPROVE_TOKEN",
          metadata: { action: "APPROVE_TOKEN", txHash: "0x..." },
        },
      },
    ],
  ] as ActionExample[][],
};