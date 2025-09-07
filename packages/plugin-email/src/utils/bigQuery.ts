// packages/plugin-email/src/utils/bigQuery.ts
import { BigQuery } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { elizaLogger, stringToUuid } from '@elizaos/core';
import type { ExtendedEmailContent } from '../types/email';
import {DocumentProcessorServiceClient} from '@google-cloud/documentai';

const bigquery = new BigQuery();
const storage = new Storage();
const documentAiClient = new DocumentProcessorServiceClient();
const datasetId = process.env.BIGQUERY_DATASET_ID || 'agentvooc_dataset';
const emailsTableId = process.env.BIGQUERY_EMAILS_TABLE || 'emails';
const repliesTableId = process.env.BIGQUERY_REPLIES_TABLE || 'email_replies';
const bucketName = process.env.GCS_BUCKET_NAME || 'agentvooc_email_storage';
const modelEndpoint = process.env.BIGQUERY_MODEL_ENDPOINT || 'bigquery-agentvooc-elizaos.agentvooc_dataset.lk';
const multimodalModelEndpoint = 'bigquery-agentvooc-elizaos.agentvooc_dataset.lk'; // Use gemini-2.5-pro for multimodal
const documentAiProcessor = process.env.DOCUMENT_AI_PROCESSOR_ID || 'projects/689975226236/locations/us/processors/b460db91de542ef9';

// Create or replace emails table
export async function createEmailsTable() {
  try {
    const tableExistsAlready = await tableExists(emailsTableId);
    if (tableExistsAlready) {
      elizaLogger.info(`Emails table ${datasetId}.${emailsTableId} already exists, skipping creation`);
      return;
    }

    const query = `
      CREATE TABLE \`${datasetId}.${emailsTableId}\` (
        id STRING NOT NULL,
        user_id STRING NOT NULL,
        from_address STRING,
        subject STRING,
        body STRING,
        timestamp TIMESTAMP,
        message_id STRING,
        thread_id STRING,
        references ARRAY<STRING>,
        gcs_body_uri STRING,
        gcs_attachment_uris ARRAY<STRING>
      )
      PARTITION BY DATE(timestamp)
      OPTIONS (
        description = 'Stores email metadata, body, and flattened attachment references for agentVooc',
        partition_expiration_days = 365
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created emails table: ${datasetId}.${emailsTableId}`);
  } catch (error: any) {
    elizaLogger.error(`Failed to create emails table`, { error: error.message, stack: error.stack });
    throw error;
  }
}

// Create or replace email_replies table
export async function createEmailRepliesTable() {
  try {
    const query = `
      CREATE OR REPLACE TABLE \`${datasetId}.email_replies\` (
        id STRING NOT NULL,
        original_email_id STRING NOT NULL,
        reply_subject STRING,
        reply_body STRING,
        timestamp TIMESTAMP,
        sent_success BOOLEAN
      )
      OPTIONS (
        description = 'Stores email reply metadata for agentVooc'
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created or replaced email_replies table: ${datasetId}.email_replies`);
  } catch (error: any) {
    elizaLogger.error(`Failed to create or replace email_replies table`, { error: error.message, stack: error.stack });
    throw error;
  }
}

// Create or replace email_embeddings table
export async function createEmailEmbeddingsTable() {
  try {
    const query = `
      CREATE OR REPLACE TABLE \`${datasetId}.email_embeddings\` (
        email_id STRING NOT NULL,
        body STRING,
        embedding ARRAY<FLOAT64>,
        created_at TIMESTAMP
      )
      OPTIONS (
        description = 'Stores email embeddings for semantic search in agentVooc'
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created or replaced email_embeddings table: ${datasetId}.email_embeddings`);
  } catch (error: any) {
    elizaLogger.error(`Failed to create or replace email_embeddings table`, { error: error.message, stack: error.stack });
    throw error;
  }
}

// Create or replace email_attachments object table
export async function createAttachmentsObjectTable() {
  try {
    const query = `
      CREATE OR REPLACE EXTERNAL TABLE \`${datasetId}.email_attachments_external\`
      WITH CONNECTION \`bigquery-agentvooc-elizaos.us.agentvooc-connection\`
      OPTIONS (
        object_metadata = 'SIMPLE',
        uris = ['gs://${bucketName}/attachments/*']
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created or replaced email_attachments_external table: ${datasetId}.email_attachments_external`);
  } catch (error: any) {
    elizaLogger.error(`Failed to create or replace email_attachments_external table`, {
      error: error.message,
      stack: error.stack,
      connection: 'bigquery-agentvooc-elizaos.us.agentvooc-connection',
      uris: `gs://${bucketName}/attachments/*`
    });
    throw error;
  }
}

