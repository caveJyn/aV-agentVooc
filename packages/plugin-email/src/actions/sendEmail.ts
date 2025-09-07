import type { Action, ActionExample, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { EmailClient } from "../clients/emailClient";
import type { SendEmailOptions, EmailResponse } from "../types";

export const sendEmailAction: Action = {
  name: "SEND_EMAIL",
  similes: ["SEND_EMAIL", "EMAIL", "SEND_MESSAGE", "COMPOSE_EMAIL"],
  description: "Sends an email to a specified recipient with a subject and body.",
  suppressInitialMessage: true, // Ensure [message] response branch

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Validating SEND_EMAIL action", {
      messageText: message.content.text,
    });

    const text = message.content.text?.toLowerCase() || "";
    const isEmailRequest = text.includes("send an email") || text.includes("email to");
    const hasRecipient = text.match(/to\s*[:=]\s*['"]?[^'"}\s,]+['"]?(?:,|$)/i);

    if (!isEmailRequest || !hasRecipient) {
      return false;
    }

    const emailClient = runtime.clients.find(c => (c as any).type === "email");
    if (!emailClient) {
      elizaLogger.warn("[EMAIL-PLUGIN] Email client not available for SEND_EMAIL");
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.debug("[EMAIL-PLUGIN] Executing SEND_EMAIL action", {
      messageText: message.content.text,
    });

    try {
      const emailClient = runtime.clients.find(c => (c as any).type === "email") as EmailClient | undefined;
      if (!emailClient) {
        elizaLogger.error("[EMAIL-PLUGIN] Email client not initialized for SEND_EMAIL");
        throw new Error("Email client not initialized");
      }

      // Normalize message text
      const text = (message.content.text || "").replace(/\r/g, "").trim();
      elizaLogger.debug("[EMAIL-PLUGIN] Raw message text", { rawText: message.content.text });
      elizaLogger.debug("[EMAIL-PLUGIN] Normalized message text", { text });

      // Lenient regexes for parsing
      const toMatch = text.match(/to\s*[:=]\s*['"]?([^'"}\s,;]+)['"]?\s*(?:[,\n;]|\s*$)/im);
      const subjectMatch = text.match(/subject\s*[:=]\s*['"]?([^'"}\s,;]+)['"]?\s*(?:[,\n;]|\s*$)/im);
      const bodyMatch = text.match(/(?:text|body)\s*[:=]\s*['"]?(.+?)['"]?\s*(?:\n|\s*$)/im);

      const to = toMatch ? toMatch[1].trim() : null;
      const subject = subjectMatch ? subjectMatch[1].trim() : "No subject";
      const body = bodyMatch ? bodyMatch[1].trim() : "No body";

      elizaLogger.debug("[EMAIL-PLUGIN] Parsed email parameters", {
        to,
        subject,
        body,
        bodyLength: body.length,
      });

      if (!to) {
        elizaLogger.warn("[EMAIL-PLUGIN] No recipient specified for SEND_EMAIL");
        const response = {
          thought: "The message didn't specify a recipient for the email.",
          text: "Please provide a recipient email address (e.g., 'to: example@domain.com').",
          actions: ["REPLY"],
          user: runtime.character.id,
          createdAt: Date.now(),
        };

        if (callback) {
          await callback(response);
          elizaLogger.debug("[EMAIL-PLUGIN] Callback invoked with error response", { response });
        }
        return false;
      }

      const result: EmailResponse = await emailClient.send({
        to,
        subject,
        text: body,
      } as SendEmailOptions);

      elizaLogger.debug("[EMAIL-PLUGIN] Email sent successfully", {
        messageId: result.messageId,
        to,
        accepted: result.accepted,
        rejected: result.rejected,
      });

      // Response matching Content type
      const response = {
        thought: `Successfully sent an email to ${to} with subject "${subject}" and body "${body}".`,
        text: `Email sent to ${to}\nSubject: ${subject}\nBody: ${body}`,
        actions: ["REPLY"],
        source: "SEND_EMAIL",
        metadata: { messageId: result.messageId },
      };

      if (callback) {
        await callback(response);
        elizaLogger.debug("[EMAIL-PLUGIN] Callback invoked with success response", { response });
      }

      return true;
    } catch (error) {
      elizaLogger.error("[EMAIL-PLUGIN] SEND_EMAIL action failed", {
        error: error.message,
        stack: error.stack,
        messageText: message.content.text,
      });

      const response = {
        thought: `Failed to send email due to an error: ${error.message}`,
        text: "Sorry, I couldn't send the email. Please check the details and try again.",
        actions: ["REPLY"],
        source: "direct",
        metadata: { error: error.message },
      };

      if (callback) {
        await callback(response);
        elizaLogger.debug("[EMAIL-PLUGIN] Callback invoked with error response", { response });
      }

      return false;
    }
  },

  examples: [
  [
    // Structured email format
    {
      user: "{{user1}}",
      content: {
        text: "send an email to: john@example.com, subject: Meeting Tomorrow, body: Hi John, let's meet tomorrow at 3 PM",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email sent to john@example.com\nSubject: Meeting Tomorrow\nBody: Hi John, let's meet tomorrow at 3 PM",
        thought: "Successfully sent an email to john@example.com with subject \"Meeting Tomorrow\".",
        actions: ["REPLY"],
      },
    },
  ],
  [
    // Natural language format
    {
      user: "{{user1}}",
      content: {
        text: "compose an email to sarah@company.com saying the project is complete",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email sent to sarah@company.com\nSubject: No subject\nBody: the project is complete",
        thought: "Sent an email to sarah@company.com with parsed content.",
        actions: ["REPLY"],
      },
    },
  ],
  [
    // Multiple recipients (if supported)
    {
      user: "{{user1}}",
      content: {
        text: "send email to: john@example.com, cc: sarah@company.com, subject: Team Update, body: Weekly status report",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email sent to john@example.com\nCC: sarah@company.com\nSubject: Team Update\nBody: Weekly status report",
        thought: "Successfully sent email to multiple recipients.",
        actions: ["REPLY"],
      },
    },
  ],
  [
    // Duplicate email request - same recipient and content
    {
      user: "{{user1}}",
      content: {
        text: "send the same email to john@example.com again",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email sent to john@example.com again\nSubject: Meeting Tomorrow\nBody: Hi John, let's meet tomorrow at 3 PM\n\nNote: This is a duplicate of the previous email sent to the same recipient.",
        thought: "Successfully sent duplicate email to john@example.com with the same content as before.",
        actions: ["REPLY"],
      },
    },
  ],
  [
    // Explicit duplicate email with confirmation
    {
      user: "{{user1}}",
      content: {
        text: "send another email to sarah@company.com with subject: Follow-up and body: Just checking in on the project status",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email sent to sarah@company.com\nSubject: Follow-up\nBody: Just checking in on the project status\n\nNote: This is an additional email to this recipient.",
        thought: "Successfully sent follow-up email to sarah@company.com with different content.",
        actions: ["REPLY"],
      },
    },
  ],
  [
    // Resend request after initial failure
    {
      user: "{{user1}}",
      content: {
        text: "try sending that email to mark@company.com again",
      },
    },
    {
      user: "{{agent}}",
      content: {
        text: "✅ Email successfully sent to mark@company.com on retry\nSubject: Project Update\nBody: The project is on track\n\nNote: Previous attempt failed, but this retry was successful.",
        thought: "Retry attempt successful - email was sent after previous failure.",
        actions: ["REPLY"],
      },
    },
  ],
] as ActionExample[][]
};