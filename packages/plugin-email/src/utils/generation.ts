// packages/plugin-email/src/utils/generation.ts
import type { IAgentRuntime, RAGKnowledgeItem } from "@elizaos/core";
import { elizaLogger, validateUuid } from "@elizaos/core";
import { generateReplyWithBigQuery } from "./bigQuery";
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();
const datasetId = process.env.BIGQUERY_DATASET_ID || 'agentvooc_dataset';

// Define local email template
const defaultTemplate = {
  template: 'Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}',
  position: '',
  emailAddress: '',
  companyName: '',
  bestRegard: 'Best regards',
  instructions: `
# Instructions:
- Generate only the body of the email reply, without greetings or signatures.
- Write a concise, professional, and context-aware reply to the email.
- Directly answer the question or topic raised in the Email Body using the provided Relevant Knowledge and Attachment Content if applicable.
- If the Relevant Knowledge or Attachment Content contains specific information (e.g., names, places, or facts) relevant to the Email Body, include it explicitly in the response.
- Keep the tone friendly and appropriate for an email response.
- Do not include sensitive information or fabricate details.
- Avoid using placeholders like [Your University/Institution Name]; use the knowledge provided or omit if no relevant knowledge exists.
- Return a structured table with columns: reply_subject, reply_body.
`,
};

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
}: EmailReplyOptions): Promise<string> {
  try {
    const agentId = runtime.agentId;
    if (!agentId || !validateUuid(agentId)) {
      elizaLogger.error("[EMAIL-PLUGIN] Invalid or missing agentId", { agentId });
      throw new Error(`Invalid or missing agentId: ${agentId}`);
    }

    const agentName = runtime.character.name || "Unknown Agent";

    // Use local template
    const emailTemplateStructure = defaultTemplate.template;
    const position = defaultTemplate.position;
    const emailAddress = defaultTemplate.emailAddress;
    const companyName = defaultTemplate.companyName;
    const bestRegard = defaultTemplate.bestRegard;
    const instructions = defaultTemplate.instructions;

    // Fetch attachment content from BigQuery
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
      elizaLogger.info(`[EMAIL-PLUGIN] Raw attachment query results`, {
        emailId,
        rowCount: rows.length,
        rows: rows.map(row => ({ attachment_ref: row.attachment_ref, extracted_content: row.extracted_content })),
      });
      attachmentContent = rows
        .filter(row => row.extracted_content && row.extracted_content !== 'No content extracted' && row.extracted_content !== 'Failed to extract content from attachment')
        .map(row => row.extracted_content);
      elizaLogger.info(`[EMAIL-PLUGIN] Fetched attachment content for email`, {
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

    elizaLogger.info(`[EMAIL-PLUGIN] Prompt context for reply generation`, {
      emailId,
      promptContextLength: promptContext.length,
      attachmentContentIncluded: attachmentContent.length > 0,
    });

    const generated = await generateReplyWithBigQuery(emailId, promptContext, agentId);
    const generatedBody = generated.reply_body || "Thank you for your email. I'll get back to you soon.";
    const replySubject = generated.reply_subject || (subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`);

    const emailTemplateText = emailTemplateStructure
      .replace('{{sender}}', sender.split("@")[0] || "Sender")
      .replace('{{body}}', generatedBody.trim())
      .replace('{{agentName}}', agentName)
      .replace('{{position}}', position)
      .replace('{{emailAddress}}', emailAddress)
      .replace('{{companyName}}', companyName)
      .replace('{{bestRegard}}', bestRegard);

    elizaLogger.info("[EMAIL-PLUGIN] Generated email reply", { emailTemplateText, emailId });
    return emailTemplateText;
  } catch (error: any) {
    elizaLogger.error("[EMAIL-PLUGIN] Failed to generate email reply", { error: error.message, emailId });
    return `Dear ${sender.split("@")[0] || "Sender"},\n\nI'm unable to generate a detailed response at this time. Please provide more details or try again later.`;
  }
}