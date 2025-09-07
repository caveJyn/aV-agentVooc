export default {
  name: "User",
  title: "Waitlist User",
  type: "document",
  fields: [
    {
      name: "name",
      title: "Name",
      type: "string",
    },
    {
      name: "email",
      title: "Email",
      type: "string",
    },
    {
      name: "userId",
      title: "SuperTokens User ID",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "interest",
      title: "Interest",
      type: "string",
      description: "What interests the user about elizaOS",
    },
    {
      name: "referralSource",
      title: "Referral Source",
      type: "string",
      description: "How the user heard about elizaOS",
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
      name: "userType",
      title: "User Type",
      type: "string",
      options: {
        list: [
          { title: "Email", value: "email" },
          { title: "Crypto", value: "crypto" },
        ],
      },
      validation: (Rule) => Rule.required(),
      description: "Type of user authentication: 'email' or 'crypto'",
    },
    {
      name: "stripeCustomerId",
      title: "Stripe Customer ID",
      type: "string",
    },
    {
      name: "stripeSubscriptionId",
      title: "Stripe Subscription ID",
      type: "string",
      description: "Subscription ID from Stripe",
    },
    {
      name: "subscriptionStatus",
      title: "Subscription Status",
      type: "string",
      options: {
        list: ["none", "active", "trialing", "canceled", "past_due", "incomplete"],
      },
    },
    {
      name: "trialStartDate",
      title: "Trial Start Date",
      type: "datetime",
    },
    {
      name: "trialEndDate",
      title: "Trial End Date",
      type: "datetime",
    },
    {
      name: "cancelAtPeriodEnd",
      title: "Cancel at Period End",
      type: "boolean",
    },
    {
      name: "activePriceIds",
      title: "Active Price IDs",
      type: "array",
      of: [{ type: "string" }],
      description: "List of active Stripe price IDs associated with the user's subscription (e.g., ['price_123']).",
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true; // Allow empty array
          return value.every((id) => id.startsWith("price_"))
            ? true
            : "All price IDs must start with 'price_'";
        }),
    },
  ],
};