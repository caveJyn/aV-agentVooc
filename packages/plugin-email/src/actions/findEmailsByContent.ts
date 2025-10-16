import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State, Content, UUID } from "@elizaos/core";
import { elizaLogger, stringToUuid, validateUuid } from "@elizaos/core";
import { BigQuery } from "@google-cloud/bigquery";
import { getEmailBody } from "../utils/bigQuery";

const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET_ID || 'agentvooc_dataset';
const emailsTableId = 'emails';


async function findSimilarEmailsByContent(queryText: string, userId: string, topK: number = 5): Promise<any[]> {
  try {
    const sanitizedQueryText = queryText.replace(/[^a-zA-Z0-9\s.,!?]/g, ' ').trim();
    if (!sanitizedQueryText) {
      elizaLogger.error(`[BIGQUERY] Invalid query text after sanitization`, { queryText });
      return [];
    }

    const [tableMetadata] = await bigquery.dataset(datasetId).table('email_embeddings').getMetadata();
    const hasVectorIndex = !!tableMetadata.vectorIndexConfig;

    let query: string;
    let emailRows: any[] = [];
    if (hasVectorIndex) {
      const embeddingQuery = `
        SELECT ml_generate_embedding_result AS embedding
        FROM ML.GENERATE_EMBEDDING(
          MODEL \`${datasetId}.embedding_model\`,
          (SELECT @queryText AS content)
        )
      `;
      const embeddingOptions = { query: embeddingQuery, params: { queryText: sanitizedQueryText } };
      const [embeddingRows] = await bigquery.query(embeddingOptions);
      if (!embeddingRows.length || !embeddingRows[0]?.embedding) {
        elizaLogger.error(`[BIGQUERY] No embedding generated for query text`, { queryText, sanitizedQueryText });
        return [];
      }
      const queryEmbedding = embeddingRows[0].embedding;

      query = `
        SELECT
          base.email_id AS email_id,
          emails.from_address,
          emails.subject,
          emails.gcs_body_uri,
          emails.message_id,
          emails.timestamp,
          DISTANCE(@queryEmbedding, base.embedding, 'COSINE') AS distance
        FROM \`${datasetId}.email_embeddings\` base
        JOIN \`${datasetId}.${emailsTableId}\` emails
        ON base.email_id = emails.id
        WHERE emails.user_id = @userId
        ORDER BY distance
        LIMIT @topK
      `;
      const options = { query, params: { queryEmbedding, userId, topK } };
      elizaLogger.debug(`[BIGQUERY] Executing vector search`, { query, params: { userId, topK } });
      const [job] = await bigquery.createQueryJob(options);
      emailRows = await job.getQueryResults();
      emailRows = emailRows[0];
    } else {
      elizaLogger.debug(`[BIGQUERY] Vector index not found, using text-based search for query ${sanitizedQueryText}`);
      query = `
        SELECT
          em.id AS email_id,
          em.from_address,
          em.subject,
          em.gcs_body_uri,
          em.message_id,
          em.timestamp,
          NULL AS distance
        FROM \`${datasetId}.${emailsTableId}\` em
        WHERE em.user_id = @userId
          AND LOWER(em.body) LIKE CONCAT('%', LOWER(@queryText), '%')
        ORDER BY em.timestamp DESC
        LIMIT @topK
      `;
      const options = { query, params: { queryText: sanitizedQueryText, userId, topK } };
      const [job] = await bigquery.createQueryJob(options);
      emailRows = await job.getQueryResults();
      emailRows = emailRows[0];
    }

    // Fetch email bodies
    const emailsWithBodies = await Promise.all(
      emailRows.map(async (email) => ({
        ...email,
        body: await getEmailBody(email.gcs_body_uri),
      }))
    );

    elizaLogger.debug(`[BIGQUERY] Found similar emails by content`, { queryText, sanitizedQueryText, count: emailsWithBodies.length });
    return emailsWithBodies;
  } catch (error: any) {
    elizaLogger.error(`[BIGQUERY] Failed to find similar emails by content`, { error: error.message, queryText, stack: error.stack });
    return [];
  }
}

