import type { Provider, AgentRuntime, Memory, State, Content } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { validateChipiConfig } from "../config/environment";
import { Account, RpcProvider } from "starknet";
import { resolveUserIdFromCreatedBy } from "@elizaos-plugins/plugin-shared-email-sanity";

interface StarknetMemory extends Memory {
  content: {
    text: string;
    metadata?: {
      walletAddress?: string;
      txHash?: string;
    };
  };
}

export const chipiProvider: Provider = {
  get: async (runtime: AgentRuntime, message: Memory, state?: State): Promise<{ text: string; values?: Record<string, any> }> => {
    elizaLogger.debug("[STARKNET-PLUGIN] Executing starknetProvider", {
      messageText: message.content.text,
      roomId: message.roomId,
    });

    try {
      const config = await validateChipiConfig(runtime);
      const text = message.content.text?.toLowerCase() || "";
      const isRelevant = (
        text.includes("connect wallet") ||
        text.includes("chipi pay") ||
        text.includes("starknet")
      );

      if (!isRelevant) {
        elizaLogger.debug("[STARKNET-PLUGIN] Message not relevant for starknetProvider", { text });
        return { text: "" };
      }

      let userId: `${string}-${string}-${string}-${string}-${string}` | undefined = message.userId as any;
      if (!userId) {
        const createdBy = runtime.character.createdBy;
        const resolvedUserId = await resolveUserIdFromCreatedBy(createdBy);
        userId = stringToUuid(resolvedUserId) as any;
      }

      if (!userId) {
        throw new Error("User ID could not be resolved");
      }


  
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 20,
        start: oneDayAgo,
      }) as StarknetMemory[];

      let responseText = "";
      let values: Record<string, any> = {};

     

      const response: Content = {
        text: responseText,
        source: "STARKNET_PROVIDER",
        user: runtime.character.id,
        thought: `Processed Starknet request: ${text}`,
        actions: ["CONNECT_WALLET", "TRANSFER_USDC", "STAKE_VESU_USDC"],
        createdAt: Date.now(),
        metadata: { walletAddress: values.walletAddress, txHash: values.txHash },
      };

      const notificationMemory: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.debug("[STARKNET-PLUGIN] Provider response stored", {
        memoryId: notificationMemory.id,
        responseText,
        roomId: message.roomId,
      });

      return { text: responseText, values };
    } catch (error: any) {
      elizaLogger.error("[STARKNET-PLUGIN] starknetProvider failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: "Sorry, couldn't fetch Starknet data. Please try again.",
        thought: `Failed: ${error.message}`,
        source: "STARKNET_PROVIDER",
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
      return { text: "" };
    }
  },
};

function extractEncryptKey(text: string, memories: StarknetMemory[]): string | undefined {
  const keyMatch = text.match(/pin:(\w+)/i);
  if (keyMatch) return keyMatch[1];
  
  for (const memory of memories) {
    const memoryKeyMatch = memory.content.text.match(/pin:(\w+)/i);
    if (memoryKeyMatch) return memoryKeyMatch[1];
  }
  return undefined;
}