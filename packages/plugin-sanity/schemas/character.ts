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
      description: "Display name (e.g., 'agentVooc'). Must be unique.",
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
            name: "profile",
            type: "object",
            fields: [
                {
                    name: "image",
                    type: "image",
                    title: "Profile Image",
                    options: { hotspot: true },
                },
            ],
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
  name: 'messageExamples',
  type: 'array',
  title: 'Message Examples',
  of: [
    {
      type: 'object',
      name: 'conversation',
      title: 'Conversation',
      fields: [
        {
          name: 'messages',
          type: 'array',
          title: 'Messages',
          of: [
            {
              type: 'object',
              fields: [
                {
                  name: 'user',
                  type: 'string',
                  title: 'User',
                  validation: (Rule) => Rule.required().min(1),
                },
                {
                  name: 'content',
                  type: 'object',
                  title: 'Content',
                  fields: [
                    {
                      name: 'text',
                      type: 'string',
                      title: 'Text',
                      validation: (Rule) => Rule.required().min(1),
                    },
                    {
                      name: 'action',
                      type: 'string',
                      title: 'Action',
                    },
                  ],
                  validation: (Rule) => Rule.required(),
                },
              ],
            },
          ],
          validation: (Rule) => Rule.min(0),
        },
      ],
    },
  ],
  validation: (Rule) => Rule.min(0),
  description: 'Example conversations, each containing a sequence of user and agent messages',
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
              initialValue: true,
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
      title: 'Secrets',
      fields: [
        {
          name: 'dynamic',
          type: 'array',
          title: 'Dynamic Secrets',
          of: [
            {
              type: 'object',
              fields: [
                { name: 'key', type: 'string', title: 'Key' },
                {
                  name: 'encryptedValue',
                  type: 'object',
                  title: 'Encrypted Value',
                  fields: [
                    { name: 'iv', type: 'string', title: 'IV' },
                    { name: 'ciphertext', type: 'string', title: 'Ciphertext' }
                  ]
                },
                { name: 'hash', type: 'string', title: 'Hash' }
              ]
            }
          ]
        }
      ]
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
                    {
      name: 'email',
      title: 'Email Settings',
      type: 'object',
      fields: [
        {
          name: 'outgoing',
          title: 'Outgoing Email',
          type: 'object',
          fields: [
            {
              name: 'service',
              title: 'Service',
              type: 'string',
              options: {
                list: [
                  { title: 'Gmail', value: 'gmail' },
                  { title: 'SMTP', value: 'smtp' }
                ]
              },
              validation: Rule => Rule.required()
            },
            {
              name: 'host',
              title: 'Host',
              type: 'string',
              hidden: ({ parent }) => parent?.service !== 'smtp', // Safe navigation
              validation: Rule => Rule.custom((value, { parent }) => {
                if (parent?.service === 'smtp' && !value) {
                  return 'Host is required for SMTP';
                }
                return true;
              })
            },
            {
              name: 'port',
              title: 'Port',
              type: 'number',
              hidden: ({ parent }) => parent?.service !== 'smtp', // Safe navigation
              validation: Rule => Rule.custom((value, { parent }) => {
                if (parent?.service === 'smtp' && (!value || value <= 0)) {
                  return 'Valid port is required for SMTP';
                }
                return true;
              })
            },
            {
              name: 'secure',
              title: 'Secure (TLS)',
              type: 'boolean',
              hidden: ({ parent }) => parent?.service !== 'smtp', // Safe navigation
            },
            {
              name: 'user',
              title: 'Username',
              type: 'string',
              validation: Rule => Rule.required()
            },
            {
              name: 'pass',
              title: 'Password',
              type: 'string',
              validation: Rule => Rule.required()
            }
          ]
        },
        {
          name: 'incoming',
          title: 'Incoming Email',
          type: 'object',
          fields: [
            {
              name: 'service',
              title: 'Service',
              type: 'string',
              options: {
                list: [{ title: 'IMAP', value: 'imap' }]
              },
              initialValue: 'imap',
              readOnly: true
            },
            {
              name: 'host',
              title: 'Host',
              type: 'string',
            },
            {
              name: 'port',
              title: 'Port',
              type: 'number',
              initialValue: 993
            },
            {
              name: 'user',
              title: 'Username',
              type: 'string',
            },
            {
              name: 'pass',
              title: 'Password',
              type: 'string',
            }
          ]
        }
      ],
      hidden: ({ parent }) => !parent?.plugins?.includes('email') // Safe navigation
    }
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

{
              name: 'walletPublicKey',
              title: 'Wallet Public Key',
              type: 'string',
            }
  ],
};