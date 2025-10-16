/**
 * actions/generateProof.ts
 * --------------------------------------------
 * ElizaOS Action to generate a zero-knowledge proof
 * for user IDs, customer IDs, or transaction IDs.
 *
 * Uses the Noir (WASM) client to produce a proof
 * and persists metadata to the runtime memory.
 * --------------------------------------------
 */

import {
  Action,
  ActionExample,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  stringToUuid,
  Content,
} from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { generateProof } from "../client";

interface ZKProofMetadata {
  proofType: string;
  derivedValue: string;
  proofGeneratedAt: string;
  secret?: string;
}

interface ZKProofMemory extends Memory {
  content: {
    text: string;
    metadata?: ZKProofMetadata;
    source?: string;
    thought?: string;
    actions?: string[];
    user?: string;
    createdAt?: number;
  };
}

export const generateProofAction: Action = {
  name: "ZKPROOF_GENERATE_ACTION",
  similes: [
    "GENERATE_ZK_PROOF",
    "CREATE_PROOF",
    "MAKE_PROOF",
    "PROVE_ID",
    "ZK_PROOF",
    "GENERATE_PROOF",
  ],
  description:
    "Generates a zero-knowledge proof for a user ID, customer ID, or transaction ID using the Noir WASM client. Stores the proof metadata in memory for future reference.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isValid = /generate\s+proof\s+(userid|customerid|transaction):\S+/i.test(
      text
    );
    elizaLogger.info("[ZKPROOF-PLUGIN] Validating GENERATE_PROOF action", {
      text,
      isValid,
    });
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<Memory[]> => {
    elizaLogger.info("[ZKPROOF-PLUGIN] Executing GENERATE_PROOF action", {
      messageText: message.content.text,
      roomId: message.roomId,
      options,
    });

    const text = message.content.text?.toLowerCase() || "";
    if (!text.includes("generate proof")) return [];

    const match = text.match(/(userid|customerid|transaction):(\S+)/i);
    if (!match) {
      const response: Content = {
        text: '❌ Please specify proof type and secret (e.g., "generate proof userId:abc123")',
        thought: "Invalid proof generation request format",
        source: "ZKPROOF_GENERATE_ACTION",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      const memory: ZKProofMemory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory(memory);
      elizaLogger.info("[ZKPROOF-PLUGIN] Stored invalid format memory", {
        memoryId: memory.id,
      });
      if (callback) await callback(response);
      return [memory];
    }

    const [, rawProofType, secret] = match;
    const proofType = rawProofType.toLowerCase(); // Normalize to lowercase

    try {
      const proof = await generateProof(proofType as any, secret);
      const responseText = `✅ Proof generated for ${proofType}: ${proof.derivedValue}\n💡 Use 'verify proof ${proofType}:${proof.derivedValue}:{...}' to verify.`;

      const response: Content = {
        text: responseText,
        source: "ZKPROOF_GENERATE_ACTION",
        user: runtime.character.id,
        thought: `Generated proof for ${proofType} with secret ${secret}`,
        actions: ["ZKPROOF_VERIFY_ACTION", "ZKPROOF_GENERATE_ACTION"],
        createdAt: Date.now(),
        metadata: {
          proofType,
          derivedValue: proof.derivedValue,
          proofGeneratedAt: new Date().toISOString(),
          secret, // Store secret for debugging (consider security in production)
        },
      };

      const memory: ZKProofMemory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(memory);
      elizaLogger.info("[ZKPROOF-PLUGIN] Proof generated and stored", {
        memoryId: memory.id,
        proofType,
        derivedValue: proof.derivedValue,
        roomId: message.roomId,
      });

      // Cache the result for 5 minutes
      const cacheKey = `zkproof:generate:${message.roomId}:${proofType}:${secret}`;
      await runtime.cacheManager.set(
        cacheKey,
        JSON.stringify({
          text: responseText,
          metadata: response.metadata,
        }),
        { expires: 5 * 60 * 1000 }
      );

      if (callback) await callback(response);
      return [memory];
    } catch (error: any) {
      elizaLogger.error("[ZKPROOF-PLUGIN] GENERATE_PROOF action failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: `❌ Failed to generate proof: ${error.message}`,
        thought: `Failed to generate proof for ${proofType}: ${error.message}`,
        source: "ZKPROOF_GENERATE_ACTION",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      const memory: ZKProofMemory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory(memory);
      elizaLogger.info("[ZKPROOF-PLUGIN] Stored error memory", {
        memoryId: memory.id,
      });
      if (callback) await callback(response);
      return [memory];
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "generate proof userId:abc123",
          action: "ZKPROOF_GENERATE_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "✅ Proof generated for userId: 0xabc123\n💡 Use 'verify proof userId:0xabc123:{...}' to verify.",
          action: "ZKPROOF_GENERATE_ACTION",
          metadata: {
            proofType: "userId",
            derivedValue: "0xabc123",
            proofGeneratedAt: "{{timestamp}}",
          },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "generate proof transaction:tx789",
          action: "ZKPROOF_GENERATE_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "✅ Proof generated for transaction: 0xtx789\n💡 Use 'verify proof transaction:0xtx789:{...}' to verify.",
          action: "ZKPROOF_GENERATE_ACTION",
          metadata: {
            proofType: "transaction",
            derivedValue: "0xtx789",
            proofGeneratedAt: "{{timestamp}}",
          },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "generate proof invalid:xyz",
          action: "ZKPROOF_GENERATE_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "❌ Please specify proof type and secret (e.g., 'generate proof userId:abc123')",
          action: "ZKPROOF_GENERATE_ACTION",
        },
      },
    ],
  ] as ActionExample[][],
};