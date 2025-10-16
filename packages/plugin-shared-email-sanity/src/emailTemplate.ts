import { createClient } from "@sanity/client";
import { elizaLogger } from "@elizaos/core";
import { EmailTemplate } from "./types";

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "d8dkf1en",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: process.env.SANITY_API_VERSION || "2023-05-03",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

export async function getEmailTemplate(agentId: string): Promise<EmailTemplate | null> {
  try {
    const emailTemplate = await sanityClient.fetch<EmailTemplate>(
      `*[_type == "emailTemplate" && agentId == $agentId][0]`,
      { agentId }
    );
    if (!emailTemplate) {
      elizaLogger.warn(`[SHARED-EMAIL-SANITY] No email template found for agentId: ${agentId}`);
      return null;
    }
    return emailTemplate;
  } catch (error) {
    elizaLogger.error("[SHARED-EMAIL-SANITY] Failed to fetch email template", { error, agentId });
    return null;
  }
}

export async function updateEmailTemplate(
  agentId: string,
  templateData: Partial<EmailTemplate>,
  userId: string
): Promise<EmailTemplate | null> {
  try {
    // Validate required fields
    if (templateData.template && !templateData.template.includes('{{body}}')) {
      throw new Error("Template must include {{body}} placeholder");
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!user) {
      throw new Error("User not found in Sanity");
    }

    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: user._id }
    );
    if (!character) {
      throw new Error("Character not found or access denied");
    }

    const existingTemplate = await sanityClient.fetch(
      `*[_type == "emailTemplate" && agentId == $agentId][0]`,
      { agentId }
    );

    const finalTemplateData: EmailTemplate = {
      _type: "emailTemplate",
      agentId,
      position: templateData.position || '',
      emailAddress: templateData.emailAddress || '',
      companyName: templateData.companyName || '',
      instructions: templateData.instructions || '',
      bestRegard: templateData.bestRegard || 'Best regards',
      template: templateData.template || 'Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}\n{{position}}\n{{emailAddress}}\n{{companyName}}',
    };

    let updatedTemplate;
    if (existingTemplate) {
      updatedTemplate = await sanityClient
        .patch(existingTemplate._id)
        .set(finalTemplateData)
        .commit();
    } else {
      updatedTemplate = await sanityClient.create(finalTemplateData);
    }

    elizaLogger.debug(`[SHARED-EMAIL-SANITY] Email template updated for agentId: ${agentId}`);
    return updatedTemplate;
  } catch (error) {
    elizaLogger.error("[SHARED-EMAIL-SANITY] Failed to update email template", { error, agentId });
    throw error;
  }
}