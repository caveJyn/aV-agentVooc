// schemas/characterPreset.js
export default {
  name: 'characterPreset',
  title: 'Character Preset',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'Name of the character preset',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'username',
      title: 'Username',
      type: 'string',
      description: 'Username for the character preset (optional)',
    },
    {
      name: 'system',
      title: 'System Prompt',
      type: 'string',
      description: 'System prompt defining the preset character’s role or behavior',
    },
    {
      name: 'bio',
      title: 'Bio',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'List of bio descriptions for the preset character',
    },
    {
      name: 'lore',
      title: 'Lore',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Background story or lore for the preset character',
    },
    {
      name: 'messageExamples',
      title: 'Message Examples',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {
              name: 'conversation',
              title: 'Conversation',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'user', title: 'User', type: 'string' },
                    {
                      name: 'content',
                      title: 'Content',
                      type: 'object',
                      fields: [{ name: 'text', title: 'Text', type: 'string' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      description: 'Example conversations for the preset character',
    },
    {
      name: 'postExamples',
      title: 'Post Examples',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Example posts or tweets for the preset character',
    },
    {
      name: 'topics',
      title: 'Topics',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Topics the preset character specializes in',
    },
    {
      name: 'adjectives',
      title: 'Adjectives',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Personality traits or adjectives describing the preset character',
    },
    {
      name: 'style',
      title: 'Style',
      type: 'object',
      fields: [
        {
          name: 'all',
          title: 'All Contexts',
          type: 'array',
          of: [{ type: 'string' }],
          description: 'General style guidelines for all interactions',
        },
        {
          name: 'chat',
          title: 'Chat Style',
          type: 'array',
          of: [{ type: 'string' }],
          description: 'Style guidelines for chat interactions',
        },
        {
          name: 'post',
          title: 'Post Style',
          type: 'array',
          of: [{ type: 'string' }],
          description: 'Style guidelines for posts or tweets',
        },
      ],
    },
    {
      name: 'modelProvider',
      title: 'Model Provider',
      type: 'string',
      options: {
        list: [
          { title: 'OPENAI', value: 'OPENAI' },
          { title: 'OLLAMA', value: 'OLLAMA' },
          { title: 'CUSTOM', value: 'CUSTOM' },
        ],
      },
      description: 'AI model provider for the preset character',
    },
    {
      name: 'plugins',
      title: 'Plugins',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Plugins enabled for the preset character',
    },
    {
      name: 'settings',
      title: 'Settings',
      type: 'object',
      fields: [
        {
          name: 'ragKnowledge',
          title: 'Enable RAG Knowledge',
          type: 'boolean',
          description: 'Enable Retrieval-Augmented Generation for knowledge',
        },
        {
          name: 'secrets',
          title: 'Secrets',
          type: 'object',
          fields: [
            {
              name: 'dynamic',
              title: 'Dynamic Secrets',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    { name: 'key', title: 'Key', type: 'string' },
                    { name: 'value', title: 'Value', type: 'string' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'knowledge',
      title: 'Knowledge',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'knowledge' }] }],
      description: 'References to knowledge documents for the preset character',
    },
  ],
};