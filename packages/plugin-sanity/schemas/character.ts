// /home/cave/projects/bots/venv/elizaOS_env/elizaOS/packages/plugin-sanity/schemas/character.ts
export default {
  name: "character",
  title: "Character",
  type: "document",
  fields: [
    {
      name: "id",
      title: "ID",
      type: "string",
      validation: (Rule) =>
        Rule.required()
          .regex(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            "Must be a valid UUID"
          )
          .custom(async (value, context) => {
            const { document, getClient } = context;
            const client = getClient({ apiVersion: "2023-05-03" });

            // Ensure uniqueness
            const query = `*[_type == "character" && id == $id && _id != $currentId]{_id}`;
            const params = { id: value, currentId: document._id || "" };
            const result = await client.fetch(query, params);
            if (result.length > 0) {
              return "ID must be unique";
            }

            // Prevent changes after creation
            if (document._id && !document._id.startsWith('drafts.')) {
              const originalDoc = await client.getDocument(document._id);
              if (originalDoc && originalDoc.id && originalDoc.id !== value) {
                return "ID cannot be changed after creation";
              }
            }

            return true;
          }),
      description: "Unique UUID identifier (e.g., '6372532e-4628-01df-a9fb-9f5574cd4009'). Set programmatically and immutable after creation.",
    },
    {
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) =>
        Rule.required().custom(async (value, context) => {
          const client = context.getClient({ apiVersion: "2023-05-03" });
          const query = `*[_type == "character" && name == $name && _id != $currentId]{_id}`;
          const params = { name: value, currentId: context.document._id || "" };
          const result = await client.fetch(query, params);
          return result.length === 0 || "Name must be unique";
        }),
      description: "Display name (e.g., 'Eliza'). Must be unique.",
    },
    {
      name: "username",
      title: "Username",
      type: "string",
      validation: (Rule) =>
        Rule.custom(async (value, context) => {
          if (!value) return true; // Optional field, skip if empty
          const client = context.getClient({ apiVersion: "2023-05-03" });
          const query = `*[_type == "character" && username == $username && _id != $currentId]{_id}`;
          const params = { username: value, currentId: context.document._id || "" };
          const result = await client.fetch(query, params);
          return result.length === 0 || "Username must be unique";
        }),
      description: "Optional username (e.g., 'eliza'). Must be unique if provided.",
    },
    {
      name: "system",
      title: "System Prompt",
      type: "text",
      description: "Prompt defining the character’s behavior",
    },
    {
      name: "bio",
      title: "Biography",
      type: "array",
      of: [{ type: "string" }],
      description: "List of bio statements",
    },
    {
      name: "lore",
      title: "Background Lore",
      type: "array",
      of: [{ type: "string" }],
      description: "List of backstory snippets",
    },
    {
      name: "messageExamples",
      title: "Message Examples",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "conversation",
              title: "Conversation",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    { name: "user", title: "User", type: "string" },
                    {
                      name: "content",
                      title: "Content",
                      type: "object",
                      fields: [
                        { name: "text", title: "Text", type: "string" },
                        { name: "action", title: "Action", type: "string", options: { isOptional: true } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      description: "Example dialogues as conversation arrays",
    },
    {
      name: "postExamples",
      title: "Post Examples",
      type: "array",
      of: [{ type: "string" }],
      description: "Sample posts",
    },
    {
      name: "topics",
      title: "Known Topics",
      type: "array",
      of: [{ type: "string" }],
      description: "Topics of expertise",
    },
    {
      name: "style",
      title: "Style",
      type: "object",
      fields: [
        {
          name: "all",
          title: "All Contexts",
          type: "array",
          of: [{ type: "string" }],
        },
        {
          name: "chat",
          title: "Chat",
          type: "array",
          of: [{ type: "string" }],
        },
        {
          name: "post",
          title: "Post",
          type: "array",
          of: [{ type: "string" }],
        },
      ],
      description: "Style guidelines for different contexts",
    },
    {
      name: "adjectives",
      title: "Character Traits",
      type: "array",
      of: [{ type: "string" }],
      description: "Traits describing the character",
    },
    {
      name: "modelProvider",
      title: "Model Provider",
      type: "string",
      options: { list: ["OPENAI", "OLLAMA", "CUSTOM"] },
      description: "AI model provider (optional, defaults to OPENAI)",
    },
    {
      name: "plugins",
      title: "Plugins",
      type: "array",
      of: [{ type: "string" }],
      description: "List of plugin identifiers (e.g., 'telegram', 'solana')",
    },
 
    
    {
      name: "knowledge",
      title: "Knowledge",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "knowledge" }],
          validation: (Rule) =>
            Rule.custom(async (value, context) => {
              if (!value) return true;
              const client = context.getClient({ apiVersion: "2023-05-03" });
              const knowledgeDoc = await client.fetch(
                `*[_id == $ref][0]{id}`,
                { ref: value._ref }
              );
              if (knowledgeDoc && knowledgeDoc.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(knowledgeDoc.id)) {
                return "Knowledge document must have a valid UUID in its 'id' field";
              }
              return true;
            }),
        },
        {
          type: "object",
          name: "directoryItem",
          fields: [
            {
              name: "directory",
              title: "Directory",
              type: "string",
              validation: (Rule) => Rule.required(),
            },
            {
              name: "shared",
              title: "Shared",
              type: "boolean",
              initialValue: false,
            },
          ],
        },
      ],
      description: "References to knowledge documents or directory items",
    },
    {
      name: "enabled",
      title: "Enabled",
      type: "boolean",
      initialValue: true,
      description: "Whether this character should be loaded",
    },
    {
      name: "createdBy",
      title: "Created By",
      type: "reference",
      to: [{ type: "User" }], // Reference to User
    },
     {
            name: 'settings',
            type: 'object',
            title: 'Settings',
            fields: [
                {
                    name: 'secrets',
                    type: 'object',
                    fields: [
                        {
                            name: 'dynamic',
                            type: 'array',
                            of: [
                                {
                                    type: 'object',
                                    fields: [
                                        { name: 'key', type: 'string', title: 'Key' },
                                        { name: 'value', type: 'string', title: 'Value' },
                                    ],
                                },
                            ],
                            title: 'Dynamic Secrets',
                        },
                    ],
                    title: 'Secrets',
                },
                { name: 'ragKnowledge', type: 'boolean', title: 'RAG Knowledge' },
                {
                    name: 'voice',
                    type: 'object',
                    fields: [
                        { name: 'model', type: 'string', title: 'Voice Model' },
                    ],
                    title: 'Voice',
                },
                // Add other settings fields as needed by Overview component
            ],
          },

          {
            name: "subscriptionPlan",
            title: "Subscription Plan",
            type: "string",
            description: "Stripe price ID or subscription plan ID associated with this character (e.g., 'price_123'). Determines plugin access.",
            validation: (Rule) => Rule.custom((value) => {
              // Optional field, but if provided, it should be a valid Stripe price ID
              if (value && !value.startsWith('price_')) {
                return "Subscription plan must be a valid Stripe price ID (e.g., 'price_123')";
              }
              return true;
            }),
          },
        
        
          {
            name: "subscriptionStatus",
            title: "Subscription Status",
            type: "string",
            options: {
              list: ["active", "trialing", "past_due", "canceled", "none"],
            },
          },
          {
            name: "stripeSubscriptionId",
            title: "Stripe Subscription ID",
            type: "string",
          },
          {
            name: "subscribedFeatures",
            title: "Subscribed Features",
            type: "array",
            of: [{ type: "string" }],
            description: "List of features enabled by the subscription (e.g., ['twitter-agent']).",
          },
  ],
};