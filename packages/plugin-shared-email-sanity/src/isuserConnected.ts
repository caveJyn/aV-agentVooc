// packages/plugin-shared-email-sanity/src/isuserConnected.ts
import { elizaLogger } from "@elizaos/core";
import { sanityClient } from "./emailTemplate";

let cachedIsConnected: { value: boolean; timestamp: number } | null = null;
const cacheDuration = 60 * 1000; // Cache for 60 seconds

// Function to clear cache on logout
export function clearConnectionCache() {
  cachedIsConnected = null;
  elizaLogger.debug("[SHARED-EMAIL-SANITY] Cleared connection status cache");
}

export async function isUserConnected(userId: string): Promise<boolean> {
  if (cachedIsConnected && Date.now() - cachedIsConnected.timestamp < cacheDuration) {
    elizaLogger.debug(`[SHARED-EMAIL-SANITY] Using cached connection status`, { userId, isConnected: cachedIsConnected.value });
    return cachedIsConnected.value;
  }
  try {
    const user = await retryOperation(() =>
      sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]{isConnected}`,
        { userId }
      )
    );
    const isConnected = user?.isConnected ?? false;
    cachedIsConnected = { value: isConnected, timestamp: Date.now() };
    elizaLogger.debug(`[SHARED-EMAIL-SANITY] Checked user connection status`, {
      userId,
      isConnected,
    });
    return isConnected;
  } catch (error: any) {
    elizaLogger.error(`[SHARED-EMAIL-SANITY] Failed to check user connection status`, {
      userId,
      error: error.message,
      stack: error.stack,
    });
    cachedIsConnected = { value: false, timestamp: Date.now() };
    return false;
  }
}

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw lastError;
}