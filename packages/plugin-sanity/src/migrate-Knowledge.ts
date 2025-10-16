// /home/caveman/projects/Bots/eliza-mainn/scripts/migrate-knowledge.ts
import { createClient } from "@sanity/client";
import { stringToUuid } from "@elizaos/core";

 const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

async function migrateKnowledge() {
  const knowledgeDocs = await client.fetch('*[_type == "knowledge"]');
  for (const doc of knowledgeDocs) {
    const updates: any = {};
    if (!doc.name) {
      updates.name = doc.text ? doc.text.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, '') : `Knowledge-${doc._id}`;
    }
    if (!doc.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(doc.id)) {
      updates.id = stringToUuid(updates.name || doc.name || `knowledge-${doc._id}`);
    }
    if (!doc.agentId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(doc.agentId)) {
      updates.agentId = "6372532e-4628-01df-a9fb-9f5574cd4009"; // Adjust as needed
    }
    if (Object.keys(updates).length > 0) {
      await client.patch(doc._id).set(updates).commit();
      console.log(`Updated knowledge ${doc._id} with ${JSON.stringify(updates)}`);
    }
  }
  // Verify character references
  const characters = await client.fetch('*[_type == "character"]');
  for (const char of characters) {
    const knowledge = char.knowledge || [];
    for (const item of knowledge) {
      if (item._type === "reference") {
        const refDoc = await client.getDocument(item._ref);
        if (!refDoc) {
          console.warn(`Character ${char.name}: Reference ${item._ref} not found`);
        } else if (refDoc.id !== item._ref) {
          console.warn(`Character ${char.name}: Reference ${item._ref} has mismatched id ${refDoc.id}`);
        }
      }
    }
  }
}

migrateKnowledge().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});