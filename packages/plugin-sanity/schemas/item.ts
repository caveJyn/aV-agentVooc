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
      description: "Select the type of item (e.g., subscription for recurring plans, one-time for single purchases).",
      options: {
        list: [
          { title: "Subscription", value: "subscription" },
          { title: "One-Time Purchase", value: "one-time" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "features",
      title: "Features",
      type: "array",
      of: [{ type: "string" }],
      description: "List of key features for this subscription plan (e.g., '1 AI character', '100 conversations/month').",
    },
    {
      name: "allowedPlugins",
      title: "Allowed Plugins",
      type: "array",
      of: [{ type: "string" }],
      description: "List of plugin identifiers enabled by this subscription plan (e.g., 'telegram', 'solana', 'twitter').",
      options: {
        list: [
          { title: "Telegram", value: "telegram" },
          { title: "Solana", value: "solana" },
          { title: "Twitter", value: "twitter" },
        ],
      },
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