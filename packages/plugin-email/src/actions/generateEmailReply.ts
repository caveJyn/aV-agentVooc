import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, RAGKnowledgeItem } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { EmailClient } from "../clients/emailClient";
import type { SendEmailOptions } from "../types";
import { generateEmailReply } from "../utils/generation";

export interface EmailMetadata {
  from?: { address: string; name?: string }[];
  subject?: string;
  date?: string;
  emailId?: string;
  messageId?: string;
  references?: string[];
  threadId?: string;
  collection?: string;
  originalEmailId?: string;
  originalMessageId?: string;
  originalThreadId?: string;
  pendingReply?: SendEmailOptions;
  emails?: Array<{
    id: string;
    emailId: string;
    messageId?: string;
    from?: string;
    subject?: string;
    date?: string | Date;
    originalEmailId?: string;
  }>;
}

interface EmailMemory extends Memory {
  content: {
    text?: string; // Make text optional to handle undefined cases
    metadata?: EmailMetadata;
    source?: string;
    thought?: string;
    actions?: string[];
    user?: string;
    createdAt?: number;
  };
}

function normalizeEmailId(id: string): string {
  if (!id) return "";
  let normalized = id.replace(/^[<]+|[>]+$/g, "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(normalized) ? normalized.toLowerCase() : normalized;
}

function formatKnowledgeItems(items: RAGKnowledgeItem[]): string {
  return items.length
    ? items
        .map(
          (item, index) =>
            `${index + 1}. ${item.content.text} (Source: ${item.content.metadata?.source || "unknown"})`
        )
        .join("\n")
    : "No relevant knowledge found.";
}

export const generateEmailReplyAction: Action = {
  name: "GENERATE_EMAIL_REPLY",
  similes: ["GENERATE_REPLY", "CREATE_REPLY", "DRAFT_REPLY"],
  description: "Generates a draft reply for a specified email and stores it for confirmation.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    // Updated regex to handle case-insensitive emailId/emailid
    const isValid =
      /generate\s+(a\s+)?reply\s+(for|to)\s+email[iI][dD]:/i.test(text) ||
      text.includes("create reply") ||
      text.includes("draft reply") ||
      text.includes("generate reply for this email");
    elizaLogger.debug("[EMAIL-PLUGIN] Validating GENERATE_EMAIL_REPLY action", { text, isValid });
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { ragKnowledge?: string },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Executing GENERATE_EMAIL_REPLY action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
    });

    try {
      const text = message.content.text || "";
      let emailId: string | undefined;

      // Extract emailId or infer from "this email"
      const emailIdMatch = text.match(/(?:for|to)\s+email[iI][dD]:\s*([^\s]+)/i);
      if (emailIdMatch) {
        emailId = normalizeEmailId(emailIdMatch[1]);
      } else if (text.toLowerCase().includes("reply for this email")) {
        const recentMemories = await runtime.messageManager.getMemories({
          roomId: runtime.character.id,
          count: 10,
          start: Date.now() - 24 * 60 * 60 * 1000,
          filters: { source: "CHECK_EMAIL" },
        }) as EmailMemory[];
        const checkEmailMemory = recentMemories.find(
          (m) => m.content.metadata?.emails?.length
        );
        if (checkEmailMemory) {
          emailId = normalizeEmailId(checkEmailMemory.content.metadata.emails[0].emailId);
        }
      }

      if (!emailId) {
        const response: Content = {
          text: "Please specify the emailId (e.g., 'generate reply for emailId: <id>') or use 'generate reply for this email' after checking emails.",
          thought: "Missing or invalid emailId",
          source: "GENERATE_EMAIL_REPLY",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        return false;
      }

      // Fetch email memory with targeted query
      const emailMemory = await runtime.messageManager.getMemoryById(emailId, runtime.character.id) || 
        (await runtime.messageManager.getMemories({
          roomId: runtime.character.id,
          count: 1,
          filters: { metadata: { collection: "emails", emailId } },
        }) as EmailMemory[])[0];

      if (!emailMemory) {
        const response: Content = {
          text: `Could not find email with ID: ${emailId}. Please check the ID and try again.`,
          thought: `Email ID: ${emailId} not found`,
          source: "GENERATE_EMAIL_REPLY",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        return false;
      }

      // Check for existing pending reply
      const existingPendingReply = await runtime.messageManager.getMemories({
        roomId: runtime.character.id,
        count: 1,
        filters: { metadata: { pendingReply: true, emailId } },
      }) as EmailMemory[];

      if (existingPendingReply.length) {
        const pendingReply = existingPendingReply[0].content.metadata.pendingReply;
        const response: Content = {
          text: `✅ A reply for emailId: ${emailId} has already been generated:\n\n---\n${pendingReply.text}\n---\n\nTo send this reply, say 'confirm reply for emailId: ${emailId}'. To generate a new reply, confirm or cancel the existing one first.`,
          thought: `Existing pending reply found for email ${emailId}`,
          source: "GENERATE_EMAIL_REPLY",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        return false;
      }

      const metadata = emailMemory.content.metadata || {};
      const fromAddress = metadata.from?.[0]?.address;
      const subject = metadata.subject || "No subject";
      // Handle undefined or empty email body
      const emailBody = emailMemory.content.text || "No email body available.";
      const sender = metadata.from?.[0]?.name || fromAddress || "Sender";

      if (!fromAddress) {
        const response: Content = {
          text: "Could not generate reply: No sender address found for the email.",
          thought: "Missing sender address",
          source: "GENERATE_EMAIL_REPLY",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        return false;
      }

      const ragKnowledgeItems = await runtime.ragKnowledgeManager.getKnowledge({
        query: emailBody,
        limit: 5,
        agentId: runtime.agentId,
        conversationContext: state?.recentMessagesData?.map(m => m.content.text || "").join("\n") || "",
      });

      let body: string;
      try {
        body = await generateEmailReply({
          runtime,
          sender,
          subject,
          emailBody,
          emailId,
          context: ragKnowledgeItems,
        });
      } catch (error) {
        elizaLogger.warn("[EMAIL-PLUGIN] Reply generation failed, using fallback", { emailId, error });
        body = `Dear ${sender.split("@")[0] || "Sender"},\n\nThank you for your email. I'll review and respond soon.\n\nBest regards,\n${runtime.character.name}`;
      }

      const replySubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
      const pendingReply: SendEmailOptions = {
        to: fromAddress,
        subject: replySubject,
        text: body,
        threadId: metadata.threadId || metadata.messageId || emailId,
        references: metadata.references ? [...metadata.references, metadata.messageId || emailId] : [metadata.messageId || emailId],
        inReplyTo: metadata.messageId || emailId,
      };

      const pendingReplyMemory: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: {
          text: `I have generated a reply for emailId ${emailId}:\n\n---\n${body}\n---\n\nRelevant knowledge:\n${formatKnowledgeItems(ragKnowledgeItems)}\n\nTo send this reply, say 'confirm reply' or 'confirm reply for emailId: ${emailId}'. To send a different message, use 'reply to emailId: ${emailId} message: <your message>'.`,
          thought: `Generated reply for email ${emailId}`,
          source: "GENERATE_EMAIL_REPLY",
          user: runtime.character.id,
          createdAt: Date.now(),
          metadata: {
            emailId,
            pendingReply,
            ragKnowledge: ragKnowledgeItems.map(item => item.id) || [],
          },
        },
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(pendingReplyMemory);
      if (callback) await callback(pendingReplyMemory.content);
      return true;
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] GENERATE_EMAIL_REPLY action failed", { error: error.message });
      const response: Content = {
        text: "Sorry, I couldn't generate a reply. Please try again later or provide a custom message.",
        thought: `Failed to generate reply: ${error.message}`,
        source: "GENERATE_EMAIL_REPLY",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      if (callback) await callback(response);
      return false;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "generate reply for emailId: abc123" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "I have generated a reply for emailId abc123:\n\n---\nThank you for your email...\n---\n\nTo send this reply, say 'confirm reply' or 'confirm reply for emailId: abc123'.",
          action: "GENERATE_EMAIL_REPLY",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "generate a reply for this email" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "I have generated a reply for emailId def456:\n\n---\nThank you for your message...\n---\n\nTo send this reply, say 'confirm reply' or 'confirm reply for emailId: def456'.",
          action: "GENERATE_EMAIL_REPLY",
        },
      },
    ],
  ] as ActionExample[][]
};