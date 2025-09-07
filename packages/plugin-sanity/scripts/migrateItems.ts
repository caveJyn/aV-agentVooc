import { createClient } from "@sanity/client";


const sanityClient = require("@sanity/client")({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET,
    token: process.env.SANITY_WRITE_TOKEN,
    useCdn: false,
  });
  
  async function migrateItems() {
    const items = await sanityClient.fetch(`*[_type == "Item"]`);
    for (const item of items) {
      const newItemType = item.subscription === true ? "subscription" : "one-time";
      await sanityClient
        .patch(item._id)
        .set({ itemType: newItemType })
        .unset(["subscription"])
        .commit();
      console.log(`Migrated item ${item.id} to itemType: ${newItemType}`);
    }
    console.log("Migration complete");
  }
  
  migrateItems().catch(console.error);