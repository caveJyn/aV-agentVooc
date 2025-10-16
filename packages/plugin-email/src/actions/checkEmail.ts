// packages/plugin-email/src/actions/checkEmail.ts
import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, UUID } from "@elizaos/core";
import { elizaLogger, stringToUuid, validateUuid } from "@elizaos/core";
import { EmailClient } from "../clients/emailClient";
import { fetchRecentEmails } from "../utils/bigQuery";
import { formatEmailForDisplay } from "../utils/formatEmails";
import { getEmailBody } from "../utils/bigQuery"


interface EmailClientContainer {
  client?: EmailClient;
  stop: (runtime: IAgentRuntime) => Promise<boolean>;
  send: (options: any) => Promise<any>;
  receive: (callback: (mail: any) => void) => Promise<void>;
}

export const checkEmailAction: Action = {
  name: "CHECK_EMAIL",
  similes: ["CHECK_EMAIL", "CHECK_MAIL", "RECEIVE_EMAIL"],
  description: "Checks for new emails and stores them for display, incorporating relevant knowledge.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const isValid = (
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
      text.includes("show email") ||
      text.includes("display email") ||
      text.includes("read email")
    );
    elizaLogger.debug("[EMAIL-PLUGIN] Validating CHECK_EMAIL action", { text, isValid });
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { ragKnowledge?: string },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Executing CHECK_EMAIL action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
      ragKnowledge: options?.ragKnowledge,
    });

    try {
      const emailClientContainer = runtime.clients.find(
        c => (c as any).type === "email" || (c as any).name === "EmailClientInterface"
      ) as EmailClientContainer | undefined;

      const emailClient = emailClientContainer?.client;
      if (!emailClient) {
        elizaLogger.error("[EMAIL-PLUGIN] Email client not initialized for CHECK_EMAIL");
        const response: Content = {
          text: "Sorry, I couldn't check emails. Email client not initialized.\n\nRelevant knowledge:\n" + (options?.ragKnowledge || "No relevant knowledge found."),
          thought: "Email client not initialized",
          source: "CHECK_EMAIL",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        return false;
      }

      const emails = await fetchRecentEmails(runtime.character.id, 50);
      elizaLogger.debug("[EMAIL-PLUGIN] Retrieved emails from BigQuery", {
        emailCount: emails.length,
        roomId: runtime.character.id,
      });

      // Fetch email bodies for metadata
      const emailsWithBodies = await Promise.all(
        emails.map(async (email) => ({
          ...email,
          body: await getEmailBody(email.gcs_body_uri),
        }))
      );

      let responseText: string;
      const isListingIds = (
        message.content.text?.toLowerCase().includes("what emailid") ||
        message.content.text?.toLowerCase().includes("list email ids") ||
        message.content.text?.toLowerCase().includes("which email ids") ||
        message.content.text?.toLowerCase().includes("emailid do you have") ||
        message.content.text?.toLowerCase().includes("email ids saved")
      );

      const showFullEmails = (
        message.content.text?.toLowerCase().includes("show full") ||
        message.content.text?.toLowerCase().includes("display full") ||
        message.content.text?.toLowerCase().includes("complete email") ||
        message.content.text?.toLowerCase().includes("full email")
      );

      if (!emails.length) {
        responseText = "📭 No new emails have been received in the last 24 hours.";
      } else if (isListingIds) {
        const emailIds = emails.map(e => e.id).filter(id => id);
        responseText = emailIds.length > 0
          ? `📋 Available email UUIDs:\n${emailIds.map(id => `  • ${id}`).join("\n")}\n\n💡 Use 'reply to emailId: <uuid> message: <text>' to reply.`
          : "📭 No email UUIDs are currently stored.";
      } else {
        responseText = `📬 Here are your emails from the last 24 hours:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n`;
        const emailPromises = emailsWithBodies.map(async (email, index) => {
          return await formatEmailForDisplay(email, index, showFullEmails);
        });
        responseText += (await Promise.all(emailPromises)).join('');
      }

      if (options?.ragKnowledge) {
        responseText += `\n\n🧠 Relevant knowledge:\n${"─".repeat(40)}\n${options.ragKnowledge}`;
      }

      const response: Content = {
        text: responseText,
        source: "CHECK_EMAIL",
        user: runtime.character.id,
        thought: isListingIds
          ? "Listed available email UUIDs."
          : showFullEmails
            ? "Retrieved and displayed full emails."
            : "Retrieved emails with enhanced formatting for display.",
        actions: ["REPLY_EMAIL", "CHECK_EMAIL"],
        createdAt: Date.now(),
        metadata: {
          emails: emailsWithBodies.map(e => ({
            id: e.id,
            emailId: e.id,
            originalEmailId: e.message_id || "",
            messageId: e.message_id,
            from: e.from_address,
            fromName: e.from_address,
            subject: e.subject,
            date: e.timestamp,
            body: e.body, // Include the fetched body
          })),
          ragKnowledge: state?.ragKnowledgeData?.map(item => item.id) || [],
          displayMode: showFullEmails ? "full" : "summary",
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
      elizaLogger.debug("[EMAIL-PLUGIN] CHECK_EMAIL action response stored", {
        memoryId: notificationMemory.id,
        emailCount: emails.length,
        displayMode: showFullEmails ? "full" : "summary",
        roomId: runtime.character.id,
      });

      if (callback) await callback(response);
      return true;
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] CHECK_EMAIL action failed", {
        error: error.message,
        stack: error.stack,
        roomId: runtime.character.id,
      });
      const response: Content = {
        text: `❌ Sorry, I couldn't check emails. Please try again later.\n\n🧠 Relevant knowledge:\n${options?.ragKnowledge || "No relevant knowledge found."}`,
        thought: `Failed to check emails: ${error.message}`,
        source: "CHECK_EMAIL",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      const memory: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory(memory);
      elizaLogger.debug("[EMAIL-PLUGIN] Stored error memory", { memoryId: memory.id });
      if (callback) await callback(response);
      return false;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "check emails", action: "CHECK_EMAIL" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Here are your emails from the last 24 hours:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'",
          action: "CHECK_EMAIL",
          metadata: { emails: [] },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "show full emails", action: "CHECK_EMAIL" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Here are your complete emails from the last 24 hours:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'",
          action: "CHECK_EMAIL",
          metadata: { emails: [], displayMode: "full" },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "any new emails?", action: "CHECK_EMAIL" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Here are your emails from the last 24 hours:",
          action: "CHECK_EMAIL",
          metadata: { emails: [] },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "check my inbox", action: "CHECK_EMAIL" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📭 No new emails have been received in the last 24 hours.",
          action: "CHECK_EMAIL",
          metadata: { emails: [] },
        },
      },
    ],
  ] as ActionExample[][]
};