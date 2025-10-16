export default {
  name: "Wallet",
  title: "Wallet",
  type: "document",
  fields: [
    {
      name: "character",
      title: "Character",
      type: "reference",
      to: [{ type: "character" }],
      validation: (Rule) => Rule.required().custom(async (value, context) => {
        if (!value) return true;
        const client = context.getClient({ apiVersion: "2023-05-03" });
        const existing = await client.fetch(
          `*[_type == "Wallet" && character._ref == $ref && _id != $currentId]`,
          { ref: value._ref, currentId: context.document._id || "" }
        );
        return existing.length === 0 || "Each character can have at most one wallet";
      }),
    },
    {
      name: "publicKey",
      title: "Public Key",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "txHash",
      title: "Transaction Hash",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "updatedAt",
      title: "Updated At",
      type: "datetime",
      validation: (Rule) => Rule.optional(),
    },
  ],
};