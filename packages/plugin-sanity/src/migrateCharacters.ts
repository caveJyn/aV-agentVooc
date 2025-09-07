// migrate-characters.ts
import { createClient } from "@sanity/client";
import { stringToUuid } from "@elizaos/core";

const client = createClient({
  projectId: "qtnhvmdn",
  dataset: "production",
  apiVersion: "2023-05-03",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

async function migrateCharacters() {
  const characters = await client.fetch('*[_type == "character"]');
  for (const char of characters) {
    if (!char.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(char.id)) {
      const newId = char.id ? stringToUuid(char.id) : stringToUuid(char.name);
      await client.patch(char._id).set({ id: newId }).commit();
      console.log(`Updated character ${char.name} to id ${newId}`);
    }
    // Add directoryItem if missing
    if (!char.knowledge?.some((k: any) => k.directory === "degennn")) {
      await client.patch(char._id).setIfMissing({ knowledge: [] }).append("knowledge", [
        {
          _type: "directoryItem",
          directory: "degennn",
          shared: false,
        },
      ]).commit();
      console.log(`Added directoryItem to ${char.name}`);
    }
  }
}

migrateCharacters();