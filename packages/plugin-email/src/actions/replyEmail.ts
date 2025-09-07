// packages/plugin-email/src/actions/replyEmail.ts
import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, RAGKnowledgeItem, UUID } from "@elizaos/core";
import { elizaLogger, stringToUuid, validateUuid } from "@elizaos/core";
import { EmailClient } from "../clients/emailClient";
import type { SendEmailOptions } from "../types";
import { generateEmailReply } from "../utils/generation";
import { BigQuery } from "@google-cloud/bigquery";
import { fetchRecentEmails, storeReplyToBigQuery } from "../utils/bigQuery";

const bigquery = new BigQuery();
const datasetId = 'agentvooc_dataset';
const emailsTableId = 'emails';

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
  pendingReplyId?: string;
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
  id?: UUID;
  content: {
    text: string;
    metadata?: EmailMetadata;
    source?: string;
    thought?: string;
    actions?: string[];
    user?: string;
    createdAt?: number;
  };
}

interface EmailClientContainer {
  client?: EmailClient;
  stop: (runtime: IAgentRuntime) => Promise<boolean>;
  send: (options: SendEmailOptions) => Promise<any>;
  receive: (callback: (mail: any) => void) => Promise<void>;
}

function normalizeEmailId(id: string): string {
  if (!id) return "";
  let normalized = id.replace(/^[<]+|[>]+$/g, "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(normalized)) return normalized.toLowerCase();
  return normalized;
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

export const replyEmailAction: Action = {
  name: "reply to email",
  similes: ["REPLY_EMAIL", "RESPOND_EMAIL", "CONFIRM_REPLY"],
  description: "Replies to a specified email with a context-aware response, incorporating relevant knowledge.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isValid =
      text.includes("reply to emailid") ||
      text.includes("respond to emailid") ||
      text.includes("reply to this emailid") ||
      text.includes("generate a reply for this emailid") ||
      text.includes("generate a response for this emailid") ||
      text.includes("send reply") ||
      text.includes("confirm reply") ||
      text.includes("reply to email");
    elizaLogger.debug("[EMAIL-PLUGIN] Validating REPLY_EMAIL action", { text, isValid, roomId: runtime.character.id });
    if (!isValid) {
      elizaLogger.warn("[EMAIL-PLUGIN] Email REPLY validation failed", {
        text,
        suggestion: "Try phrasing like 'generate a reply for emailId: <uuid>', 'reply to emailId: <uuid> message: <text>', 'reply to this email', or 'confirm reply'",
      });
    }
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { ragKnowledge?: string },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const fallbackKnowledge: RAGKnowledgeItem[] = options?.ragKnowledge
      ? [{ id: stringToUuid("fallback"), agentId: runtime.agentId, content: { text: options.ragKnowledge } }]
      : [];

    elizaLogger.debug("[EMAIL-PLUGIN] Executing REPLY_EMAIL action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
      ragKnowledge: formatKnowledgeItems(fallbackKnowledge),
    });

    try {
      const emailClientContainer = runtime.clients.find(
        (c) => (c as any).type === "email" || (c as any).name === "EmailClientInterface"
      ) as EmailClientContainer | undefined;

      const emailClient = emailClientContainer?.client;
      if (!emailClient) {
        throw new Error("Email client not initialized");
      }

      const text = message.content.text || "";
      let emailId: string | undefined;
      let body: string | undefined;

      // Check for confirmation of a pending reply email
      if (text.toLowerCase().includes("confirm reply")) {
        const emailIdMatch = text.match(/emailId:\s*([^\s]+)/i);
        const targetEmailId = emailIdMatch ? normalizeEmailId(emailIdMatch[1]) : undefined;

        const recentMemories = await runtime.messageManager.getMemories({
          roomId: runtime.character.id,
          count: 100,
          start: Date.now() - 7 * 24 * 60 * 60 * 1000,
        }) as EmailMemory[];

        const pendingReplyMemory = recentMemories.find(
          (m) =>
            m.content.metadata?.pendingReply &&
            (!targetEmailId || normalizeEmailId(m.content.metadata.emailId || "") === targetEmailId)
        );

        if (!pendingReplyMemory) {
          const response: Content = {
            text: `No pending reply found${targetEmailId ? ` for email UUID: ${targetEmailId}` : ""}. Please initiate a new reply with 'reply to emailId: <uuid>'.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
            thought: `No pending reply found for ${targetEmailId || "any email"}`,
            source: "REPLY_EMAIL",
            user: runtime.character.id,
            createdAt: Date.now(),
            metadata: { ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [] },
          };
          if (callback) await callback(response);
          return false;
        }

        const pendingReply = pendingReplyMemory.content.metadata.pendingReply;
        await emailClient.send(pendingReply);
        await storeReplyToBigQuery(pendingReplyMemory.content.metadata.emailId, {
          subject: pendingReply.subject,
          body: pendingReply.text,
        }, true);

        elizaLogger.debug("[EMAIL-PLUGIN] Sent confirmed reply email", {
          to: pendingReply.to,
          emailUUID: pendingReplyMemory.content.metadata.emailId,
          originalEmailId: pendingReplyMemory.content.metadata.originalEmailId,
          subject: pendingReply.subject,
          threadId: pendingReply.threadId,
        });

        const response: Content = {
          text: `✅ Your reply to ${pendingReply.to} has been sent.`,
          thought: `Confirmed and sent reply to email UUID ${pendingReplyMemory.content.metadata.emailId}`,
          source: "REPLY_EMAIL",
          user: runtime.character.id,
          createdAt: Date.now(),
          metadata: {
            emailId: pendingReplyMemory.content.metadata.emailId,
            originalEmailId: pendingReplyMemory.content.metadata.originalEmailId,
            toAddress: pendingReply.to,
            subject: pendingReply.subject,
            ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [],
          },
        };

        const notificationMemory: Memory = {
          id: stringToUuid(`REPLY_EMAIL_SENT_${pendingReplyMemory.content.metadata.emailId}_${Date.now()}`),
          content: response,
          agentId: runtime.agentId,
          roomId: runtime.character.id,
          userId: runtime.character.id,
          createdAt: Date.now(),
        };

        await runtime.messageManager.createMemory(notificationMemory);
        if (callback) await callback(response);
        return true;
      }

      // Extract emailId and message body
      const emailNumberMatch = text.match(/reply to email (\d+)/i);
      if (emailNumberMatch) {
        const emailNumber = parseInt(emailNumberMatch[1], 10);
        const recentEmails = await fetchRecentEmails(runtime.character.id, 10);
        if (recentEmails[emailNumber - 1]) {
          emailId = recentEmails[emailNumber - 1].id;
        }
      } else {
        const emailIdMatch = text.match(/emailId:\s*([^\s]+)/i);
        if (emailIdMatch) {
          emailId = normalizeEmailId(emailIdMatch[1]);
        } else if (text.toLowerCase().includes("reply to this email")) {
          const recentEmails = await fetchRecentEmails(runtime.character.id, 10);
          if (recentEmails.length) {
            emailId = recentEmails[0].id;
          }
        }
      }

      const bodyMatch = text.match(/message:\s*([^\.]+)/);
      body = bodyMatch ? bodyMatch[1].trim() : undefined;

      if (!emailId || !validateUuid(emailId)) {
        elizaLogger.warn("[EMAIL-PLUGIN] Invalid or missing email UUID", { text, emailId });
        const response: Content = {
          text: `Please specify a valid email UUID to reply to (e.g., 'reply to emailId: <uuid>'). Use 'check emails' to see available email UUIDs.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
          thought: "Invalid or missing email UUID",
          source: "REPLY_EMAIL",
          user: runtime.character.id,
          createdAt: Date.now(),
          metadata: { ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [] },
        };
        if (callback) await callback(response);
        return false;
      }

      // Fetch email from BigQuery
      const [rows] = await bigquery.query(`
        SELECT * FROM \`${datasetId}.${emailsTableId}\`
        WHERE id = '${emailId}'
        LIMIT 1
      `);
      const email = rows[0];

      if (!email) {
        elizaLogger.error("[EMAIL-PLUGIN] Email not found in BigQuery", { emailUUID: emailId });
        const response: Content = {
          text: `Could not find email with UUID: ${emailId}. Please use 'check emails' to verify available email UUIDs.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
          thought: `Email UUID: ${emailId} not found`,
          source: "REPLY_EMAIL",
          user: runtime.character.id,
          createdAt: Date.now(),
          metadata: { ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [] },
        };
        if (callback) await callback(response);
        return false;
      }

      const fromAddress = email.from_address;
      const subject = email.subject || "No subject";
      const threadId = email.thread_id;
      const references = email.references || [];

      if (!fromAddress) {
        elizaLogger.error("[EMAIL-PLUGIN] No sender address found", { emailUUID: emailId });
        const response: Content = {
          text: `Could not reply: No sender address found for email UUID: ${emailId}.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
          thought: "Missing sender address",
          source: "REPLY_EMAIL",
          user: runtime.character.id,
          createdAt: Date.now(),
          metadata: { ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [] },
        };
        if (callback) await callback(response);
        return false;
      }

      // Generate automated reply if no body provided
      if (!body) {
        elizaLogger.debug("[EMAIL-PLUGIN] No body provided, generating automated reply", { emailUUID: emailId });
        const emailBody = await (await import("../utils/bigQuery")).getEmailBody(email.gcs_body_uri);

        const ragKnowledgeItems = await runtime.ragKnowledgeManager.getKnowledge({
          query: emailBody,
          limit: 5,
          agentId: runtime.agentId,
          conversationContext: state?.recentMessagesData?.map(m => m.content.text || "").join("\n") || "",
        });

        body = await generateEmailReply({
          runtime,
          sender: fromAddress,
          subject,
          emailBody,
          emailId,
          context: ragKnowledgeItems,
        });

        elizaLogger.debug("[EMAIL-PLUGIN] Generated reply with RAG knowledge", {
          emailUUID: emailId,
          body,
          ragKnowledge: formatKnowledgeItems(ragKnowledgeItems),
        });

        const replySubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
        const pendingReply: SendEmailOptions = {
          to: fromAddress,
          subject: replySubject,
          text: body,
          threadId,
          references: [...references, email.message_id || emailId],
          inReplyTo: email.message_id || emailId,
        };

        const pendingReplyId = stringToUuid(`PENDING_REPLY_${emailId}_${Date.now()}`);
        const pendingReplyMemory: Memory = {
          id: pendingReplyId,
          content: {
            text: `I have generated a reply for:\n\n emailId: ${emailId}:\n\n\n------\n${body}\n------\n\nTo send this reply, please say 'confirm reply' or 'confirm reply emailId: ${emailId}'.\n\nRelevant knowledge:\n${formatKnowledgeItems(ragKnowledgeItems)}`,
            thought: `Generated automated reply for ${emailId} using BigQuery AI`,
            source: "REPLY_EMAIL",
            user: runtime.character.id,
            createdAt: Date.now(),
            metadata: {
              emailId,
              originalEmailId: email.message_id,
              pendingReply,
              pendingReplyId,
              ragKnowledge: ragKnowledgeItems.map(item => item.id) || [],
              expiresAt: Date.now() + 24 * 60 * 60 * 1000,
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
      }

      // Prepare and send reply
      const replySubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
      const replyOptions: SendEmailOptions = {
        to: fromAddress,
        subject: replySubject,
        text: body,
        threadId,
        references: [...references, email.message_id || emailId],
        inReplyTo: email.message_id || emailId,
      };

      await emailClient.send(replyOptions);
      await storeReplyToBigQuery(emailId, { subject: replySubject, body }, true);

      elizaLogger.debug("[EMAIL-PLUGIN] Sent reply email", {
        to: fromAddress,
        emailUUID: emailId,
        originalEmailId: email.message_id,
        subject: replySubject,
        threadId,
      });

      const response: Content = {
        text: `Your reply with message '${body}' has been sent to ${fromAddress}.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
        thought: `Replied to email UUID ${emailId} with knowledge`,
        source: "REPLY_EMAIL",
        user: runtime.character.id,
        createdAt: Date.now(),
        metadata: {
          emailId,
          originalEmailId: email.message_id,
          toAddress: fromAddress,
          subject: replySubject,
          ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [],
        },
      };

      const notificationMemory: Memory = {
        id: stringToUuid(`REPLY_EMAIL_SENT_${emailId}_${Date.now()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.debug("[EMAIL-PLUGIN] Reply email response stored", {
        memoryId: notificationMemory.id,
        emailUUID: emailId,
        originalEmailId: email.message_id,
        roomId: runtime.character.id,
      });

      if (callback) await callback(response);
      return true;
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] REPLY_EMAIL action failed", {
        error: error.message,
        stack: error.stack,
        roomId: runtime.character.id,
      });
      const response: Content = {
        text: `Sorry, I couldn't send the reply due to an error: ${error.message}. Please try again or use 'check emails' to verify email UUIDs.\n\nRelevant knowledge:\n${formatKnowledgeItems(fallbackKnowledge)}`,
        thought: `Failed to send reply: ${error.message}`,
        source: "REPLY_EMAIL",
        user: runtime.character.id,
        createdAt: Date.now(),
        metadata: { ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [] },
      };
      if (callback) await callback(response);
      return false;
    }
  },

  examples: [
    // ... (keep existing examples unchanged)
  ] as ActionExample[][],
};