// Create or replace email_attachments metadata table
export async function createAttachmentsMetadataTable() {
  try {
    const query = `
      CREATE OR REPLACE TABLE \`${datasetId}.email_attachments\` (
        email_id STRING NOT NULL,
        file_name STRING NOT NULL,
        gcs_uri STRING NOT NULL,
        content_type STRING,
        size INT64,
        uploaded_at TIMESTAMP,
        attachment_ref STRING,
        extracted_content STRING
      )
      OPTIONS (
        description = 'Stores metadata and extracted content for email attachments in agentVooc'
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created or replaced email_attachments metadata table`);
  } catch (error: any) {
    elizaLogger.error(`Failed to create or replace email_attachments metadata table`, { error: error.message, stack: error.stack });
    throw error;
  }
}

export async function createEmailEmbeddingsVectorIndex() {
  try {
    // Check if the email_embeddings table has enough rows
    const checkQuery = `
      SELECT COUNT(*) AS row_count
      FROM \`${datasetId}.email_embeddings\`
      WHERE embedding IS NOT NULL
    `;
    const [checkRows] = await bigquery.query(checkQuery);
    const rowCount = checkRows[0]?.row_count || 0;

    if (rowCount < 1000) {
      elizaLogger.warn(`[BIGQUERY] Skipping vector index creation: Only ${rowCount} rows in ${datasetId}.email_embeddings, need at least 5000 for IVF index`);
      return false;
    }

    const query = `
      CREATE VECTOR INDEX IF NOT EXISTS email_embeddings_index
      ON \`${datasetId}.email_embeddings\`(embedding)
      OPTIONS (
        index_type = 'IVF',
        distance_type = 'COSINE'
      )
    `;
    await bigquery.query(query);
    elizaLogger.info(`Created vector index on ${datasetId}.email_embeddings`);
    return true;
  } catch (error: any) {
    elizaLogger.warn(`[BIGQUERY] Failed to create vector index`, { error: error.message, stack: error.stack });
    return false; // Return false instead of throwing to prevent breaking the caller
  }
}

// Check if a table exists
async function tableExists(tableId: string): Promise<boolean> {
  try {
    const [exists] = await bigquery.dataset(datasetId).table(tableId).exists();
    return exists;
  } catch (error: any) {
    elizaLogger.error(`Failed to check if table ${datasetId}.${tableId} exists`, { error: error.message, stack: error.stack });
    return false;
  }
}

// Initialize dataset and tables
export async function initializeBigQuery() {
  try {
    await bigquery.dataset(datasetId).get({ autoCreate: true });
    elizaLogger.info(`Dataset ${datasetId} ensured`);

    // Create tables if they don't exist
    await createEmailsTable();
    if (!(await tableExists(repliesTableId))) {
      await createEmailRepliesTable();
    } else {
      elizaLogger.info(`Table ${datasetId}.${repliesTableId} already exists, skipping creation`);
    }
    if (!(await tableExists('email_embeddings'))) {
      await createEmailEmbeddingsTable();
    } else {
      elizaLogger.info(`Table ${datasetId}.email_embeddings already exists, skipping creation`);
    }
    // Attempt to create vector index only if embeddings exist
    await createEmailEmbeddingsVectorIndex();
    if (!(await tableExists('email_attachments'))) {
      await createAttachmentsMetadataTable();
    } else {
      elizaLogger.info(`Table ${datasetId}.email_attachments already exists, skipping creation`);
    }
    if (!(await tableExists('email_attachments_external'))) {
      await createAttachmentsObjectTable();
    } else {
      elizaLogger.info(`Table ${datasetId}.email_attachments_external already exists, skipping creation`);
    }

    elizaLogger.info(`BigQuery initialized for dataset ${datasetId}`);
  } catch (error: any) {
    elizaLogger.error(`Failed to initialize BigQuery`, { error: error.message, stack: error.stack });
    throw error;
  }
}

