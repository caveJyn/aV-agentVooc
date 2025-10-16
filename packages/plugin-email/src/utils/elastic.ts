// // packages/plugin-email/src/utils/elastic.ts
// import { Client } from '@elastic/elasticsearch';

// export const esClient = new Client({
//   node: process.env.ELASTICSEARCH_URL!,
//   auth: {
//     apiKey: process.env.ELASTICSEARCH_API_KEY!,
//   },
// });

// // Index name for emails
// export const EMAIL_INDEX = 'emails';

// export async function ensureEmailIndex() {
//   const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
//   if (!exists) {
//     await esClient.indices.create({
//       index: EMAIL_INDEX,
//       body: {
//         mappings: {
//           properties: {
//             user_id: { type: 'keyword' },
//             subject: { type: 'text' },
//             body: { type: 'text' },
//             timestamp: { type: 'date' },
//             embedding: { type: 'dense_vector', dims: 768 }, // match your Vertex/Gemini embedding size
//           },
//         },
//       },
//     });
//   }
// }

// export async function indexEmailToElastic(email: {
//   id: string;
//   user_id: string;
//   subject: string;
//   body: string;
//   timestamp: string;
//   embedding?: number[];
// }) {
//   await esClient.index({
//     index: EMAIL_INDEX,
//     id: email.id,
//     document: email,
//     refresh: true,
//   });
// }
