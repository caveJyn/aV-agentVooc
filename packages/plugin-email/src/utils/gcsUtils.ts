import { Storage } from "@google-cloud/storage";
import { elizaLogger } from "@elizaos/core";

const bucketName = 'agentvooc_email_storage';
const storage = new Storage();

export async function getEmailBody(gcsUri: string): Promise<string> {
  try {
    const filePath = gcsUri.replace(`gs://${bucketName}/`, '');
    const [content] = await storage.bucket(bucketName).file(filePath).download();
    const body = content.toString('utf-8');
    return body || "No content available";
  } catch (error: any) {
    elizaLogger.warn("[EMAIL-PLUGIN] Failed to fetch email body from GCS", { gcsUri, error: error.message });
    return "No content available";
  }
}