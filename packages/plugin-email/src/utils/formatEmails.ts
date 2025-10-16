import { Storage } from "@google-cloud/storage";
import { elizaLogger } from "@elizaos/core";
import { getEmailBody } from "./bigQuery";

const bucketName = 'agentvooc_email_storage';
const storage = new Storage();

export async function formatEmailForDisplay(email: any, index: number, showFullBody: boolean = false): Promise<string> {
  const fromFormatted = email.from_address || "Unknown";
  const subject = email.subject || "No subject";
  const date = email.timestamp && !isNaN(new Date(email.timestamp).getTime())
    ? new Date(email.timestamp).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
  const emailUUID = email.id || email.email_id || "Unknown";
  const body = await getEmailBody(email.gcs_body_uri);

  let formattedEmail = `\n${"═".repeat(60)}\n`;
  formattedEmail += `📧 Email ${index + 1}\n`;
  formattedEmail += `${"─".repeat(60)}\n`;
  formattedEmail += `From: ${fromFormatted}\n`;
  formattedEmail += `Subject: ${subject}\n`;
  formattedEmail += `Date: ${date}\n`;
  formattedEmail += `Email UUID: ${emailUUID}\n`;
  formattedEmail += `Original Email ID: ${email.message_id || "N/A"}\n`;
  formattedEmail += `Similarity Score: ${(1 - (email.distance || 0)).toFixed(4)}\n`;
  formattedEmail += `${"─".repeat(60)}\n`;
  formattedEmail += `Body:\n${showFullBody ? body : body.substring(0, 500) + (body.length > 500 ? "\n\n[Email truncated - use 'show full emails' to see complete content]" : "")}\n`;
  formattedEmail += `${"═".repeat(60)}\n`;

  return formattedEmail;
}