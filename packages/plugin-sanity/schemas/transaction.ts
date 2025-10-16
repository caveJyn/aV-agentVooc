// Transaction Schema
export default {
  name: "Transaction",
  title: "Transaction",
  type: "document",
  fields: [
    {
      name: "userId",
      title: "User ID",
      type: "string",
      validation: (Rule) => Rule.required(),
    },
    {
      name: "type",
      title: "Type",
      type: "string",
      options: {
        list: ["transfer", "approve", "stake", "withdraw", "call-contract"],
      },
      validation: (Rule) => Rule.required(),
    },
    {
      name: "token",
      title: "Token",
      type: "string",
    },
    {
      name: "amount",
      title: "Amount",
      type: "string",
    },
    {
      name: "recipient",
      title: "Recipient",
      type: "string",
    },
    {
      name: "contractAddress",
      title: "Contract Address",
      type: "string",
    },
    {
      name: "spender",
      title: "Spender",
      type: "string",
    },
    {
      name: "entrypoint",
      title: "Entrypoint",
      type: "string",
    },
    {
      name: "calldata",
      title: "Calldata",
      type: "string",
    },
    {
      name: "transactionHash",
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
  ],
};