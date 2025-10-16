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
  ],
};