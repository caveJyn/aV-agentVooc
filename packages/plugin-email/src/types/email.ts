import type { Service, UUID } from "@elizaos/core";
import type { EmailContent } from "mail-notifier";

interface EmailAttachment {
    filename: string;
    path: string;
    cid?: string;
}

export interface SendEmailOptions {
    from?: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
        inReplyTo?: string; // Added: For email threading (message ID to reply to)
    references?: string | string[]; // Added: For email threading (references to previous messages)
        headers?: Record<string, string>; // Optional headers for threading and custom use
          threadId?: string; // Added to support threading

    }

export interface EmailResponse {
    success: boolean;
    messageId?: string;
    response?: string;
    error?: string;
    accepted?: string[]; // Added: Email addresses accepted by the SMTP server
    rejected?: string[]; // Added: Email addresses rejected by the SMTP serve
    
}


export interface IEmailService extends Service {
    send(options: SendEmailOptions): Promise<EmailResponse>;
    receive(callback: (mail: EmailContent) => void): void;
}

export interface ExtendedEmailContent {
  emailUUID?: string;
  messageId?: string;
  threadId?: string;
  from?: { address: string; name?: string }[];
  subject?: string;
  headers?: Buffer;
  text?: string;
  html?: string;
  uid?: number;
  flags: string[] | (Set<string> & any[])
  date?: string | Date;
  references?: string[];
  attachmentContent?: string[];
  attachments?: Array<{
    filename?: string;
    content: Buffer;
    contentType?: string;
    size?: number;
  }>;
}