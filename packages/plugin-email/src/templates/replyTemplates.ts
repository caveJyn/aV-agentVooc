import { EmailMetadata } from "../providers/emailProvider";

export interface ReplyTemplate {
  name: string;
  condition: (metadata: EmailMetadata, emailBody: string) => boolean;
  generateBody: (metadata: EmailMetadata, emailBody: string, analysis: EmailAnalysis) => string;
}

// Simple analysis interface for email content
interface EmailAnalysis {
  isQuestion: boolean;
  isUrgent: boolean;
  keyTopics: string[];
  greeting: string;
  senderName: string;
}

function analyzeEmail(emailBody: string, metadata: EmailMetadata): EmailAnalysis {
  const bodyLower = emailBody.toLowerCase();
  const isQuestion = /\?$/.test(emailBody.trim()) || bodyLower.includes("can you") || bodyLower.includes("please let me know");
  const isUrgent = bodyLower.includes("urgent") || bodyLower.includes("immediately") || metadata.subject?.toLowerCase().includes("urgent");
  const keyTopics = extractKeyTopics(bodyLower);
  const senderName = metadata.from?.[0]?.name || metadata.from?.[0]?.address?.split("@")[0] || "Sender";
  const greeting = isQuestion ? `Dear ${senderName}, thank you for reaching out` : `Dear ${senderName}, thank you for your email`;

  return {
    isQuestion,
    isUrgent,
    keyTopics,
    greeting,
    senderName,
  };
}

function extractKeyTopics(body: string): string[] {
  // Basic keyword extraction (extend with NLP if available)
  const topics = [];
  if (body.includes("meeting")) topics.push("meeting");
  if (body.includes("project")) topics.push("project");
  if (body.includes("deadline")) topics.push("deadline");
  if (body.includes("question") || body.includes("?")) topics.push("question");
  return topics.length > 0 ? topics : ["general"];
}

export const defaultTemplates: ReplyTemplate[] = [
  {
    name: "generic",
    condition: (_metadata: EmailMetadata, _emailBody: string) => true, // Fallback template
    generateBody: (metadata: EmailMetadata, emailBody: string, analysis: EmailAnalysis) => {
      const topics = analysis.keyTopics.join(", ");
      return `
${analysis.greeting},

Thank you for your email${analysis.keyTopics.length > 0 ? ` regarding ${topics}` : ""}. I'll get back to you soon with more details.

Best regards,
${metadata.user || "agentVooc"}
      `;
    },
  },
  {
    name: "urgent",
    condition: (_metadata: EmailMetadata, emailBody: string) =>
      emailBody.toLowerCase().includes("urgent") ||
      _metadata.subject?.toLowerCase().includes("urgent"),
    generateBody: (metadata: EmailMetadata, emailBody: string, analysis: EmailAnalysis) => `
${analysis.greeting},

I understand your request is urgent${analysis.keyTopics.length > 0 ? ` regarding ${analysis.keyTopics.join(", ")}` : ""}. I'm addressing it promptly and will provide a detailed response shortly.

Best regards,
${metadata.user || "agentVooc"}
    `,
  },
  {
    name: "question",
    condition: (_metadata: EmailMetadata, emailBody: string) =>
      /\?$/.test(emailBody.trim()) ||
      emailBody.toLowerCase().includes("can you") ||
      emailBody.toLowerCase().includes("please let me know"),
    generateBody: (metadata: EmailMetadata, emailBody: string, analysis: EmailAnalysis) => `
${analysis.greeting},

Thank you for your question${analysis.keyTopics.length > 0 ? ` about ${analysis.keyTopics.join(", ")}` : ""}. I'm looking into it and will provide a detailed answer soon.

Best regards,
${metadata.user || "agentVooc"}
    `,
  },
  // Add more templates as needed
];

// Utility to select the best template
export function selectTemplate(metadata: EmailMetadata, emailBody: string): ReplyTemplate {
  const analysis = analyzeEmail(emailBody, metadata);
  return (
    defaultTemplates.find((template) => template.condition(metadata, emailBody)) || defaultTemplates[0]
  );
}

// Utility to generate body with analysis
export function generateReplyBody(template: ReplyTemplate, metadata: EmailMetadata, emailBody: string): string {
  const analysis = analyzeEmail(emailBody, metadata);
  return template.generateBody(metadata, emailBody, analysis);
}