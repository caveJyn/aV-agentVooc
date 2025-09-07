import { createClient } from "@sanity/client";

const sanityClient = createClient({
  projectId: "qtnhvmdn",
  dataset: "production",
  apiVersion: "2023-05-03",
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});


async function patchDocument() {
  try {
    const result = await sanityClient
      .patch('KbBv6zpNbYMmCcQ15uLHkn') // document _id
      .set({ id: '87f7e4d3-bffd-0e98-b8ba-32df5fad5736' }) // the field you're updating
      .commit();

    console.log('Patched document:', result);
  } catch (err) {
    console.error('Patch failed:', err.message);
  }
}

patchDocument();
