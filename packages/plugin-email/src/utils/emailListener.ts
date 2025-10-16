// packages/plugin-email/src/utils/emailListener.ts
import type { IAgentRuntime, Memory } from '@elizaos/core';
import { elizaLogger, stringToUuid, validateUuid } from '@elizaos/core';
import { EmailClient } from '../clients/emailClient';
import { emailProvider } from '../providers/emailProvider';
import { type ExtendedEmailContent } from '../types';
import { simpleParser } from 'mailparser';
import { fetchRecentEmails, storeEmailToBigQuery, generateEmailEmbedding, processEmailAttachment, initializeBigQuery, createEmailEmbeddingsVectorIndex } from './bigQuery';

// import { ensureEmailIndex, indexEmailToElastic } from './elastic';


const REGULAR_NOTIFICATION_INTERVAL = 60000; // 60 seconds

interface EmailMetadata {
  from?: { address?: string; name?: string }[];
  subject?: string;
  date?: string | Date;
  emailId?: string;
  messageId?: string;
  references?: string[];
  threadId?: string;
  collection: string;
  originalEmailId?: string;
  originalMessageId?: string;
  originalThreadId?: string;
  body?: string;
  attachmentContent?: string[];
}

interface EmailMemory extends Omit<Memory, 'content'> {
  content: {
    text: string;
    metadata?: EmailMetadata;
    action?: string;
    source?: string;
    url?: string;
    inReplyTo?: `${string}-${string}-${string}-${string}-${string}` | undefined;
    attachments?: any[];
    attachmentContent?: string[];
  };
}

export function setupEmailListener(runtime: IAgentRuntime, emailClient: EmailClient) {
  elizaLogger.info(`[EmailListener:${runtime.character.id}] Setting up email listener`, { roomId: runtime.character.id });

  const intervals: NodeJS.Timeout[] = [];

  // Initialize BigQuery to ensure all tables exist
  (async () => {
    try {
      await initializeBigQuery();
      elizaLogger.info(`[EmailListener:${runtime.character.id}] BigQuery initialized successfully`);
    } catch (error: any) {
      elizaLogger.error(`[EmailListener:${runtime.character.id}] Failed to initialize BigQuery`, {
        error: error.message,
        stack: error.stack,
      });
      throw error; // Stop the listener setup if initialization fails
    }
  })();
  emailClient.receive(async (mail: ExtendedEmailContent) => {
    elizaLogger.info(`[EmailListener:${runtime.character.id}] Received email`, {
      messageId: mail.messageId,
      from: mail.from,
      subject: mail.subject,
      roomId: runtime.character.id,
    });

    // Parse email to extract clean body
    let parsedBody = mail.text || mail.subject || 'No content';
    let attachments: ExtendedEmailContent['attachments'] = [];
    let attachmentContent: string[] = [];

    try {
      const parsed = await simpleParser(mail.text || '');
      parsedBody = parsed.text || parsed.textAsHtml || mail.subject || 'No content';
      parsedBody = parsedBody
        .split(/^-{2,}\s*Original Message\s*-{2,}|^-{2,}\s*Forwarded Message\s*-{2,}/gim)[0]
        .trim();
      attachments = parsed.attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
        size: attachment.size,
      }));
      
      elizaLogger.info(`[EmailListener:${runtime.character.id}] Parsed email`, {
        parsedBody,
        emailUUID: mail.emailUUID,
        attachmentCount: attachments.length,
      });
    } catch (error: any) {
      elizaLogger.warn(`[EmailListener:${runtime.character.id}] Failed to parse email`, {
        error: error.message,
        emailUUID: mail.emailUUID,
      });
    }

    const emailUUID = mail.emailUUID || stringToUuid(mail.messageId || `${Date.now()}${Math.random()}`);
    if (!validateUuid(emailUUID)) {
      elizaLogger.error(`[EmailListener:${runtime.character.id}] Generated invalid email UUID`, {
        emailUUID,
        originalEmailId: mail.messageId,
      });
      throw new Error(`Invalid email UUID generated for messageId: ${mail.messageId}`);
    }


    // Store email to BigQuery and GCS with parsed body and flattened attachments
    try {
      await storeEmailToBigQuery({ ...mail, text: parsedBody, attachments }, runtime.character.id);
      elizaLogger.info(`[EmailListener:${runtime.character.id}] Stored email to BigQuery`, {
        emailUUID,
        subject: mail.subject,
        roomId: runtime.character.id,
      });
    } catch (error: any) {
      elizaLogger.error(`[EmailListener:${runtime.character.id}] Failed to store email`, {
        error: error.message,
        emailUUID: mail.emailUUID,
      });
      return;
    }
    

    // Process each attachment after storing to GCS to extract content
    for (const attachment of attachments) {
      const safeFileName = attachment.filename?.replace(/[^a-zA-Z0-9._-]/g, '_') || `attachment-${Date.now()}`;
      const baseId = encodeURIComponent(mail.messageId || mail.emailUUID || `email-${Date.now()}`);
      const attachmentRef = `attachments/${baseId}_${safeFileName}`;
      try {
        const senderName = mail.from?.[0]?.name || 'unknown';
        const extractedContent = await processEmailAttachment(emailUUID, attachmentRef);
        attachmentContent.push(extractedContent);
        elizaLogger.info(`[EmailListener:${runtime.character.id}] Processed attachment`, {
          emailUUID,
          attachmentRef,
          extractedContentLength: extractedContent.length,
        });
      } catch (error: any) {
        elizaLogger.warn(`[EmailListener:${runtime.character.id}] Failed to process attachment`, {
          error: error.message,
          emailUUID,
          attachmentRef,
        });
        attachmentContent.push('Failed to extract content from attachment');
      }
    }

    // Generate embedding
  try {
    await generateEmailEmbedding(emailUUID);
    elizaLogger.info(`[EmailListener:${runtime.character.id}] Generated embedding for email`, { emailUUID });
  } catch (error: any) {
    elizaLogger.error(`[EmailListener:${runtime.character.id}] Failed to generate embedding`, {
      error: error.message,
      emailUUID,
      stack: error.stack,
    });
  }


  // Ensure Elastic index exists
