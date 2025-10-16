// packages/plugin-email/src/utils/generation.ts
import type { IAgentRuntime, RAGKnowledgeItem } from "@elizaos/core";
import { elizaLogger, validateUuid } from "@elizaos/core";
import { getEmailTemplate } from "@elizaos-plugins/plugin-shared-email-sanity";
import { generateReplyWithBigQuery } from "./bigQuery";
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET_ID || 'agentvooc_dataset';

interface EmailReplyOptions {
  runtime: IAgentRuntime;
  sender: string;
  subject: string;
  emailBody: string;
  emailId: string;
  context: RAGKnowledgeItem[];
}

export async function generateEmailReply({
  runtime,
  sender,
  subject,
  emailBody,
  emailId,
  context,
}: EmailReplyOptions): Promise<{ reply_subject: string; reply_body: string }> {
  let agentName = runtime.character.name || "Unknown Agent";
  let bestRegard = "Best regards";

  try {
    const agentId = runtime.agentId;
    if (!agentId || !validateUuid(agentId)) {
      elizaLogger.error("[EMAIL-PLUGIN] Invalid or missing agentId", { agentId });
      throw new Error(`Invalid or missing agentId: ${agentId}`);
    }

    const template = await getEmailTemplate(agentId);
    agentName = runtime.character.name || "Unknown Agent";
    bestRegard = template?.bestRegard || "Best regards";
    const emailTemplateStructure = template?.template || 'Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}';
    const position = template?.position || '';
    const emailAddress = template?.emailAddress || '';
    const companyName = template?.companyName || '';
    const instructions = template?.instructions || `
# Instructions:
- Generate only the body of the email reply, without greetings or signatures.
- Write a concise, professional, and context-aware reply to the email.
- Directly answer the question or topic raised in the Email Body using the provided Relevant Knowledge and Attachment Content if applicable.
- If the Relevant Knowledge or Attachment Content contains specific information (e.g., names, places, or facts) relevant to the Email Body, include it explicitly in the response.
- Keep the tone friendly and appropriate for an email response.
- Do not include sensitive information or fabricate details.
- Avoid using placeholders like [Your University/Institution Name]; use the knowledge provided or omit if no relevant knowledge exists.
- Return a structured JSON object with fields: reply_subject, reply_body.
`;

    let attachmentContent: string[] = [];
    try {
      const query = `
        SELECT extracted_content, attachment_ref
        FROM \`${datasetId}.email_attachments\`
        WHERE email_id = @emailId
      `;
      const options = { query, params: { emailId } };
      const [job] = await bigquery.createQueryJob(options);
      const [rows] = await job.getQueryResults();
      elizaLogger.debug(`[EMAIL-PLUGIN] Raw attachment query results`, {
        emailId,
        rowCount: rows.length,
        rows: rows.map(row => ({ attachment_ref: row.attachment_ref, extracted_content: row.extracted_content })),
      });
      attachmentContent = rows
        .filter(row => row.extracted_content && row.extracted_content !== 'No content extracted' && row.extracted_content !== 'Failed to extract content from attachment')
        .map(row => row.extracted_content);
      elizaLogger.debug(`[EMAIL-PLUGIN] Fetched attachment content for email`, {
        emailId,
        attachmentCount: attachmentContent.length,
        validContent: attachmentContent,
      });
    } catch (error: any) {
      elizaLogger.error(`[EMAIL-PLUGIN] Failed to fetch attachment content`, { error: error.message, emailId });
    }

    const formattedKnowledge = context.length
      ? context
          .map(
            (item, index) =>
              `${index + 1}. ${item.content.text} (Source: ${item.content.metadata?.source || "unknown"})`
          )
          .join("\n")
      : "No relevant knowledge provided.";

    const formattedAttachmentContent = attachmentContent.length
      ? attachmentContent
          .map((content, index) => `${index + 1}. ${content}`)
          .join("\n")
      : "No attachment content available.";

    const promptContext = `
# Task: Generate the body of a reply email for ${agentName}.
Character: ${agentName}
Sender: ${sender}
Subject: ${subject || "No subject"}
Email Body (Question to Answer): ${emailBody}
Email ID: ${emailId}

# Relevant Knowledge:
${formattedKnowledge}

# Attachment Content:
${formattedAttachmentContent}

${instructions}
`;

    elizaLogger.debug(`[EMAIL-PLUGIN] Prompt context for reply generation`, {
      emailId,
      promptContextLength: promptContext.length,
      attachmentContentIncluded: attachmentContent.length > 0,
    });

    const generated = await generateReplyWithBigQuery(emailId, promptContext, agentId);
    let replySubject = generated.reply_subject || (subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`);
    let generatedBody = generated.reply_body || "Thank you for your email. I'll get back to you soon.";

    // Check if the reply_body contains raw JSON output and parse it
    try {
      const parsed = JSON.parse(generatedBody);
      if (parsed.candidates && parsed.candidates[0]?.content?.parts?.[0]?.text) {
        const tableText = parsed.candidates[0].content.parts[0].text;
        elizaLogger.debug("[EMAIL-PLUGIN] Raw table text from JSON", { emailId, tableText });

        // Try to parse as a table first
        const tableRows = tableText.split('\n').filter(line => line.includes('|'));
        const dataRow = tableRows.find(row => {
          const columns = row.split('|').map(s => s.trim());
          return (
            columns.length >= 3 &&
            columns[1] &&
            columns[1] !== 'reply_subject' &&
            !columns[1].startsWith(':---') &&
            columns[2] &&
            columns[2] !== 'reply_body' &&
            !columns[2].startsWith(':---')
          );
        });

        if (dataRow) {
          elizaLogger.debug("[EMAIL-PLUGIN] Selected table data row", { emailId, dataRow });
          const columns = dataRow.split('|').map(s => s.trim());
          if (columns.length >= 3) {
            replySubject = columns[1] || replySubject;
            generatedBody = columns[2] || generatedBody;
          }
        } else {
          // Parse JSON code block
          const jsonMatch = tableText.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch && jsonMatch[1]) {
            const innerJson = JSON.parse(jsonMatch[1]);
            if (innerJson.reply_subject && innerJson.reply_body) {
              // Keep the original replySubject ("Re: hi") as it's correct
              generatedBody = innerJson.reply_body;
              elizaLogger.debug("[EMAIL-PLUGIN] Parsed JSON object from tableText", {
                emailId,
                replySubject, // Keep original
                generatedBodyLength: generatedBody.length,
              });
            } else {
              elizaLogger.warn("[EMAIL-PLUGIN] JSON object missing reply_subject or reply_body", {
                emailId,
                jsonContent: jsonMatch[1],
              });
            }
          } else {
            elizaLogger.warn("[EMAIL-PLUGIN] No JSON code block found in tableText", {
              emailId,
              tableText,
              tableRows,
            });
          }
          elizaLogger.debug("[EMAIL-PLUGIN] No valid table data row found, using parsed JSON body", {
            emailId,
            tableRows,
            originalReplySubject: replySubject,
            generatedBodyLength: generatedBody.length,
          });
        }
      }
    } catch (e) {
      elizaLogger.debug("[EMAIL-PLUGIN] Reply body is not JSON, using as-is", {
        emailId,
        generatedBodyLength: generatedBody.length,
        error: e.message,
      });
    }

    const emailTemplateText = emailTemplateStructure
      .replace('{{sender}}', sender.split("@")[0] || "Sender")
      .replace('{{body}}', generatedBody.trim())
      .replace('{{agentName}}', agentName)
      .replace('{{position}}', position)
      .replace('{{emailAddress}}', emailAddress)
      .replace('{{companyName}}', companyName)
      .replace('{{bestRegard}}', bestRegard);

    elizaLogger.debug("[EMAIL-PLUGIN] Generated email reply", { emailTemplateText, emailId });
    return { reply_subject: replySubject, reply_body: emailTemplateText };
  } catch (error: any) {
    elizaLogger.error("[EMAIL-PLUGIN] Failed to generate email reply", { error: error.message, emailId });
    return {
      reply_subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
      reply_body: `Dear ${sender.split("@")[0] || "Sender"},\n\nI'm unable to generate a detailed response at this time. Please provide more details or try again later.\n\n${bestRegard},\n${agentName}`,
    };
  }
}