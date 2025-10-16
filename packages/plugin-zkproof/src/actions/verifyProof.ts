/**
 * actions/verifyProof.ts
 * --------------------------------------------
 * ElizaOS Action to verify a user-submitted zero-knowledge proof.
 *
 * Uses wasmProver (stubbed today, Garaga verifier tomorrow).
 * Persists verification result into Eliza memory for future queries.
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
import { verifyProof } from "../utils/wasmProver";

interface ZKProofMetadata {
  proofType: string;
  derivedValue: string;
  backend: string;
  success: boolean;
  timestamp: string;
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

export const verifyProofAction: Action = {
  name: "ZKPROOF_VERIFY_ACTION",
  similes: [
    "VERIFY_ZK_PROOF",
    "CHECK_PROOF",
    "VALIDATE_PROOF",
    "CONFIRM_PROOF",
    "VERIFY_PROOF",
  ],
  description:
    "Verifies a zero-knowledge proof for a user ID, customer ID, or transaction ID using the wasmProver. Stores the verification result in memory.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isValid = /verify\s+proof\s+(userid|customerid|transaction):\S+:\{.+\}/i.test(
      text
    );
    elizaLogger.debug("[ZKPROOF-PLUGIN] Validating VERIFY_PROOF action", {
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
    elizaLogger.debug("[ZKPROOF-PLUGIN] Executing VERIFY_PROOF action", {
      messageText: message.content.text,
      roomId: message.roomId,
      options,
    });

    const text = message.content.text?.toLowerCase() || "";
    if (!text.includes("verify proof")) return [];

    const match = text.match(/(userid|customerid|transaction):(\S+):(.+)/i);
    if (!match) {
      const response: Content = {
        text: '❌ Please specify proof type, derived value, and proof JSON (e.g., "verify proof userId:0xabc123:{...}")',
        thought: "Invalid proof verification request format",
        source: "ZKPROOF_VERIFY_ACTION",
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
      elizaLogger.debug("[ZKPROOF-PLUGIN] Stored invalid format memory", {
        memoryId: memory.id,
      });
      if (callback) await callback(response);
      return [memory];
    }

    const [, rawProofType, derivedValue, proofData] = match;
    const proofType = rawProofType.toLowerCase();

    try {
      const parsedProof = JSON.parse(proofData);
      const verificationResult = await verifyProof(
        proofType as any,
        derivedValue,
        parsedProof
      );

      const responseText = verificationResult.success
        ? `✅ Proof verified successfully for ${proofType}: ${derivedValue} using ${verificationResult.backend}`
        : `❌ Proof verification failed for ${proofType}: ${derivedValue}. Reason: ${verificationResult.error || "Invalid proof"}`;

      const response: Content = {
        text: responseText,
        source: "ZKPROOF_VERIFY_ACTION",
        user: runtime.character.id,
        thought: verificationResult.success
          ? `Verified proof for ${proofType}`
          : `Failed to verify proof for ${proofType}: ${verificationResult.error || "Invalid"}`,
        actions: ["ZKPROOF_GENERATE_ACTION", "ZKPROOF_VERIFY_ACTION"],
        createdAt: Date.now(),
        metadata: {
          proofType,
          derivedValue,
          backend: verificationResult.backend,
          success: verificationResult.success,
          timestamp: new Date().toISOString(),
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
      elizaLogger.debug("[ZKPROOF-PLUGIN] Proof verification result stored", {
        memoryId: memory.id,
        proofType,
        derivedValue,
        success: verificationResult.success,
        roomId: message.roomId,
      });

      // Cache the result for 5 minutes
      const cacheKey = `zkproof:verify:${message.roomId}:${proofType}:${derivedValue}`;
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
      elizaLogger.error("[ZKPROOF-PLUGIN] VERIFY_PROOF action failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: `❌ Failed to verify proof: ${error.message}`,
        thought: `Failed to verify proof for ${proofType}: ${error.message}`,
        source: "ZKPROOF_VERIFY_ACTION",
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
      elizaLogger.debug("[ZKPROOF-PLUGIN] Stored error memory", {
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
          text: 'verify proof userId:0xabc123:{"proof":"0x123"}',
          action: "ZKPROOF_VERIFY_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "✅ Proof verified successfully for userId: 0xabc123 using wasmProver",
          action: "ZKPROOF_VERIFY_ACTION",
          metadata: {
            proofType: "userId",
            derivedValue: "0xabc123",
            backend: "wasmProver",
            success: true,
            timestamp: "{{timestamp}}",
          },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: 'verify proof transaction:0xtx789:{"proof":"0x456"}',
          action: "ZKPROOF_VERIFY_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: "❌ Proof verification failed for transaction: 0xtx789. Reason: Invalid proof",
          action: "ZKPROOF_VERIFY_ACTION",
          metadata: {
            proofType: "transaction",
            derivedValue: "0xtx789",
            backend: "wasmProver",
            success: false,
            timestamp: "{{timestamp}}",
          },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "verify proof invalid:xyz:abc",
          action: "ZKPROOF_VERIFY_ACTION",
        },
      },
      {
        user: "{{agent}}",
        content: {
          text: '❌ Please specify proof type, derived value, and proof JSON (e.g., "verify proof userId:0xabc123:{...}")',
          action: "ZKPROOF_VERIFY_ACTION",
        },
      },
    ],
  ] as ActionExample[][],
};