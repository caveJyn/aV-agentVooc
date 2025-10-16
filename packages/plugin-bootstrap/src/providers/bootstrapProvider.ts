import type { Provider, IAgentRuntime, Memory, State, Content } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";

interface BootstrapMemory extends Memory {
  content: {
    text: string;
    metadata?: {
      actionTriggered?: string;
      roomId?: string;
      followStatus?: boolean;
      muteStatus?: boolean;
    };
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

export const bootstrapProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> => {
    elizaLogger.debug("[BOOTSTRAP-PLUGIN] Executing bootstrapProvider", {
      messageText: message.content.text,
      roomId: message.roomId,
    });

    try {
      const text = message.content.text?.toLowerCase() || "";
      const isRelevant = (
        // NONE action triggers (general conversation)
        text.includes("hey") ||
        text.includes("what's up") ||
        text.includes("hi") ||
        text.includes("hello") ||
        text.includes("whats good") ||
        // CONTINUE action triggers
        text.includes("tell me more") ||
        text.includes("go on") ||
        text.includes("keep talking") ||
        text.includes("elaborate") ||
        // FOLLOW_ROOM/UNFOLLOW_ROOM triggers
        text.includes("follow this room") ||
        text.includes("stop following") ||
        text.includes("unfollow") ||
        // MUTE_ROOM/UNMUTE_ROOM triggers
        text.includes("mute this room") ||
        text.includes("unmute this room") ||
        // IGNORE action triggers
        text.includes("ignore this") ||
        text.includes("stop responding") ||
        text.includes("be quiet")
      );

      if (!isRelevant) {
        elizaLogger.debug("[BOOTSTRAP-PLUGIN] Message not relevant for bootstrapProvider", { text });
        return { text: "" };
      }

      // Fetch recent memories for context
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const memories = await runtime.messageManager.getMemories({
        roomId: message.roomId,
        count: 20,
        start: oneDayAgo,
      }) as BootstrapMemory[];

      let responseText = "";
      let actionTriggered: string | undefined;
      let metadata: any = {};

      // Check for specific action triggers and execute lightweight logic
      if (
        text.includes("tell me more") ||
        text.includes("go on") ||
        text.includes("keep talking") ||
        text.includes("elaborate")
      ) {
        // Placeholder for CONTINUE action validation (assuming a max of 3 continues)
        const continueCount = memories.filter(
          (m) => m.content.metadata?.actionTriggered === "CONTINUE"
        ).length;
        if (continueCount < 3) {
          actionTriggered = "CONTINUE";
          responseText = "I can elaborate further on the topic. Please provide more details or confirm to continue.";
          metadata.actionTriggered = "CONTINUE";
        } else {
          responseText = "I've reached the limit for continuing this conversation. Please provide more details or ask a new question.";
        }
      } else if (text.includes("follow this room")) {
        // Check if already following
        const isFollowing = memories.some(
          (m) => m.content.metadata?.actionTriggered === "FOLLOW_ROOM" && m.content.metadata?.followStatus
        );
        if (!isFollowing) {
          actionTriggered = "FOLLOW_ROOM";
          responseText = `Now following room ${message.roomId}. I'll keep you updated on new messages.`;
          metadata = { actionTriggered: "FOLLOW_ROOM", roomId: message.roomId, followStatus: true };
        } else {
          responseText = `Already following room ${message.roomId}.`;
        }
      } else if (text.includes("stop following") || text.includes("unfollow")) {
        // Check if following
        const isFollowing = memories.some(
          (m) => m.content.metadata?.actionTriggered === "FOLLOW_ROOM" && m.content.metadata?.followStatus
        );
        if (isFollowing) {
          actionTriggered = "UNFOLLOW_ROOM";
          responseText = `Stopped following room ${message.roomId}.`;
          metadata = { actionTriggered: "UNFOLLOW_ROOM", roomId: message.roomId, followStatus: false };
        } else {
          responseText = `Not currently following room ${message.roomId}.`;
        }
      } else if (text.includes("mute this room")) {
        // Check if already muted
        const isMuted = memories.some(
          (m) => m.content.metadata?.actionTriggered === "MUTE_ROOM" && m.content.metadata?.muteStatus
        );
        if (!isMuted) {
          actionTriggered = "MUTE_ROOM";
          responseText = `Room ${message.roomId} is now muted.`;
          metadata = { actionTriggered: "MUTE_ROOM", roomId: message.roomId, muteStatus: true };
        } else {
          responseText = `Room ${message.roomId} is already muted.`;
        }
      } else if (text.includes("unmute this room")) {
        // Check if muted
        const isMuted = memories.some(
          (m) => m.content.metadata?.actionTriggered === "MUTE_ROOM" && m.content.metadata?.muteStatus
        );
        if (isMuted) {
          actionTriggered = "UNMUTE_ROOM";
          responseText = `Room ${message.roomId} is now unmuted.`;
          metadata = { actionTriggered: "UNMUTE_ROOM", roomId: message.roomId, muteStatus: false };
        } else {
          responseText = `Room ${message.roomId} is not muted.`;
        }
      } else if (
        text.includes("ignore this") ||
        text.includes("stop responding") ||
        text.includes("be quiet")
      ) {
        actionTriggered = "IGNORE";
        responseText = "I'll stop responding to this message thread.";
        metadata.actionTriggered = "IGNORE";
      } else {
        // Default to NONE action for general conversation
        actionTriggered = "NONE";
        responseText = `Continuing conversation in room ${message.roomId}.`;
        metadata.actionTriggered = "NONE";
      }

      // Store the response in memory
      const response: Content = {
        text: responseText,
        source: "BOOTSTRAP_PROVIDER",
        user: runtime.character.id,
        thought: actionTriggered ? `Triggered ${actionTriggered} action.` : "Processed general conversation.",
        actions: ["NONE", "CONTINUE", "FOLLOW_ROOM", "UNFOLLOW_ROOM", "MUTE_ROOM", "UNMUTE_ROOM", "IGNORE"],
        createdAt: Date.now(),
        metadata,
      };

      const notificationMemory: BootstrapMemory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.debug("[BOOTSTRAP-PLUGIN] Bootstrap provider response stored", {
        memoryId: notificationMemory.id,
        responseText,
        actionTriggered,
        roomId: message.roomId,
      });

      // Cache the result for 5 minutes
      const cacheKey = `bootstrapProvider:${message.roomId}:${actionTriggered || "NONE"}`;
      await runtime.cacheManager.set(cacheKey, JSON.stringify({ text: responseText, values: metadata }), { expires: 5 * 60 * 1000 });

      return {
        text: responseText,
        values: metadata,
      };
    } catch (error: any) {
      elizaLogger.error("[BOOTSTRAP-PLUGIN] bootstrapProvider failed", {
        error: error.message,
        stack: error.stack,
        roomId: message.roomId,
      });
      const response: Content = {
        text: "Sorry, I couldn't process the request. Please try again later.",
        thought: `Failed to process bootstrap action: ${error.message}`,
        source: "BOOTSTRAP_PROVIDER",
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

export default bootstrapProvider;