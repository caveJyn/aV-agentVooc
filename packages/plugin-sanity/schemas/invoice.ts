export default {
  name: "invoice",
  title: "Invoice",
  type: "document",
  fields: [
    {
      name: "user",
      title: "User",
      type: "reference",
      to: [{ type: "User" }],
      validation: (Rule) => Rule.required(),
    },
    {
      name: "stripeInvoiceId",
      title: "Stripe Invoice ID",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: ["draft", "open", "paid", "uncollectible", "void"],
      },
    },
    {
      name: "amountDue",
      title: "Amount Due",
      type: "number",
    },
    {
      name: "amountPaid",
      title: "Amount Paid",
      type: "number",
    },
    {
      name: "currency",
      title: "Currency",
      type: "string",
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
    },
    {
      name: "dueDate",
      title: "Due Date",
      type: "datetime",
    },
    {
      name: "invoiceUrl",
      title: "Invoice URL",
      type: "url",
    },
    {
      name: "invoicePdf",
      title: "Invoice PDF",
      type: "url",
    },
    {
      name: "periodStart",
      title: "Period Start",
      type: "datetime",
    },
    {
      name: "periodEnd",
      title: "Period End",
      type: "datetime",
    },
    {
      name: "lineItems",
      title: "Line Items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "description",
              title: "Description",
              type: "string",
            },
            {
              name: "amount",
              title: "Amount",
              type: "number",
            },
            {
              name: "currency",
              title: "Currency",
              type: "string",
            },
            {
              name: "quantity",
              title: "Quantity",
              type: "number",
            },
            {
              name: "period",
              title: "Period",
              type: "object",
              fields: [
                {
                  name: "start",
                  title: "Start",
                  type: "datetime",
                },
                {
                  name: "end",
                  title: "End",
                  type: "datetime",
                },
              ],
            },
            {
              name: "productName",
              title: "Product Name",
              type: "string",
            },
          ],
        },
      ],
    },
  ],
};