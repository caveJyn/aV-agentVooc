import type { Provider, IAgentRuntime, Memory, State, Client, Content } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { EmailClient } from "../clients/emailClient";
import type { ExtendedEmailContent, SendEmailOptions } from "../types"; // Import SendEmailOptions

export interface EmailMetadata {
  from?: { address: string; name?: string }[];
  subject?: string;
  date?: string | Date;
  emailId?: string;
  messageId?: string;
  references?: string[];
  threadId?: string;
  collection?: string;
  originalEmailId?: string;
  originalMessageId?: string;
  originalThreadId?: string;
   user?: string; // Added user property
  pendingReply?: SendEmailOptions; // Added pendingReply property
}

interface EmailMemory extends Memory {
  id: `${string}-${string}-${string}-${string}-${string}`;
  createdAt?: number;
  content: {
    text: string;
    metadata?: EmailMetadata;
    source?: string;
    thought?: string;
    actions?: string[];
    user?: string;
    
  };
}

interface EmailClientContainer extends Client {
  type: string;
  name: string;
  client?: EmailClient;
  stop: (runtime: IAgentRuntime) => Promise<boolean>;
  send: (options: any) => Promise<any>;
  receive: (callback: (mail: any) => void) => Promise<void>;
}

export const emailProvider: Provider = {
  get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Executing EmailProvider", {
      messageText: message.content.text,
      roomId: runtime.character.id,
    });

    try {
      const emailClientContainer = runtime.clients.find(
        c => (c as any).type === "email" || (c as any).name === "EmailClientInterface"
      ) as EmailClientContainer | undefined;

      const emailClient = emailClientContainer?.client;
      if (!emailClient) {
        elizaLogger.error("[EMAIL-PLUGIN] Email client not initialized for EmailProvider", {
          foundContainer: !!emailClientContainer,
          containerDetails: emailClientContainer ? { name: emailClientContainer.name } : null,
        });
        const response: Content = {
          text: "Sorry, I couldn't check emails. Email client not initialized.",
          thought: "Email client not initialized",
          source: "EMAIL_PROVIDER",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        await runtime.messageManager.createMemory({
          id: stringToUuid(`${Date.now()}${Math.random()}`),
          content: response,
          agentId: runtime.agentId,
          roomId: runtime.character.id,
          userId: runtime.character.id,
          createdAt: Date.now(),
        });
        return "";
      }

      const text = message.content.text?.toLowerCase() || "";
      const isRelevant = (
        text.includes("check email") ||
        text.includes("check mail") ||
        text.includes("new email") ||
        text.includes("received email") ||
        text.includes("receive email") ||
        text.includes("have i received") ||
        text.includes("have you received") ||
        text.includes("any email") ||
        text.includes("inbox") ||
        text.includes("mailbox") ||
        text.includes("got any email") ||
        text.includes("what emailid") ||
        text.includes("list email ids") ||
        text.includes("which email ids") ||
        text.includes("emailid do you have") ||
        text.includes("email ids saved") ||
        text.includes("reply to emailid") ||
        text.includes("respond to email") ||
        text.includes("send reply")
      );

      if (!isRelevant) {
        elizaLogger.debug("[EMAIL-PLUGIN] Message not relevant for EmailProvider", { text });
        return "";
      }

      // Trigger email fetch without database check
      await emailClient.receive((mail: ExtendedEmailContent) => {
        elizaLogger.debug("[EMAIL-PLUGIN] Received email during provider fetch", { mail });
      });

      const roomId = runtime.character.id;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const memories = await runtime.messageManager.getMemories({
        roomId,
        count: 50,
        start: oneDayAgo,
      }) as EmailMemory[];

      const emails = memories.filter(
        memory =>
          (memory.content.metadata as EmailMetadata | undefined)?.collection === "emails" &&
          memory.createdAt >= oneDayAgo
      );

      elizaLogger.debug("[EMAIL-PLUGIN] Retrieved emails for provider", {
        emailCount: emails.length,
        roomId,
        emails: emails.map(e => ({
          memoryId: e.id,
          emailId: e.content.metadata?.emailId ?? "",
          from: e.content.metadata?.from?.[0]?.address ?? "Unknown",
          subject: e.content.metadata?.subject ?? "No subject",
          date: e.content.metadata?.date ? new Date(e.content.metadata.date).toISOString() : "Unknown",
        })),
      });

      let responseText: string;
      const isListingIds = (
        text.includes("what emailid") ||
        text.includes("list email ids") ||
        text.includes("which email ids") ||
        text.includes("emailid do you have") ||
        text.includes("email ids saved")
      );

      if (!emails.length) {
        responseText = "No new emails have been received in the last 24 hours.";
      } else if (isListingIds) {
        const emailIds = emails.map(e => e.content.metadata?.emailId ?? "").filter(id => id);
        responseText = emailIds.length > 0
          ? `Available email IDs:\n${emailIds.map(id => `Email ID: ${id}`).join("\n")}`
          : "No email IDs are currently stored.";
      } else {
        const maxEmails = 5;
        const sortedEmails = emails.sort((a, b) => b.createdAt - a.createdAt);
        const emailList = sortedEmails.slice(0, maxEmails).map(email => {
          const metadata: EmailMetadata = email.content.metadata ?? {
            emailId: "",
            originalEmailId: "",
          };
          return `From: ${metadata.from?.[0]?.address ?? "Unknown"}, Subject: ${metadata.subject ?? "No subject"}, Date: ${metadata.date ? new Date(metadata.date).toLocaleString() : "Unknown"}, Email ID: ${metadata.emailId ?? ""}`;
        }).join("\n");
        const moreEmails = emails.length > maxEmails ? `\n...and ${emails.length - maxEmails} more email(s).` : "";
        responseText = `Recent emails:\n${emailList}${moreEmails}`;
      }

      const response: Content = {
        text: responseText,
        source: "EMAIL_PROVIDER",
        user: runtime.character.id,
        thought: isListingIds ? "Listed available email IDs." : "Retrieved recent emails.",
        actions: ["REPLY_EMAIL", "CHECK_EMAIL"],
        createdAt: Date.now(),
        metadata: {
          emails: emails.map(e => ({
            id: e.id,
            emailId: e.content.metadata?.emailId ?? "",
            messageId: e.content.metadata?.messageId,
            from: e.content.metadata?.from?.[0]?.address,
            subject: e.content.metadata?.subject,
            date: e.content.metadata?.date,
            originalEmailId: e.content.metadata?.originalEmailId ?? "",
          })),
        },
      };

      const notificationMemory: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(notificationMemory);
      elizaLogger.debug("[EMAIL-PLUGIN] Email provider response stored", {
        memoryId: notificationMemory.id,
        responseText,
        roomId: runtime.character.id,
      });

      return "";
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] EmailProvider failed", {
        error: error.message,
        stack: error.stack,
        roomId: runtime.character.id,
      });
      const response: Content = {
        text: "Sorry, I couldn't check emails. Please try again later.",
        thought: `Failed to check emails: ${error.message}`,
        source: "EMAIL_PROVIDER",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory({
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      });
      return "";
    }
  },
};