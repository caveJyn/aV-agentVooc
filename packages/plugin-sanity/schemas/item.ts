export default {
  name: "Item",
  title: "Item",
  type: "document",
  fields: [
    {
      name: "id",
      title: "Item ID",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "name",
      title: "Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "description",
      title: "Description",
      type: "string",
    },
    {
      name: "price",
      title: "Price (in cents)",
      type: "number",
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: "stripePriceId",
      title: "Stripe Price ID",
      type: "string",
    },
     {
      name: "maxAgents",
      title: "Max Agents",
      type: "number",
      description: "Maximum number of agents allowed for this subscription plan",
      validation: (Rule) => Rule.min(0),
    },
    {
      name: "maxKnowledgeDocsPerAgent",
      title: "Max Knowledge Documents per Agent",
      type: "number",
      description: "Maximum number of knowledge documents per agent",
      validation: (Rule) => Rule.min(0),
    },
    {
      name: "maxTotalCharsPerAgent",
      title: "Max Total Characters per Agent",
      type: "number",
      description: "Maximum total characters across all knowledge documents per agent",
      validation: (Rule) => Rule.min(0),
    },
    {
      name: "maxCharsPerKnowledgeDoc",
      title: "Max Characters per Knowledge Document",
      type: "number",
      description: "Maximum characters allowed per knowledge document (optional)",
      validation: (Rule) => Rule.min(0),
    },
      {
      name: "maxResponsesPerMonth",
      title: "Max Responses Per Month",
      type: "number",
      description: "Maximum number of responses allowed per month",
      validation: (Rule) => Rule.min(0),
    },
    {
      name: "maxTokensPerMonth",
      title: "Max Tokens Per Month",
      type: "number",
      description: "Maximum number of tokens allowed per month",
      validation: (Rule) => Rule.min(0),
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      options: {
        dateFormat: "YYYY-MM-DD",
        timeFormat: "HH:mm:ss",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "itemType",
      title: "Item Type",
      type: "string",
      description: "Type of item (e.g., 'base', 'plugin')",
      options: {
        list: [
          { title: "Base Subscription", value: "base" },
          { title: "Plugin Subscription", value: "plugin" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "pluginName",
      title: "Plugin Name",
      type: "string",
      description: "Name of the plugin this item corresponds to (e.g., 'email', 'telegram', 'twitter')",
      validation: (Rule) => Rule.custom((value, context) => {
        if (context.document.itemType === "plugin") {
          return value ? true : "Plugin name is required for plugin items";
        }
        return true;
      }),
    },
    {
      name: "features",
      title: "Features",
      type: "array",
      of: [{ type: "string" }],
      description: "List of key features for this subscription plan (e.g., '1 AI character', '100 conversations/month').",
    },
    {
      name: "isPopular",
      title: "Is Popular",
      type: "boolean",
      description: "Mark this plan as 'Most Popular' to highlight it.",
      initialValue: false,
    },
    {
      name: "trialInfo",
      title: "Trial Information",
      type: "string",
      description: "Details about any trial or guarantee (e.g., '7-day free trial').",
    },
    {
      name: "useCase",
      title: "Use Case",
      type: "string",
      description: "Describe the ideal user or use case (e.g., 'Best for individuals').",
    },
  ],
};