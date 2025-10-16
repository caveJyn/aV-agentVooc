import type { AgentRuntime } from "@elizaos/core";
import { z } from "zod";

const STARKNET_PUBLIC_RPC = "https://rpc.starknet-testnet.lava.build";

export const starknetEnvSchema = z.object({
  STARKNET_ADDRESS: z.string().min(1, "Starknet address is required"),
  STARKNET_PRIVATE_KEY: z.string().min(1, "Starknet private key is required"),
  STARKNET_RPC_URL: z.string().min(1, "Starknet RPC URL is required").default(STARKNET_PUBLIC_RPC),
  CHIPI_PUBLIC_API_KEY: z.string().min(1, "Chipi public API key is required"),
  CHIPI_SECRET_KEY: z.string().min(1, "Chipi secret key is required"),
  CHIPI_WEBHOOK_SECRET: z.string().min(1, "Chipi webhook secret is required"),
});

export type StarknetConfig = z.infer<typeof starknetEnvSchema>;

export async function validateStarknetConfig(
  runtime: AgentRuntime
): Promise<StarknetConfig> {
  try {
    const config = {
      STARKNET_ADDRESS:
        runtime.getSetting("STARKNET_ADDRESS") || process.env.STARKNET_ADDRESS,
      STARKNET_PRIVATE_KEY:
        runtime.getSetting("STARKNET_PRIVATE_KEY") ||
        process.env.STARKNET_PRIVATE_KEY,
      STARKNET_RPC_URL:
        runtime.getSetting("STARKNET_RPC_URL") ||
        process.env.STARKNET_RPC_URL ||
        STARKNET_PUBLIC_RPC,
      CHIPI_PUBLIC_API_KEY:
        runtime.getSetting("CHIPI_PUBLIC_API_KEY") ||
        process.env.CHIPI_PUBLIC_API_KEY,
      CHIPI_SECRET_KEY:
        runtime.getSetting("CHIPI_SECRET_KEY") || process.env.CHIPI_SECRET_KEY,
      CHIPI_WEBHOOK_SECRET:
        runtime.getSetting("CHIPI_WEBHOOK_SECRET") ||
        process.env.CHIPI_WEBHOOK_SECRET,
    };

    return starknetEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(
        `Starknet configuration validation failed:\n${errorMessages}`
      );
    }
    throw error;
  }
}