// Store email to BigQuery + GCS
export async function storeEmailToBigQuery(mail: ExtendedEmailContent & { attachmentContent?: string[] }, userId: string) {
  try {
    elizaLogger.info(`[BIGQUERY] Storing email`, { messageId: mail.messageId, subject: mail.subject });

    // ===== Body =====
    const baseId = encodeURIComponent(mail.messageId || mail.emailUUID || `email-${Date.now()}`);
    const bodyFilePath = `body/${baseId}_body.txt`; // Flattened path: body/<baseId>_body.txt
    const gcsBodyUri = `gs://${bucketName}/${bodyFilePath}`;
    const bodyContent = mail.text || 'No content';

    const bodyBlob = storage.bucket(bucketName).file(bodyFilePath);
    await bodyBlob.save(bodyContent, {
      contentType: 'text/plain',
      metadata: { cacheControl: 'no-cache' },
    });
    elizaLogger.info(`[BIGQUERY] Stored email body in GCS`, { gcsBodyUri, bodyLength: bodyContent.length });

    // ===== Attachments (flattened path) =====
    const gcsAttachmentUris: string[] = [];
    if (mail.attachments && mail.attachments.length > 0) {
      for (let i = 0; i < mail.attachments.length; i++) {
        const attachment = mail.attachments[i];
        try {
          const safeFileName = attachment.filename?.replace(/[^a-zA-Z0-9._-]/g, '_') || `attachment-${Date.now()}-${i}`;
          const attachmentPath = `attachments/${baseId}_${safeFileName}`;
          const gcsAttachmentUri = `gs://${bucketName}/${attachmentPath}`;
          const attachmentRef = attachmentPath;

          const attachmentBlob = storage.bucket(bucketName).file(attachmentPath);
          const content: any = attachment.content;

          let buffer: Buffer;
          if (Buffer.isBuffer(content)) {
            buffer = content;
          } else if (typeof content === 'string') {
            buffer = Buffer.from(content, 'base64');
          } else if (content instanceof Uint8Array) {
            buffer = Buffer.from(content);
          } else {
            throw new Error('Unsupported attachment content type');
          }

          await attachmentBlob.save(buffer, {
            contentType: attachment.contentType || 'application/octet-stream',
            metadata: { cacheControl: 'no-cache' },
          });

          gcsAttachmentUris.push(gcsAttachmentUri);
          elizaLogger.info(`[BIGQUERY] Stored attachment in flattened GCS`, {
            fileName: safeFileName,
            gcsUri: gcsAttachmentUri,
            size: buffer.length,
            attachmentRef,
          });
        } catch (err: any) {
          elizaLogger.warn(`[BIGQUERY] Failed to store attachment`, { error: err.message });
        }
      }
    }

    // ===== BigQuery Insert for Emails =====
    const timestamp =
      mail.date && !isNaN(new Date(mail.date).getTime())
        ? new Date(mail.date).toISOString()
        : new Date().toISOString();

    const row = {
      id: mail.emailUUID,
      user_id: userId,
      from_address: mail.from?.[0]?.address || '',
      subject: mail.subject || '',
      body: bodyContent,
      timestamp,
      message_id: mail.messageId,
      thread_id: mail.threadId,
      references: mail.references || [],
      gcs_body_uri: gcsBodyUri,
      gcs_attachment_uris: gcsAttachmentUris,
    };

    await bigquery
      .dataset(datasetId)
      .table(emailsTableId)
      .insert([row], { ignoreUnknownValues: true });
    elizaLogger.info(`[BIGQUERY] Stored email metadata in BigQuery`, {
      id: mail.emailUUID,
      timestamp,
      attachments: gcsAttachmentUris.length,
    });
  } catch (err: any) {
    elizaLogger.error(`[BIGQUERY] Failed BigQuery insert`, {
      error: err.message,
      emailUUID: mail.emailUUID,
      stack: err.stack,
    });
    throw err;
  }
}

// Fetch email body from GCS
export async function getEmailBody(gcsUri: string): Promise<string> {
  try {
    const filePath = gcsUri.replace(`gs://${bucketName}/`, '');
    const [content] = await storage.bucket(bucketName).file(filePath).download();
    const body = content.toString('utf-8');
    elizaLogger.info(`[BIGQUERY] Fetched email body from GCS`, { gcsUri, bodyLength: body.length });
    return body || 'No content available';
  } catch (error: any) {
    elizaLogger.warn(`[BIGQUERY] Failed to fetch email body from GCS`, { gcsUri, error: error.message });
    return 'No content available';
  }
}

