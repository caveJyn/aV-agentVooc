/**
 * providers/zKproofProvider.ts
 * --------------------------------------------
 * ElizaOS Provider for zero-knowledge proof operations.
 * Orchestrates proof generation and verification actions,
 * retrieves recent proofs from memory, and caches results.
 * --------------------------------------------
 */

import {
  Provider,
  IAgentRuntime,
  Memory,
  State,
  Content,
  elizaLogger,
  stringToUuid,
  HandlerCallback,
} from "@elizaos/core";
import { generateProofAction } from "../actions/generateProof";
import { verifyProofAction } from "../actions/verifyProof";

interface ZKProofMetadata {
  proofType?: string;
  derivedValue?: string;
  isValid?: boolean;
  proofGeneratedAt?: string;
  backend?: string;
  timestamp?: string;
  success?: boolean; // Added to align with verifyProof.ts
  secret?: string; // Added to align with generateProof.ts
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

interface ProviderResult {
  text: string;
  values?: Record<string, any>;
}

export const zKproofProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ProviderResult> => {
    elizaLogger.debug("[ZKPROOF-PLUGIN] Executing zKproofProvider", {
      messageText: message.content.text,
      roomId: message.roomId,
    });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const isRelevant =
        text.includes("generate proof") ||
        text.includes("verify proof") ||
        text.includes("recent proofs") ||
        text.includes("list proofs") ||
        text.includes("proof history") ||
        generateProofAction.similes.some((simile) =>
          text.includes(simile.toLowerCase())
        ) ||
        verifyProofAction.similes.some((simile) =>
          text.includes(simile.toLowerCase())
        );

      if (!isRelevant) {
        elizaLogger.debug(
          "[ZKPROOF-PLUGIN] Message not relevant for zKproofProvider",
          { text }
        );
        return { text: "" };
      }

      // Check cache first
      const cacheKey = `zkproof:${message.roomId}:${text}`;
      const cachedResult = await runtime.cacheManager.get(cacheKey);
      if (cachedResult) {
        const parsed = JSON.parse(cachedResult as string) as ProviderResult;
        elizaLogger.debug("[ZKPROOF-PLUGIN] Returning cached result", {
          cacheKey,
          responseText: parsed.text,
        });
        return parsed;
      }

      // Fetch recent proofs for context
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const memories = (await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 50,
        start: oneDayAgo,
      })) as ZKProofMemory[];

      const proofs = memories.filter(
        (memory) =>
          memory.content.source === "ZKPROOF_GENERATE_ACTION" ||
          memory.content.source === "ZKPROOF_VERIFY_ACTION"
      );

      let responseText = "";
      let values: Record<string, any> = {};

      if (
        text.includes("recent proofs") ||
        text.includes("list proofs") ||
        text.includes("proof history")
      ) {
        if (!proofs.length) {
          responseText = "📭 No proofs have been generated or verified in the last 24 hours.";
        } else {
          const maxProofs = 5;
          const sortedProofs = proofs.sort((a, b) => b.createdAt - a.createdAt);
          const proofList = sortedProofs.slice(0, maxProofs).map((proof) => {
            const metadata = proof.content.metadata ?? {};
            const action = proof.content.source?.includes("GENERATE")
              ? "Generated"
              : "Verified";
            const status = metadata.success !== undefined ? (metadata.success ? "Valid" : "Invalid") : "";
            return `${action} ${metadata.proofType || "Unknown"}: ${metadata.derivedValue || "N/A"} (${status}) on ${metadata.proofGeneratedAt || metadata.timestamp || "Unknown"}`;
          }).join("\n");
          const moreProofs = proofs.length > maxProofs ? `\n...and ${proofs.length - maxProofs} more proof(s).` : "";
          responseText = `Recent proofs:\n${proofList}${moreProofs}`;
        }
        values = {
          proofs: proofs.map((p) => ({
            id: p.id,
            proofType: p.content.metadata?.proofType,
            derivedValue: p.content.metadata?.derivedValue,
            isValid: p.content.metadata?.isValid,
            timestamp: p.content.metadata?.proofGeneratedAt || p.content.metadata?.timestamp,
          })),
        };
      } else if (await generateProofAction.validate(runtime, message)) {
        const memories = await generateProofAction.handler(
          runtime,
          message,
          state,
          undefined,
          async (content: Content): Promise<Memory[]> => {
            responseText = content.text;
            values = content.metadata || {};
            return [memory]; // Return the memory to satisfy HandlerCallback
          }
        );
        if (memories && Array.isArray(memories) && memories.length > 0) {
          responseText = memories[0].content.text;
          values = memories[0].content.metadata || {};
        }
      } else if (await verifyProofAction.validate(runtime, message)) {
        const memories = await verifyProofAction.handler(
          runtime,
          message,
          state,
          undefined,
          async (content: Content): Promise<Memory[]> => {
            responseText = content.text;
            values = content.metadata || {};
            return [memory]; // Return the memory to satisfy HandlerCallback
          }
        );
        if (memories && Array.isArray(memories) && memories.length > 0) {
          responseText = memories[0].content.text;
          values = memories[0].content.metadata || {};
        }
      } else {
        responseText = '❌ Invalid request format. Use "generate proof <type>:<secret>", "verify proof <type>:<derivedValue>:<proofJSON>", or "list proofs" for history.';
        values = { error: "Invalid format" };
      }

      const response: Content = {
        text: responseText,
        source: "ZKPROOF_PROVIDER",
        user: runtime.character.id,
        thought: `Processed ZK proof request: ${text}`,
        actions: ["ZKPROOF_GENERATE_ACTION", "ZKPROOF_VERIFY_ACTION"],
        createdAt: Date.now(),
        metadata: values,
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
      elizaLogger.debug("[ZKPROOF-PLUGIN] zKproofProvider response stored", {
        memoryId: memory.id,
        responseText,
        roomId: message.roomId,
      });

      // Cache the result
      await runtime.cacheManager.set(
        cacheKey,
        JSON.stringify({ text: responseText, values }),
        { expires: 5 * 60 * 1000 }
      );

      return { text: responseText, values };
    } catch (error: any) {
      elizaLogger.error("[ZKPROOF-PLUGIN] zKproofProvider failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: `❌ Failed to process proof request: ${error.message}`,
        thought: `Failed to process ZK proof request: ${error.message}`,
        source: "ZKPROOF_PROVIDER",
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
      return { text: response.text };
    }
  },
};

export default zKproofProvider;