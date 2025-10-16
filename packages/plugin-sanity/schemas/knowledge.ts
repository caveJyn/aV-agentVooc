// Sanity schema (e.g., knowledge.js)
export default {
    name: 'knowledge',
    type: 'document',
    title: 'Knowledge',
    fields: [
        {
            name: 'name',
            type: 'string',
            title: 'Name',
            validation: Rule =>
              Rule.required().custom(async (value, context) => {
                const { document, getClient } = context;
                const client = getClient({ apiVersion: "2023-05-03" });
                const query = `*[_type == "knowledge" && name == $name && _id != $currentId]{_id}`;
                const params = { name: value, currentId: document._id || "" };
                const result = await client.fetch(query, params);
                return result.length === 0 || "Name must be unique";
              }),
            description: "Human-readable name (e.g., 'Degennn Expertise'). Must be unique.",
        },
        {
            name: 'id',
            type: 'string',
            title: 'ID',
            validation: (Rule) =>
              Rule.required()
                .regex(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                  "Must be a valid UUID"
                )
                .custom(async (value, context) => {
                  const { document, getClient } = context;
                  const client = getClient({ apiVersion: "2023-05-03" });
                  const query = `*[_type == "knowledge" && id == $id && _id != $currentId]{_id}`;
                  const params = { id: value, currentId: document._id || "" };
                  const result = await client.fetch(query, params);
                  if (result.length > 0) {
                    return "ID must be unique";
                  }
                  if (document._id && !document._id.startsWith('drafts.')) {
                    const originalDoc = await client.getDocument(document._id);
                    if (originalDoc && originalDoc.id && originalDoc.id !== value) {
                      return "ID cannot be changed after creation";
                    }
                  }
                  return true;
                }),
            description: "Unique UUID generated from name (e.g., '4694d738-583f-4d0a-893f-80ff4579d2ab').",
        },
        {
            name: 'agentId',
            type: 'string',
            title: 'Agent ID',
            validation: Rule =>
              Rule.required().regex(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                "Must be a valid UUID"
              ),
        },
        {
            name: 'text',
            type: 'text',
            title: 'Content Text',
            validation: Rule => Rule.required(),
        },
        {
            name: 'metadata',
            type: 'object',
            title: 'Metadata',
            fields: [
                { name: 'source', type: 'string', title: 'Source' },
                { name: 'type', type: 'string', title: 'Type' },
                { name: 'isShared', type: 'boolean', title: 'Is Shared' },
                { name: 'isMain', type: 'boolean', title: 'Is Main' },
                { name: 'isChunk', type: 'boolean', title: 'Is Chunk' },
                { name: 'originalId', type: 'string', title: 'Original ID' },
                { name: 'chunkIndex', type: 'number', title: 'Chunk Index' },
 {
          name: 'images',
          type: 'array',
          title: 'Images',
          of: [
            {
              type: 'object',
              fields: [
                { name: 'imageAssetId', type: 'string', title: 'Image Asset ID' },
                { name: 'imageUrl', type: 'string', title: 'Image URL' },
                { name: 'caption', type: 'string', title: 'Caption' },
                { name: 'createdAt', type: 'datetime', title: 'Created At' },
              ],
            },
          ],
        },
                // Allow additional metadata fields dynamically
                {
                    name: 'customFields',
                    type: 'array',
                    of: [
                        {
                            type: 'object',
                            fields: [
                                { name: 'key', type: 'string' },
                                { name: 'value', type: 'string' },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            name: 'createdAt',
            type: 'datetime',
            title: 'Created At',
        },
    ],
  };