// Generate reply using ML.GENERATE_TEXT with character context
export async function generateReplyWithBigQuery(emailId: string, promptContext: string) {
  try {
    // Fetch attachment content for the email
    const attachmentQuery = `
      SELECT extracted_content
      FROM \`${datasetId}.email_attachments\`
      WHERE email_id = @emailId
    `;
    const attachmentOptions = { query: attachmentQuery, params: { emailId } };
    const [attachmentRows] = await bigquery.query(attachmentOptions);
    const attachmentContent = attachmentRows.map(row => row.extracted_content).join('\n');
    elizaLogger.info(`[BIGQUERY] Retrieved attachment content for reply`, {
      emailId,
      attachmentContentLength: attachmentContent.length,
      attachmentContent: attachmentContent.substring(0, 100) + (attachmentContent.length > 100 ? '...' : ''),
    });

    // Use a generic prompt instead of character-specific prompt
    const genericPrompt = `
      You are a helpful email assistant. Generate a professional and concise reply to the following email:
      Prompt: ${promptContext}
      Attachment Content: ${attachmentContent}
      Please ensure the reply is polite, relevant to the email content, and formatted appropriately for an email response.
    `;

    // Estimate input tokens (~4 chars per token)
    const estimatedInputTokens = Math.ceil(genericPrompt.length / 4);
    elizaLogger.info(`[BIGQUERY] Estimated input tokens: ${estimatedInputTokens}`);

    // Define token limits for gemini-2.5-pro
    const maxOutputTokens = 4096;
    const maxInputTokens = 32768 - maxOutputTokens;


    const query = `
      SELECT 
        ml_generate_text_result AS reply_body, 
        'Re: ' || subject AS reply_subject,
        ml_generate_text_status AS generation_status
      FROM ML.GENERATE_TEXT(
        MODEL \`${multimodalModelEndpoint}\`,
        (
          SELECT @prompt AS prompt, @emailId AS original_email_id, subject
          FROM \`${datasetId}.${emailsTableId}\`
          WHERE id = @emailId
          LIMIT 1
        ),
        STRUCT(
          0.7 AS temperature,
          ${maxOutputTokens} AS max_output_tokens,
          0.95 AS top_p,
          1 AS top_k
        )
      )
    `;

    const options = {
      query,
      params: { prompt: genericPrompt, emailId },
      timeoutMs: 300000,
      location: 'US',
    };

    elizaLogger.info(`[BIGQUERY] Executing reply generation query`, { emailId, maxOutputTokens });

    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();

    if (!rows || rows.length === 0) {
      elizaLogger.warn(`[BIGQUERY] No results returned for email ${emailId}`);
      return {
        reply_subject: 'Re: Original Subject',
        reply_body: 'Thank you for your email. I will get back to you soon.',
      };
    }

    const result = rows[0];

    if (!result.reply_body || result.reply_body.trim().length === 0) {
      elizaLogger.warn(`[BIGQUERY] Empty reply generated for email ${emailId}`, {
        status: result.generation_status,
      });
      return {
        reply_subject: 'Re: Original Subject',
        reply_body: 'Thank you for your email. I will get back to you soon.',
      };
    }

    elizaLogger.info(`[BIGQUERY] Generated reply for email ${emailId}`, {
      reply_subject: result.reply_subject,
      reply_body_length: result.reply_body.length,
    });

    return {
      reply_subject: result.reply_subject,
      reply_body: result.reply_body,
    };
  } catch (error: any) {
    elizaLogger.error(`[BIGQUERY] Failed to generate reply with BigQuery`, {
      error: error.message,
      emailId,
    });
    return {
      reply_subject: 'Re: Original Subject',
      reply_body: 'Thank you for your email. I will get back to you soon.',
    };
  }
}
// Fetch recent emails
export async function fetchRecentEmails(userId: string, limit: number = 50) {
  try {
    const query = `
      SELECT * FROM \`${datasetId}.${emailsTableId}\`
      WHERE user_id = @userId
      ORDER BY timestamp DESC
      LIMIT @limit
    `;
    const options = {
      query,
      params: { userId, limit },
    };
    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
  } catch (error: any) {
    elizaLogger.error(`Failed to fetch recent emails`, { error: error.message });
    return [];
  }
}

// Store sent reply
export async function storeReplyToBigQuery(originalEmailId: string, reply: { subject: string, body: string }, success: boolean) {
  try {
    const row = {
      id: stringToUuid(`${originalEmailId}-reply-${Date.now()}`),
      original_email_id: originalEmailId,
      reply_subject: reply.subject,
      reply_body: reply.body,
      timestamp: new Date().toISOString(),
      sent_success: success,
    };
    await bigquery.dataset(datasetId).table(repliesTableId).insert([row]);
    elizaLogger.info(`Stored reply in BigQuery`, { id: row.id });
  } catch (error: any) {
    elizaLogger.error(`Failed to store reply`, { error: error.message });
    throw error;
  }
}

