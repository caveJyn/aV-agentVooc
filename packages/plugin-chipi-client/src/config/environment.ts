import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const chipiEnvSchema = z.object({
  CHIPI_PUBLIC_API_KEY: z.string().min(1, "Chipi public API key is required"),
});

export type ChipiConfig = z.infer<typeof chipiEnvSchema>;

export async function validateChipiConfig(runtime: IAgentRuntime): Promise<ChipiConfig> {
  try {
    const config = {
      CHIPI_PUBLIC_API_KEY: runtime.getSetting("CHIPI_PUBLIC_API_KEY"),
    };
    return chipiEnvSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join("\n");
      throw new Error(`Chipi configuration validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}