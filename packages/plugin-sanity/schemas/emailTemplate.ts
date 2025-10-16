export default {
  name: 'emailTemplate',
  title: 'Email Template',
  type: 'document',
  fields: [
    {
      name: 'agentId',
      title: 'Agent ID',
      type: 'string',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'position',
      title: 'Position',
      type: 'string',
    },
    {
      name: 'emailAddress',
      title: 'Email Address',
      type: 'string',
    },
    {
      name: 'companyName',
      title: 'Company Name',
      type: 'string',
    },
    {
      name: 'instructions',
      title: 'Instructions',
      type: 'text',
    },
    {
      name: 'bestRegard',
      title: 'Best Regard',
      type: 'string',
    },
    {
      name: 'template',
      title: 'Email Template Structure',
      type: 'text',
      description: 'Define the full email structure using placeholders: {{sender}}, {{body}}, {{agentName}}, {{position}}, {{emailAddress}}, {{companyName}}, {{bestRegard}}',
      initialValue: 'Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}',
      validation: (Rule) => Rule.required().custom((value) => {
        if (!value || !value.includes('{{body}}')) {
          return 'Template must include {{body}} placeholder';
        }
        return true;
      }),
    },
  ],
};