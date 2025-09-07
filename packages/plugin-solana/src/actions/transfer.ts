import {
  elizaLogger,
  settings,
  type ActionExample,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  type State,
  type Action,
  composeContext,
  generateObjectDeprecated,
} from "@elizaos/core";

import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
} from "@solana/spl-token";

import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getWalletKey } from "../keypairUtils";

export interface TransferContent extends Content {
  tokenAddress: string;
  recipient: string;
  amount: string | number;
}

function isTransferContent(
  runtime: IAgentRuntime,
  content: any
): content is TransferContent {
  elizaLogger.log("Content for transfer", content);
  return (
    typeof content.tokenAddress === "string" &&
    typeof content.recipient === "string" &&
    (typeof content.amount === "string" ||
      typeof content.amount === "number")
  );
}

const NAME = "SEND_TOKEN";
const SIMILIES = ["TRANSFER_TOKEN", "TRANSFER_TOKENS", "SEND_TOKENS", "PAY_TOKEN", "PAY_TOKENS", "PAY"];
const DESCRIPTION = "Transfer SPL tokens from agent's wallet to another address";

// Define a template for the agent, what to expect and how to format

const TEMPLATE = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": "1000"
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested token transfer:
- Token contract address
- Recipient wallet address
- Amount to transfer

If no token address is mentioned, respond with null.
`;

export default {
  name: NAME,
  similes: SIMILIES,
  description: DESCRIPTION,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Always return true for token transfers, letting the handler deal with specifics
    elizaLogger.log("Validating token transfer from user:", message.userId);
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log(`Starting ${NAME} handler...`);

    if (!state) {
      state = (await runtime.composeState(message)) as State;
    } else {
      state = await runtime.updateRecentMessageState(state);
    }

    const transferContext = composeContext({
      state,
      template: TEMPLATE,
    });

    const content = await generateObjectDeprecated({
      runtime,
      context: transferContext,
      modelClass: ModelClass.LARGE,
    });

    if (!isTransferContent(runtime, content)) {
      if (callback) {
        callback({
          text: "Token address needed to send the token.",
          content: { error: "Invalid transfer content" },
        });
      }
      return false;
    }

    try {

      // Fetch account
      const { keypair: senderKeypair } = await getWalletKey(runtime, true);

      // Setup connection
      const connection = new Connection(settings.SOLANA_RPC_URL!, "confirmed");

      // Get token mint pubkey
      const mintPubkey = new PublicKey(content.tokenAddress);

      // Get recipient pubkey
      const recipientPubkey = new PublicKey(content.recipient);

      // Get token details
      // Sometimes tokens can be different decimals, ex. USDC is 6
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
      const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9;

      // Convert amount (ex. 1 token at 9 decimals is 1000000000)
      const adjustedAmount = BigInt(Number(content.amount) * Math.pow(10, decimals));

      // Determine sender and recipient token account
      const senderATA = getAssociatedTokenAddressSync(mintPubkey, senderKeypair.publicKey);
      const recipientATA = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey);

      const instructions = [];

      const recipientATAInfo = await connection.getAccountInfo(recipientATA);

      // If the recipient doesn't have a token account, we'll have to create one
      if (!recipientATAInfo) {
        const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
        instructions.push(
          createAssociatedTokenAccountInstruction(
            senderKeypair.publicKey,
            recipientATA,
            recipientPubkey,
            mintPubkey
          )
        );
      }

      // Add the main transfer instruction
      instructions.push(
        createTransferInstruction(
          senderATA,
          recipientATA,
          senderKeypair.publicKey,
          adjustedAmount
        )
      );

      // Setup transaction
      const messageV0 = new TransactionMessage({
        payerKey: senderKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([senderKeypair]);

      // Send transaction
      const signature = await connection.sendTransaction(transaction);

      if (callback) {
        callback({
          text: `Sent ${content.amount} tokens to ${content.recipient}\nTransaction hash: ${signature}`,
          content: {
            success: true,
            signature,
            amount: content.amount,
            recipient: content.recipient,
          },
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error during token transfer:", error);
      if (callback) {
        callback({
          text: `Issue with the transfer: ${error.message}`,
          content: { error: error.message },
        });
      }
      return false;
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Send 69 EZSIS BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
        },
      },
      {
        user: "Eliza",
        content: {
          text: "Sending the tokens now...",
          action: NAME,
        },
      },
    ],
  ] as ActionExample[][],
} as Action;