// Generate embedding for an email
export async function generateEmailEmbedding(emailId: string) {
  try {
    const query = `
      INSERT INTO \`${datasetId}.email_embeddings\` (email_id, body, embedding, created_at)
      SELECT
        id AS email_id,
        content AS body,  -- Use content (aliased from body) to match subquery
        ml_generate_embedding_result AS embedding,
        CURRENT_TIMESTAMP() AS created_at
      FROM ML.GENERATE_EMBEDDING(
        MODEL \`${datasetId}.embedding_model\`,
        (
          SELECT id, body AS content  -- Alias body as content for ML.GENERATE_EMBEDDING
          FROM \`${datasetId}.${emailsTableId}\`
          WHERE id = @emailId
        )
      )
    `;
    const options = { query, params: { emailId } };
    await bigquery.query(options);
    elizaLogger.info(`[BIGQUERY] Generated embedding`, { emailId });
  } catch (error: any) {
    elizaLogger.error(`[BIGQUERY] Failed to generate embedding`, { error: error.message, emailId, stack: error.stack });
    throw error;
  }
}

// Find similar emails using vector search
export async function findSimilarEmails(emailId: string, userId: string, topK: number = 5): Promise<any[]> {
  try {
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
          emails.body,
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
        LIMIT @topK
      `;
    } else {
      elizaLogger.info(`[BIGQUERY] Vector index not found, using text-based search for emailId ${emailId}`);
      query = `
        SELECT
          em.id AS email_id,
          em.from_address,
          em.subject,
          em.body,
          em.gcs_body_uri,
          em.message_id,
          em.timestamp,
          NULL AS distance
        FROM \`${datasetId}.${emailsTableId}\` em
        WHERE em.id != @emailId
          AND em.user_id = @userId
        ORDER BY em.timestamp DESC
        LIMIT @topK
      `;
    }

    const options = { query, params: { emailId, userId, topK } };
    const [job] = await bigquery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    elizaLogger.info(`[BIGQUERY] Found similar emails`, { emailId, count: rows.length });
    return rows;
  } catch (error: any) {
    elizaLogger.error(`[BIGQUERY] Failed to find similar emails for emailId ${emailId}`, { error: error.message, stack: error.stack });
    return [];
  }
}

