// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/packages/plugin-braavos/src/providers/braavosProvider.ts
import type { Provider, IAgentRuntime, Memory, State, Content } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";

interface BraavosMetadata {
  connected?: boolean;
  promptBraavosConnection?: boolean; // Triggers frontend modal
  zkProof?: string; // Anonymized ZK proof (from client)
  cashuToken?: string; // Blind Cashu token (from client)
  walletId?: string; // For Chipi compatibility
}

interface BraavosMemory extends Memory {
  content: {
    text: string;
    metadata?: BraavosMetadata;
    source?: string;
    thought?: string;
    user?: string;
    createdAt?: number;
  };
}

export const braavosProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    elizaLogger.debug("[BRAVOS-PLUGIN] Executing braavosProvider", {
      messageText: message.content.text,
      roomId: message.roomId,
    });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const isRelevant = (
        text.includes("connect braavos") ||
        text.includes("link braavos wallet") ||
        text.includes("verify runes") ||
        text.includes("check runes balance") ||
        text.includes("dao membership")
      );

      if (!isRelevant) {
        elizaLogger.debug("[BRAVOS-PLUGIN] Message not relevant for braavosProvider", { text });
        return "";
      }

      // Fetch recent memories for context
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 20,
        start: oneDayAgo,
      }) as BraavosMemory[];

      let responseText = "";
      let metadata: BraavosMetadata = {};

      // Check for existing connection
      const existingConnection = memories.find(
        (m) => m.content.metadata?.connected && m.content.metadata?.zkProof
      );

      if (existingConnection) {
        responseText = "Braavos wallet already connected. Proof available for DAO registration.";
        metadata = { ...existingConnection.content.metadata };
      } else {
        responseText = "Please connect your Braavos wallet via the frontend to verify Runes anonymously.";
        metadata = { connected: false, promptBraavosConnection: true };
      }

      // Check for Chipi wallet (cross-plugin integration)
      const chipiMemories = memories.filter(m => m.content.source === "PLUGIN_CHIPI");
      const hasChipiWallet = chipiMemories.some(m => m.content.metadata?.walletId);
      if (!hasChipiWallet) {
        responseText += "\nNo Chipi wallet found. You may need one for anonymous DAO registration.";
        metadata.promptBraavosConnection = true;
      }

      // Store response in memory
      const response: Content = {
        text: responseText,
        source: "BRAVOS_PROVIDER",
        thought: existingConnection ? "Found existing Braavos connection." : "Prompting Braavos wallet connection.",
        user: runtime.character.id,
        createdAt: Date.now(),
        metadata,
      };

      const notificationMemory: BraavosMemory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.debug("[BRAVOS-PLUGIN] Braavos provider response stored", {
        memoryId: notificationMemory.id,
        responseText,
        metadata,
        roomId: message.roomId,
      });

      // Cache for 5 minutes
      const cacheKey = `braavosProvider:${message.roomId}:connection`;
      await runtime.cacheManager.set(cacheKey, JSON.stringify({ text: responseText, metadata }), { expires: 5 * 60 * 1000 });

      return "";
    } catch (error: any) {
      elizaLogger.error("[BRAVOS-PLUGIN] braavosProvider failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: "Sorry, couldn't process Braavos wallet request. Please try again later.",
        thought: `Failed Braavos provider: ${error.message}`,
        source: "BRAVOS_PROVIDER",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory({
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      });
      return "";
    }
  },
};

export default braavosProvider;