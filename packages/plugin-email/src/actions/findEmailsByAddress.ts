import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, UUID } from "@elizaos/core";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { BigQuery } from "@google-cloud/bigquery";
import { getEmailBody } from "../utils/gcsUtils";

const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET_ID || 'agentvooc_dataset';
const emailsTableId = 'emails';


export const findEmailsByAddressAction: Action = {
  name: "FIND_EMAILS_BY_ADDRESS",
  similes: ["SEARCH_EMAILS_BY_SENDER", "GET_EMAILS_FROM_ADDRESS"],
  description: "Finds emails from a specific sender address.",
  suppressInitialMessage: true,

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const isListingIds = (
      text.includes("what emailid") ||
      text.includes("list email ids") ||
      text.includes("which email ids") ||
      text.includes("emailid do you have") ||
      text.includes("email ids saved")
    );
    const isValid = (
      (text.includes("find emails from") ||
       text.includes("search emails from") ||
       text.includes("emails from")) &&
      emailRegex.test(text)
    ) || isListingIds;
    elizaLogger.info("[EMAIL-PLUGIN] Validating FIND_EMAILS_BY_ADDRESS action", { text, isValid });
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { ragKnowledge?: string },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.info("[EMAIL-PLUGIN] Executing FIND_EMAILS_BY_ADDRESS action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
    });

    try {
      const text = message.content.text || "";
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const emailMatch = text.match(emailRegex);
      const address = emailMatch ? emailMatch[0].toLowerCase() : null;

      const isListingIds = (
        text.toLowerCase().includes("what emailid") ||
        text.toLowerCase().includes("list email ids") ||
        text.toLowerCase().includes("which email ids") ||
        text.toLowerCase().includes("emailid do you have") ||
        text.toLowerCase().includes("email ids saved")
      );

      const showFullEmails = text.toLowerCase().includes("show full");

      if (!address && !isListingIds) {
        const response: Content = {
          text: "Please provide a valid email address (e.g., 'find emails from k.ullah.93@gmail.com') or request to list email IDs.",
          thought: "No valid email address or list request provided",
          source: "FIND_EMAILS_BY_ADDRESS",
          user: runtime.character.id,
          createdAt: Date.now(),
        };
        if (callback) await callback(response);
        await runtime.messageManager.createMemory({
          id: stringToUuid(`${Date.now()}${Math.random()}`),
          content: response,
          agentId: runtime.agentId,
          roomId: runtime.character.id,
          userId: runtime.character.id,
          createdAt: Date.now(),
        });
        return false;
      }

      // Fetch emails from BigQuery
      let emailRows: any[] = [];
      if (address) {
        const [rows] = await bigquery.query({
          query: `
            SELECT id AS email_id, from_address, subject, gcs_body_uri, message_id, timestamp
            FROM \`${datasetId}.${emailsTableId}\`
            WHERE LOWER(from_address) = @address
              AND user_id = @userId
            ORDER BY timestamp DESC
            LIMIT 10
          `,
          params: { address, userId: runtime.character.id },
        });
        emailRows = rows;
      } else if (isListingIds) {
        const [rows] = await bigquery.query({
          query: `
            SELECT id AS email_id, from_address, subject, gcs_body_uri, message_id, timestamp
            FROM \`${datasetId}.${emailsTableId}\`
            WHERE user_id = @userId
            ORDER BY timestamp DESC
            LIMIT 10
          `,
          params: { userId: runtime.character.id },
        });
        emailRows = rows;
      }

      // Fetch email bodies
      const emailsWithBodies = await Promise.all(
        emailRows.map(async (email) => ({
          ...email,
          body: await getEmailBody(email.gcs_body_uri),
        }))
      );

      let responseText: string;
      if (!emailsWithBodies.length) {
        responseText = address
          ? `📭 No emails found from ${address}.`
          : `📭 No emails found for the user.`;
      } else if (isListingIds) {
        const emailIds = emailsWithBodies.map(e => e.email_id).filter(id => id);
        responseText = emailIds.length > 0
          ? `📋 Available email UUIDs:\n${emailIds.map(id => `  • ${id}`).join("\n")}\n\n💡 Use 'reply to emailId: <uuid> message: <text>' to reply.`
          : "📭 No email UUIDs are currently stored.";
      } else {
        responseText = `📬 Found ${emailsWithBodies.length} emails from ${address}:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n`;
        // Note: We avoid formatting here to rely on chat.tsx rendering
      }

      if (options?.ragKnowledge) {
        responseText += `\n\n🧠 Relevant knowledge:\n${"─".repeat(40)}\n${options.ragKnowledge}`;
      }

      const response: Content = {
        text: responseText,
        thought: isListingIds
          ? "Listed available email UUIDs."
          : `Found ${emailsWithBodies.length} emails from ${address || "user"}`,
        source: "FIND_EMAILS_BY_ADDRESS",
        user: runtime.character.id,
        createdAt: Date.now(),
        metadata: {
          emails: emailsWithBodies.map(e => ({
            id: e.email_id,
            emailId: e.email_id,
            originalEmailId: e.message_id || "",
            messageId: e.message_id,
            from: e.from_address,
            fromName: e.from_address,
            subject: e.subject,
            date: e.timestamp,
            body: e.body, // Include fetched body
          })),
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
      elizaLogger.debug("[EMAIL-PLUGIN] FIND_EMAILS_BY_ADDRESS action response stored", {
        memoryId: notificationMemory.id,
        emailCount: emailsWithBodies.length,
        displayMode: showFullEmails ? "full" : "summary",
        roomId: runtime.character.id,
      });

      if (callback) await callback(response);
      return true;
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] FIND_EMAILS_BY_ADDRESS action failed", {
        error: error.message,
        stack: error.stack,
      });
      const response: Content = {
        text: `❌ Sorry, I couldn't find emails from the specified address: ${error.message}\n\n🧠 Relevant knowledge:\n${options?.ragKnowledge || "No relevant knowledge found."}`,
        thought: `Failed to find emails by address: ${error.message}`,
        source: "FIND_EMAILS_BY_ADDRESS",
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
        content: { text: "find emails from k.ullah.93@gmail.com" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Found 5 emails from k.ullah.93@gmail.com:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n",
          thought: "Found 5 emails from k.ullah.93@gmail.com",
          source: "FIND_EMAILS_BY_ADDRESS",
          metadata: { emails: [], displayMode: "summary" },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "search emails from sarah@company.com show full" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Found 3 emails from sarah@company.com:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n",
          thought: "Found 3 emails from sarah@company.com with full content",
          source: "FIND_EMAILS_BY_ADDRESS",
          metadata: { emails: [], displayMode: "full" },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "list email ids from k.ullah.93@gmail.com" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📋 Available email UUIDs:\n  • <uuid1>\n  • <uuid2>\n\n💡 Use 'reply to emailId: <uuid> message: <text>' to reply.",
          thought: "Listed available email UUIDs.",
          source: "FIND_EMAILS_BY_ADDRESS",
          metadata: { emails: [] },
        },
      },
    ],
  ] as ActionExample[][],
};