// Function to wait for streaming buffer with enhanced logging
async function waitForStreamingBuffer(tableId: string, maxWaitMs: number = 120000) {
  const startTime = Date.now();
  let lastEstimatedRows = null;
  while (Date.now() - startTime < maxWaitMs) {
    const [metadata] = await bigquery.dataset(datasetId).table(tableId).getMetadata();
    const estimatedRows = metadata.streamingBuffer?.estimatedRows || 0;
    if (!metadata.streamingBuffer || estimatedRows === 0) {
      elizaLogger.info(`[BIGQUERY] Streaming buffer cleared for ${tableId}`, { estimatedRows });
      return true;
    }
    if (lastEstimatedRows !== estimatedRows) {
      elizaLogger.info(`[BIGQUERY] Streaming buffer still active for ${tableId}`, { estimatedRows });
      lastEstimatedRows = estimatedRows;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  elizaLogger.warn(`[BIGQUERY] Streaming buffer not cleared within ${maxWaitMs}ms for ${tableId}`, { lastEstimatedRows });
  return false;
}

// Process attachments using multimodal capabilities (PDF-focused, extensible for images)
export async function processEmailAttachment(emailId: string, attachmentRef: string): Promise<string> {
  elizaLogger.info(`[BIGQUERY] Starting attachment processing`, { emailId, attachmentRef });

  const expectedUri = `gs://${bucketName}/${attachmentRef}`;

  // Function to verify GCS object
  async function verifyGcsObject(filePath: string): Promise<boolean> {
    const file = storage.bucket(bucketName).file(filePath);
    const [exists] = await file.exists();
    if (!exists) return false;
    const [metadata] = await file.getMetadata();
    return metadata.timeCreated && new Date(metadata.timeCreated) <= new Date();
  }

  try {
    // Verify GCS object
    if (!(await verifyGcsObject(attachmentRef))) {
      elizaLogger.warn(`[BIGQUERY] GCS object not found`, { emailId, attachmentRef, expectedUri });
      return 'Attachment not found in storage';
    }

    // Get GCS metadata
    const file = storage.bucket(bucketName).file(attachmentRef);
    const [metadata] = await file.getMetadata();
    elizaLogger.info(`[BIGQUERY] GCS file metadata`, {
      emailId,
      attachmentRef,
      exists: true,
      size: Number(metadata.size),
      contentType: metadata.contentType,
      updated: metadata.updated,
    });

    if (Number(metadata.size) > 4 * 1024 * 1024) {
      elizaLogger.warn(`[BIGQUERY] Attachment too large`, { emailId, attachmentRef, size: metadata.size });
      return 'Attachment too large to process';
    }

    // Download and log GCS file content preview
    const [content] = await file.download();
    elizaLogger.info(`[BIGQUERY] GCS file content`, {
      emailId,
      attachmentRef,
      contentPreview: content.toString('utf-8').substring(0, 1000),
    });

    const tableContentQuery = `
      SELECT uri, content_type
      FROM \`${datasetId}.email_attachments_external\`
      WHERE uri = @expectedUri
    `;
    const tableContentOptions = { query: tableContentQuery, params: { expectedUri } };
    const [tableRows] = await bigquery.query(tableContentOptions);
    elizaLogger.info(`[BIGQUERY] External table contents`, {
      emailId,
      attachmentRef,
      rows: tableRows,
    });

    // Check for existing row to avoid duplicates
    const dupeQuery = `
      SELECT COUNT(*) AS count
      FROM \`${datasetId}.email_attachments\`
      WHERE email_id = @emailId AND attachment_ref = @attachmentRef
    `;
    const dupeOptions = { query: dupeQuery, params: { emailId, attachmentRef } };
    const [dupeRows] = await bigquery.query(dupeOptions);
    const dupeCount = dupeRows[0]?.count || 0;
    elizaLogger.info(`[BIGQUERY] Duplicate check`, { emailId, attachmentRef, dupeCount });

    if (dupeCount > 0) {
      elizaLogger.info(`[BIGQUERY] Attachment already processed`, { emailId, attachmentRef });
      const verifyQuery = `
        SELECT extracted_content
        FROM \`${datasetId}.email_attachments\`
        WHERE email_id = @emailId AND attachment_ref = @attachmentRef
        LIMIT 1
      `;
      const verifyOptions = { query: verifyQuery, params: { emailId, attachmentRef } };
      const [verifyRows] = await bigquery.query(verifyOptions);
      return verifyRows[0]?.extracted_content || 'No content extracted';
    }

    // Extract text using Google Document AI
    const contentType = metadata.contentType || 'application/octet-stream';
    const request = {
      name: documentAiProcessor,
      rawDocument: {
        content: content.toString('base64'),
        mimeType: contentType,
      },
    };

    const [result] = await documentAiClient.processDocument(request);
    const { document } = result;
    let extractedContent = document.text || 'No content extracted';
    elizaLogger.info(`[BIGQUERY] Document AI extraction completed`, {
      emailId,
      attachmentRef,
      contentLength: extractedContent.length,
      extractedResult: extractedContent.substring(0, 100) + (extractedContent.length > 100 ? '...' : ''),
    });

    if (extractedContent === 'No content extracted') {
      elizaLogger.warn(`[BIGQUERY] No text extracted by Document AI`, { emailId, attachmentRef });
    }

    // Store extracted content in email_attachments
    const insertQuery = `
      INSERT INTO \`${datasetId}.email_attachments\`
      (email_id, file_name, gcs_uri, content_type, size, uploaded_at, attachment_ref, extracted_content)
      VALUES (@emailId, @fileName, @gcsUri, @contentType, @size, @uploadedAt, @attachmentRef, @extractedContent)
    `;
    const insertParams = {
      emailId,
      fileName: attachmentRef.split('/').pop() || 'unknown',
      gcsUri: expectedUri,
      contentType,
      size: Number(metadata.size),
      uploadedAt: metadata.updated,
      attachmentRef,
      extractedContent,
    };
    await bigquery.query({ query: insertQuery, params: insertParams });
    elizaLogger.info(`[BIGQUERY] Stored extracted content in email_attachments`, {
      emailId,
      attachmentRef,
      contentLength: extractedContent.length,
    });

    // Wait for streaming buffer
    await waitForStreamingBuffer('email_attachments', 120000);

    return extractedContent;
  } catch (error: any) {
    elizaLogger.error(`[BIGQUERY] Failed to process attachment`, {
      error: error.message,
      emailId,
      attachmentRef,
      stack: error.stack,
    });
    return 'Failed to extract content from attachment';
  }
}