// try {
//   await ensureEmailIndex();
// } catch (error: any) {
//   elizaLogger.error(`[EmailListener:${runtime.character.id}] Failed to ensure Elastic index`, {
//     error: error.message,
//     emailUUID,
//   });
// }

// // Index email into Elastic
// try {
//   // Fetch the embedding vector you just created from BigQuery
//   const [embedding] = await fetchEmbeddingFromBigQuery(emailUUID);

//   await indexEmailToElastic({
//     id: emailUUID,
//     user_id: runtime.character.id,
//     subject: mail.subject || '',
//     body: parsedBody,
//     timestamp: new Date(mail.date || Date.now()).toISOString(),
//     embedding,
//   });

//   elizaLogger.info(`[EmailListener:${runtime.character.id}] Indexed email into Elastic`, {
//     emailUUID,
//     subject: mail.subject,
//   });
// } catch (error: any) {
//   elizaLogger.error(`[EmailListener:${runtime.character.id}] Failed to index email to Elastic`, {
//     error: error.message,
//     emailUUID,
//   });
// }



  // Attempt vector index creation
  try {
    const indexCreated = await createEmailEmbeddingsVectorIndex();
    if (indexCreated) {
      elizaLogger.info(`[EmailListener:${runtime.character.id}] Successfully created or verified vector index`, { emailUUID });
    }
  } catch (error: any) {
    elizaLogger.warn(`[EmailListener:${runtime.character.id}] Failed to create vector index`, {
      error: error.message,
      emailUUID,
      stack: error.stack,
    });
  }

  
    

    // Check for importance
    const isImportant =
      mail.from?.some((f) => f.address?.toLowerCase().includes('important@domain.com')) ||
      mail.subject?.toLowerCase().includes('urgent') ||
      mail.text?.toLowerCase().includes('urgent');

    if (isImportant) {
      const syntheticMessage: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: { text: 'New important email received' },
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };
      elizaLogger.info(`[EmailListener:${runtime.character.id}] Triggering important email notification`, {
        emailUUID,
        originalEmailId: mail.messageId,
        subject: mail.subject,
        roomId: runtime.character.id,
      });
      await emailProvider.get(runtime, syntheticMessage);
    }
  });

  // Periodic notification for new emails
  intervals.push(
    setInterval(async () => {
      const recentEmails = await fetchRecentEmails(runtime.character.id, 10);
      if (recentEmails.length === 0) return;
      const syntheticMessage: Memory = {
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: { text: `You have ${recentEmails.length} new email${recentEmails.length > 1 ? 's' : ''}` },
        agentId: runtime.agentId,
        roomId: runtime.character.id,
        userId: runtime.character.id,
        createdAt: Date.now(),
      };
      elizaLogger.info(`[EmailListener:${runtime.character.id}] Triggering regular email notification`, {
        count: recentEmails.length,
        roomId: runtime.character.id,
      });
      await emailProvider.get(runtime, syntheticMessage);
    }, REGULAR_NOTIFICATION_INTERVAL)
  );

  process.on('SIGTERM', async () => {
    intervals.forEach(clearInterval);
    await emailClient.stop();
  });

  elizaLogger.info(`[EmailListener:${runtime.character.id}] Email listener setup complete`, {
    roomId: runtime.character.id,
  });
}