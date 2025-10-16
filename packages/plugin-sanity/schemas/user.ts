export default {
  name: "User",
  title: "Waitlist User",
  type: "document",
  fields: [
    {
      name: "signupSource",
      title: "Signup Source",
      type: "string",
      options: {
        list: [
          { title: "Email", value: "Email" },
          { title: "Crypto", value: "Crypto" },
        ],
      },
   },
    { name: "userId",
      title: "User ID",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'verified',
      title: 'Verified',
      type: 'boolean',
      initialValue: false,
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
      description: "Derived Subscription ID from Stripe",
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
      name: 'derivedStripeCustomerId',
      title: 'Derived Stripe Customer ID',
      type: 'string',
    },

    {
      name: "derivedStripeSubscriptionId",
      title: "Derived Stripe Subscription ID",
      type: "string",
      description: "Derived Subscription ID from Stripe",
    },
    {
      name: 'subscriptionVerified',
      title: 'Subscription Verified',
      type: 'boolean',
      initialValue: false,
    },

    {
      name: 'hasUsedTrial',
      title: 'Has Used Trial',
      type: 'boolean',
      description: 'Indicates whether the user has already used their free trial',
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
     {
      name: "responseCount",
      title: "Response Count",
      type: "number",
      description: "Number of responses used in the current billing period",
      initialValue: 0,
    },
    {
      name: "tokenCount",
      title: "Token Count",
      type: "number",
      description: "Number of tokens used in the current billing period",
      initialValue: 0,
    },
    {
      name: "currentPeriodStart",
      title: "Current Period Start",
      type: "datetime",
      description: "Start of the current billing period",
    },
    {
      name: "currentPeriodEnd",
      title: "Current Period End",
      type: "datetime",
      description: "End of the current billing period",
    },
    {
      name: "activePlugins",
      title: "Active Plugins",
      type: "array",
      of: [{ type: "string" }],
      description: "List of active plugin names the user has subscribed to",
    },
    {
      name: "isConnected",
      title: "Is Connected",
      type: "boolean",
      description: "Indicates if the user has an active connection to the system",
      initialValue: true,
      validation: (Rule) => Rule.required(),
    }
  ],
  preview: {
    select: {
      title: "signupSource", // Use the email field as the document title
      subtitle: "userId", // Optional: Use name as subtitle
      status: "isConnected"
    },
  },
};