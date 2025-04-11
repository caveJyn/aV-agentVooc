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

// Import needed libraries like Solana Web3.js. Ex.
// import { ... } from "@solana/web3.js";

// Define what variables you need.

interface MyActionContent extends Content {
  // As an example, let's say we need an account address
  account: string;
}

// Used to verify expected variables are not undefined.

function isMyActionContent(
  content: any
): content is MyActionContent {
  return (
    typeof content.account === "string"
  );
}

const NAME = "MY_ACTION_NAME";
const SIMILIES = ["MY_OTHER_ACTION_NAME", "MY_OTHER_OTHER_ACTION_NAME"];
const DESCRIPTION = "My action description";

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
    // For now always return true.
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

    // This is to verify user input and make sure
    // the needed variables are set.
    // Ex. A token address or an amount

    if (!isMyActionContent(content)) {
      if (callback) {
        callback({
          text: "Need an address",
          content: { error: "Invalid _ content" },
        });
      }
      return false;
    }

    try {
      // Perform action here!

      // Ex. 
      // 1. Setup a connection with Solana?
      // 2. Setup a transaction?
      // 3. Send a transaction?
      // 4. Verify result?

      if (callback) {
        callback({
          text: `[BOT RESPONSE HERE]`,
          content: {
            success: true,
            // Anything else you want to add...
          },
        });
      }

      return true;
    } catch (error) {
      elizaLogger.error("Error fetching _:", error);

      if (callback) {
        callback({
          text: `Problem with the _: ${error.message}`,
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
          text: "...", // Example of user message
        },
      },
      {
        user: "Eliza",
        content: {
          text: "...", // Example of bot response
          action: NAME,
        },
      },
    ],
  ] as ActionExample[][],
} as Action;