export const findSimilarEmailsAction: Action = {
  name: "FIND_SIMILAR_EMAILS",
  similes: ["SEARCH_SIMILAR_EMAILS", "FIND_EMAILS_BY_CONTENT"],
  description: "Finds emails with content similar to a given email UUID or query text.",
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
      !emailRegex.test(text) &&
      !text.includes("find emails from") &&
      !text.includes("search emails from") &&
      !text.includes("emails from") &&
      (
        text.includes("find similar emails") ||
        text.includes("search similar emails") ||
        text.includes("similar to emailid") ||
        text.includes("emails like") ||
        text.includes("find emails about") ||
        text.includes("search emails about") ||
        isListingIds
      )
    );
    elizaLogger.debug("[EMAIL-PLUGIN] Validating FIND_SIMILAR_EMAILS action", { text, isValid });
    return isValid;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { ragKnowledge?: string },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Executing FIND_SIMILAR_EMAILS action", {
      messageText: message.content.text,
      roomId: runtime.character.id,
    });

    try {
      const text = message.content.text || "";
      let emailId: string | undefined;
      let queryText: string | undefined;

      const isListingIds = (
        text.toLowerCase().includes("what emailid") ||
        text.toLowerCase().includes("list email ids") ||
        text.toLowerCase().includes("which email ids") ||
        text.toLowerCase().includes("emailid do you have") ||
        text.toLowerCase().includes("email ids saved")
      );

      const showFullEmails = text.toLowerCase().includes("show full");

      const emailIdMatch = text.match(/emailId:\s*([^\s]+)/i);
      if (emailIdMatch) {
        emailId = emailIdMatch[1].trim();
        if (!validateUuid(emailId)) {
          const response: Content = {
            text: `Invalid email UUID: ${emailId}. Please provide a valid UUID.`,
            thought: "Invalid email UUID provided",
            source: "FIND_SIMILAR_EMAILS",
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
      } else if (!isListingIds) {
        const queryMatch = text.match(/(?:emails (?:like|about)|similar to)\s*['"]?([^'"}\s,;]+)['"]?\s*(?:[,\n;]|\s*$)/im);
        queryText = queryMatch ? queryMatch[1].trim() : text.replace(/find similar emails|search similar emails|emails like|find emails about|search emails about/i, "").trim();
      }

      let similarEmails: any[] = [];
      if (emailId) {
        const [tableMetadata] = await bigquery.dataset(datasetId).table('email_embeddings').getMetadata();
        const hasVectorIndex = !!tableMetadata.vectorIndexConfig;

        let query: string;
        if (hasVectorIndex) {
          query = `
            WITH query_embedding AS (
              SELECT embedding
              FROM \`${datasetId}.email_embeddings\`
              WHERE email_id = @emailId
            )
            SELECT
              base.email_id AS email_id,
              emails.from_address,
              emails.subject,
              emails.gcs_body_uri,
              emails.message_id,
              emails.timestamp,
              DISTANCE(query_embedding.embedding, base.embedding, 'COSINE') AS distance
            FROM \`${datasetId}.email_embeddings\` base
            JOIN \`${datasetId}.${emailsTableId}\` emails
            ON base.email_id = emails.id
            WHERE base.email_id != @emailId
              AND emails.user_id = @userId
            ORDER BY distance
            LIMIT 5
          `;
        } else {
          elizaLogger.debug(`[BIGQUERY] Vector index not found, using text-based search for emailId ${emailId}`);
          query = `
            SELECT
              em.id AS email_id,
              em.from_address,
              em.subject,
              em.gcs_body_uri,
              em.message_id,
              em.timestamp,
              NULL AS distance
            FROM \`${datasetId}.${emailsTableId}\` em
            WHERE em.id != @emailId
              AND em.user_id = @userId
            ORDER BY em.timestamp DESC
            LIMIT 5
          `;
        }
        const options = { query, params: { emailId, userId: runtime.character.id } };
        const [rows] = await bigquery.query(options);
        similarEmails = await Promise.all(
          rows.map(async (email) => ({
            ...email,
            body: await getEmailBody(email.gcs_body_uri),
          }))
        );
      } else if (queryText) {
        similarEmails = await findSimilarEmailsByContent(queryText, runtime.character.id);
      } else if (isListingIds) {
        const [rows] = await bigquery.query({
          query: `
            SELECT id AS email_id, from_address, subject, gcs_body_uri, message_id, timestamp
            FROM \`${datasetId}.${emailsTableId}\`
            WHERE user_id = @userId
            ORDER BY timestamp DESC
            LIMIT 5
          `,
          params: { userId: runtime.character.id },
        });
        similarEmails = await Promise.all(
          rows.map(async (email) => ({
            ...email,
            body: await getEmailBody(email.gcs_body_uri),
          }))
        );
      } else {
        const response: Content = {
          text: "Please provide an email UUID or query text (e.g., 'find similar emails to emailId: <uuid>' or 'find emails about promotions').",
          thought: "No email UUID or query text provided",
          source: "FIND_SIMILAR_EMAILS",
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

      if (!similarEmails.length) {
        const response: Content = {
          text: `📭 No similar emails found for ${emailId ? `email UUID: ${emailId}` : `query: ${queryText}`}.`,
          thought: "No similar emails found",
          source: "FIND_SIMILAR_EMAILS",
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

      let responseText: string;
      if (isListingIds) {
        const emailIds = similarEmails.map(e => e.email_id).filter(id => id);
        responseText = emailIds.length > 0
          ? `📋 Available email UUIDs:\n${emailIds.map(id => `  • ${id}`).join("\n")}\n\n💡 Use 'reply to emailId: <uuid> message: <text>' to reply.`
          : "📭 No email UUIDs are currently stored.";
      } else {
        responseText = `📬 Found ${similarEmails.length} similar emails:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n`;
        // Note: We avoid formatting here to rely on chat.tsx rendering
      }

      if (options?.ragKnowledge) {
        responseText += `\n\n🧠 Relevant knowledge:\n${"─".repeat(40)}\n${options.ragKnowledge}`;
      }

      const response: Content = {
        text: responseText,
        thought: isListingIds
          ? "Listed available email UUIDs."
          : `Found ${similarEmails.length} emails similar to ${emailId || queryText}`,
        source: "FIND_SIMILAR_EMAILS",
        user: runtime.character.id,
        createdAt: Date.now(),
        metadata: {
          emails: similarEmails.map(e => ({
            id: e.email_id,
            emailId: e.email_id,
            originalEmailId: e.message_id || "",
            messageId: e.message_id,
            from: e.from_address,
            fromName: e.from_address,
            subject: e.subject,
            date: e.timestamp,
            body: e.body, // Include fetched body
            similarityScore: e.distance ? 1 - e.distance : undefined,
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
      elizaLogger.debug("[EMAIL-PLUGIN] FIND_SIMILAR_EMAILS action response stored", {
        memoryId: notificationMemory.id,
        emailCount: similarEmails.length,
        displayMode: showFullEmails ? "full" : "summary",
        roomId: runtime.character.id,
      });

      if (callback) await callback(response);
      return true;
    } catch (error: any) {
      elizaLogger.error("[EMAIL-PLUGIN] FIND_SIMILAR_EMAILS action failed", {
        error: error.message,
        stack: error.stack,
      });
      const response: Content = {
        text: `❌ Sorry, I couldn't find similar emails: ${error.message}\n\n🧠 Relevant knowledge:\n${options?.ragKnowledge || "No relevant knowledge found."}`,
        thought: `Failed to find similar emails: ${error.message}`,
        source: "FIND_SIMILAR_EMAILS",
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
        content: { text: "find similar emails to emailId: 123e4567-e89b-12d3-a456-426614174000" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Found 5 similar emails:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n",
          thought: "Found 5 emails similar to UUID 123e4567-e89b-12d3-a456-426614174000",
          source: "FIND_SIMILAR_EMAILS",
          metadata: { emails: [], displayMode: "summary" },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "find emails about promotions for cloud storage show full" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📬 Found 3 similar emails:\n\n💡 Reply using: 'reply to emailId: <uuid> message: <text>'\n💡 To generate a reply: 'reply to emailId: <uuid>'\n",
          thought: "Found 3 emails similar to query 'promotions for cloud storage'",
          source: "FIND_SIMILAR_EMAILS",
          metadata: { emails: [], displayMode: "full" },
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "list email ids about project updates" },
      },
      {
        user: "{{agent}}",
        content: {
          text: "📋 Available email UUIDs:\n  • <uuid1>\n  • <uuid2>\n\n💡 Use 'reply to emailId: <uuid> message: <text>' to reply.",
          thought: "Listed available email UUIDs.",
          source: "FIND_SIMILAR_EMAILS",
          metadata: { emails: [] },
        },
      },
    ],
  ] as ActionExample[][],
};