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
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { getWalletKey } from "../keypairUtils";

interface SolTransferContent extends Content {
  recipient: string;
  amount: number;
}

function isSolTransferContent(
  content: any
): content is SolTransferContent {
  return (
    typeof content.recipient === "string" &&
    typeof content.amount === "string"
  );
}

const NAME = "SEND_SOL";
const SIMILIES = ["TRANSFER_SOL", "PAY_SOL", "TRANSACT_SOL"];
const DESCRIPTION = "Transfer native SOL from agent's wallet to specified address";

// Define a template for the agent, what to expect and how to format

const TEMPLATE = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": 1.5
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested SOL transfer:
- Recipient wallet address
- Amount of SOL to transfer
`;

export default {
  name: NAME,
  similes: SIMILIES,
  description: DESCRIPTION,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Always return true for SOL transfers, letting the handler deal with specifics
    elizaLogger.log("Validating SOL transfer from user:", message.userId);
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

    if (!isSolTransferContent(content)) {
      if (callback) {
        callback({
          text: "Need an address and the amount of SOL to send.",
          content: { error: "Invalid transfer content" },
        });
      }
      return false;
    }

    try {

      // Fetch account
      const { keypair: senderKeypair } = await getWalletKey(runtime, true);

      // Setup connection
      const connection = new Connection(settings.SOLANA_RPC_URL!);

      // Get recipient pubkey
      const recipientPubkey = new PublicKey(content.recipient);

      // SOL is 9 decimals so we convert the amount
      const lamports = content.amount * 1e9;

      // Setup instruction
      const instruction = SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      });

      // Setup transaction
      const messageV0 = new TransactionMessage({
        payerKey: senderKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [instruction],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([senderKeypair]);

      // Send transaction
      const signature = await connection.sendTransaction(transaction);

      if (callback) {
        callback({
          text: `Sent ${content.amount} SOL. Transaction hash: ${signature}`,
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
      elizaLogger.error("Error during SOL transfer:", error);
      if (callback) {
        callback({
          text: `Problem with the SOL transfer: ${error.message}`,
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
          text: "Send 1.5 SOL to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Sure thing, SOL on its way.",
          action: NAME,
        },
      },
    ],
  ] as ActionExample[][],
} as Action;