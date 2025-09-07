export default {
    name: "WebhookError",
    title: "Webhook Error",
    type: "document",
    fields: [
      {
        name: "eventType",
        title: "Event Type",
        type: "string",
        description: "The type of Stripe webhook event that failed",
      },
      {
        name: "errorMessage",
        title: "Error Message",
        type: "string",
        description: "The error message from the webhook processing",
      },
      {
        name: "timestamp",
        title: "Timestamp",
        type: "datetime",
        options: {
          dateFormat: "YYYY-MM-DD",
          timeFormat: "HH:mm:ss",
        },
        validation: (Rule) => Rule.required(),
      },
    ],
  };