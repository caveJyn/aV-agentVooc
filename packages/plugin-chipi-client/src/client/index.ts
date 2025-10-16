// packages/plugin-chipi-client/src/client/index.ts
import type { Client } from "@elizaos/core";
import { ChipiPayClient } from "./chipiPayClient";

export const ChipiClientInterface: Client = {
  name: "chipi",
  start: async () => {
    if (typeof window === "undefined") {
      console.info("[ChipiClientInterface] Server-side context detected, deferring initialization to browser");
      return null;
    }

    const apiPublicKey = import.meta.env.VITE_CHIPI_PUBLIC_API_KEY;
    if (!apiPublicKey) {
      console.error("[ChipiClientInterface] VITE_CHIPI_PUBLIC_API_KEY is not set");
      throw new Error("VITE_CHIPI_PUBLIC_API_KEY is not set");
    }

    const chipiPayClient = new ChipiPayClient({ apiPublicKey });
    await chipiPayClient.start();
    console.log(`✅ ChipiPayClient started successfully`);
    return chipiPayClient;
  },
};