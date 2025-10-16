import { createHmac, timingSafeEqual } from "crypto";
import type { Action, HandlerCallback, IAgentRuntime, Memory, State } from "@elizaos/core";

export const webhookHandlerAction: Action = {
  name: "WEBHOOK_HANDLER",
  similes: ["HANDLE_WEBHOOK"],
  description: "Handles Chipi Pay webhook notifications",
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || "";
    return text.includes("webhook");
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, options?: any, callback?: HandlerCallback): Promise<boolean> => {
    try {
      const payload = JSON.parse(message.content.text || "{}");
      const signature = message.content.signature || "";
      const webhookSecret = process.env.CHIPI_WEBHOOK_SECRET || "";

      const expectedSignature = createHmac("sha256", webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (!timingSafeEqual(Buffer.from(expectedSignature, "hex"), Buffer.from(signature, "hex"))) {
        throw new Error("Invalid webhook signature");
      }

      if (payload.event === "transaction.sent" && payload.data.transaction.status === "SUCCESS") {
        const transaction = payload.data.transaction;
        // Update Sanity or database with transaction details
        await runtime.updateTransaction({
          txHash: transaction.transactionHash,
          amount: transaction.amount,
          sender: transaction.senderAddress,
          recipient: transaction.recipientAddress,
        });
        // Send receipt email
        await runtime.actions.sendReceipt.run({
          email: transaction.senderEmail || "user@example.com",
          payload: { txHash: transaction.transactionHash, amount: transaction.amount },
        });
      }

      const response = {
        text: "Webhook processed successfully",
        thought: "Webhook handled",
        source: "WEBHOOK_HANDLER",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      if (callback) await callback(response);
      return true;
    } catch (error: any) {
      const errorResponse = {
        text: `Failed to process webhook: ${error.message}`,
        thought: "Webhook processing failed",
        source: "WEBHOOK_HANDLER",
        user: runtime.character.id,
        createdAt: Date.now(),
      };
      if (callback) await callback(errorResponse);
      return false;
    }
  },
  examples: [
    [
      {
        user: "{{system}}",
        content: { text: JSON.stringify({ event: "transaction.sent", data: { transaction: { status: "SUCCESS" } } }), signature: "..." },
      },
      {
        user: "{{agent}}",
        content: { text: "Webhook processed successfully", action: "WEBHOOK_HANDLER" },
      },
    ],
  ] as ActionExample[][],
};