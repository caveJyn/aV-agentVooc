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
  generateObjectDeprecated
} from "@elizaos/core";

// Import Solana Web3.js

import { Connection, PublicKey } from "@solana/web3.js";

// Define what we need for getting balances.
// Technically all we need is an account address.

interface SolBalanceContent extends Content {
  account: string;
}

// Verify the accounnt address is not undefined.

function isSolBalanceContent(
  content: any
): content is SolBalanceContent {
  return (
    typeof content.account === "string"
  );
}

const NAME = "GET_SOL_BALANCE";
const SIMILIES = ["GET_ACCOUNT_SOL", "GET_ACCOUNT_BALANCE", "GET_ACCOUNT_LAMPORTS"];
const DESCRIPTION = "Get native SOL balance from agent's wallet or a specified address";

// Define a template for the agent, what to expect and how to format

const TEMPLATE = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "account": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
}
\`\`\`

{{recentMessages}}

Extract the following information about the requested SOL balance:
- account address
`;

export default {
  name: NAME,
  similes: SIMILIES,
  description: DESCRIPTION,
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Always return true for SOL balance, letting the handler deal with specifics
    elizaLogger.log("Validating SOL balance from user:", message.userId);
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

    // Verify input

    if (!isSolBalanceContent(content)) {
      if (callback) {
        callback({
          text: "Need an address",
          content: { error: "Invalid balance content" },
        });
      }
      return false;
    }

    try {

      // Setup connection
      const connection = new Connection(settings.SOLANA_RPC_URL!);

      // Set account address as a pubkey
      const recipientPubkey = new PublicKey(content.account);

      // Get the balance
      const accountBalance = await connection.getBalance(recipientPubkey)

      // Provide input
      if (callback) {
        callback({
          text: `Account ${content.account} has ${accountBalance} SOL.`,
          content: {
            success: true,
            amount: accountBalance,
            account: content.account,
          },
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error fetching SOL balance:", error);
      if (callback) {
        callback({
          text: `Problem with the SOL balance: ${error.message}`,
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
          text: "What is the current SOL balance of 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Fetching balance for account 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa...",
          action: NAME,
        },
      },
    ],
  ] as ActionExample[][],
} as Action;