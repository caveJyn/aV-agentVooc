// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/packages/plugin-sanity/schemas/starknetWallet.ts
export default {
  name: "StarknetWallet",
  title: "Starknet Wallet",
  type: "document",
  fields: [
    {
      name: "character",
      title: "Character",
      type: "reference",
      to: [{ type: "character" }],
      validation: (Rule) =>
        Rule.required().custom(async (value, context) => {
          if (!value) return true;
          const client = context.getClient({ apiVersion: "2023-05-03" });
          const existing = await client.fetch(
            `*[_type == "StarknetWallet" && character._ref == $ref && _id != $currentId]`,
            { ref: value._ref, currentId: context.document._id || "" }
          );
          return existing.length === 0 || "Each character can have at most one Starknet wallet";
        }),
      description: "Reference to the character this wallet is associated with",
    },
    {
      name: "walletType",
      title: "Wallet Type",
      type: "string",
      validation: (Rule) => Rule.required(),
      description: "Type of Starknet wallet (e.g., 'Braavos', 'Argent')",
    },
    {
      name: "zkProofHash",
      title: "ZK Proof Hash",
      type: "string",
      validation: (Rule) =>
        Rule.required().regex(
          /^0x[0-9a-fA-F]{64}$/,
          "Must be a valid 32-byte keccak256 hash (0x followed by 64 hexadecimal characters)"
        ),
      description: "Zero-knowledge proof hash for wallet verification",
    },
    {
      name: "runesVerified",
      title: "Runes Verified",
      type: "boolean",
      initialValue: false,
      description: "Indicates if Runes ownership was verified",
    },
    {
      name: "createdAt",
      title: "Created At",
      type: "datetime",
      validation: (Rule) => Rule.required(),
      description: "Timestamp when the wallet was connected",
    },
  ],
};