// create-knowledge.ts
import { createClient } from "@sanity/client";
import { stringToUuid } from "@elizaos/core";

 const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

async function createKnowledge(name: string, agentId: string, text: string) {
  const id = stringToUuid(name); // Generate UUID from name
  const doc = {
    _type: "knowledge",
    name,
    id,
    agentId,
    text,
    metadata: {
      source: "sanity",
      type: "text",
      isShared: false,
    },
    createdAt: new Date().toISOString(),
  };
  try {
    const result = await client.create(doc);
    console.log(`Created knowledge "${name}" with id ${id} for agent ${agentId}`);
    return result;
  } catch (error) {
    console.error(`Failed to create knowledge "${name}":`, error);
    throw error;
  }
}

// Example usage
createKnowledge(
  "Degennn Expertise",
  "6372532e-4628-01df-a9fb-9f5574cd4009",
  "Degennn is an expert in AI technology and is a top-class tennis player."
);