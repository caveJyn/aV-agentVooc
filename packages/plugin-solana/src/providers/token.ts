import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type State,
  elizaLogger,
  type ICacheManager,
  settings,
} from "@elizaos/core";

import NodeCache from "node-cache";
import * as path from "path";

const PROVIDER_CONFIG = {
  BIRDEYE_API: "https://public-api.birdeye.so",
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,

  // Not used, but you could read data from the blockchain
  DEFAULT_RPC: "https://api.mainnet-beta.solana.com",

  // API routes
  TOKEN_LIST: "/defi/tokenlist?sort_by=v24hUSD&sort_type=desc&offset=0&limit=10&min_liquidity=100",
};

interface TokenList {
  updateUnixTime: number;
  updateTime: string;
  tokens: {
    name: string;
    symbol: string;
    address: string;
    decimals: number;
    lastTradeUnixTime: number;
    liquidity: number;
    v24hChangePercent: number;
    v24hUSD: number;
  }[];
}

interface ProcessedTokenData {
  tokenList: TokenList;
}

export class TokenProvider {
  private cache: NodeCache;
  private cacheKey = "solana/tokens";

  constructor(private cacheManager: ICacheManager) {
    this.cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache
  }

  private async readFromCache<T>(key: string): Promise<T | null> {
    const cached = await this.cacheManager.get<T>(
      path.join(this.cacheKey, key)
    );
    return cached;
  }

  private async writeToCache<T>(key: string, data: T): Promise<void> {
    await this.cacheManager.set(path.join(this.cacheKey, key), data, {
      expires: Date.now() + 5 * 60 * 1000,
    });
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    // Check in-memory cache first
    const cachedData = this.cache.get<T>(key);
    if (cachedData) {
      return cachedData;
    }

    // Check file-based cache
    const fileCachedData = await this.readFromCache<T>(key);
    if (fileCachedData) {
      // Populate in-memory cache
      this.cache.set(key, fileCachedData);
      return fileCachedData;
    }

    return null;
  }

  private async setCachedData<T>(cacheKey: string, data: T): Promise<void> {
    // Set in-memory cache
    this.cache.set(cacheKey, data);

    // Write to file-based cache
    await this.writeToCache(cacheKey, data);
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {}
  ): Promise<any> {
    let lastError: Error;

    for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            Accept: "application/json",
            "x-chain": "solana",
            "X-API-KEY": settings.BIRDEYE_API_KEY || "",
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
        }

        const data = await response.json();
        return data;
      } catch (error) {
        elizaLogger.error(`Attempt ${i + 1} failed:`, error);
        lastError = error as Error;
        if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
          const delay = PROVIDER_CONFIG.RETRY_DELAY * Math.pow(2, i);
          elizaLogger.log(`Waiting ${delay}ms before retrying...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    elizaLogger.error(
      "All attempts failed. Throwing the last error:",
      lastError
    );
    throw lastError;
  }

  async fetchTopTokens(): Promise<TokenList> {
    const cacheKey = `tokenList`;
    const cachedData =
      await this.getCachedData<TokenList>(cacheKey);

    if (cachedData) {
      elizaLogger.log(`Returning cached token metadata.`);
      return cachedData;
    }

    const url = `${PROVIDER_CONFIG.BIRDEYE_API}${PROVIDER_CONFIG.TOKEN_LIST}`;
    const data = await this.fetchWithRetry(url);

    if (!data?.success || !data?.data) {
      throw new Error("No token metadata available");
    }

    let tokens = [];

    for (let i = 0; i < data.data.tokens.length; i++) {
      tokens[i] = {
        name: data.data.tokens[i].name,
        symbol: data.data.tokens[i].symbol,
        address: data.data.tokens[i].address,
        decimals: data.data.tokens[i].decimals,
        lastTradeUnixTime: data.data.tokens[i].lastTradeUnixTime,
        liquidity: data.data.tokens[i].liquidity,
        v24hChangePercent: data.data.tokens[i].v24hChangePercent,
        v24hUSD: data.data.tokens[i].v24hUSD,
      };
    }

    const list: TokenList = {
      updateUnixTime: data.data.updateUnixTime,
      updateTime: data.data.updateTime,
      tokens: tokens,
    }

    this.setCachedData(cacheKey, list);
    elizaLogger.log(`Token list data cached.`);

    return list;
  }

  async getProcessedTokenData(): Promise<ProcessedTokenData> {
    try {
      elizaLogger.log(`Fetching top tokens list`);
      const tokenList = await this.fetchTopTokens();

      // Any other API/function calls here

      const processedData: ProcessedTokenData = {
        tokenList,
        // Any other data...
      };

      return processedData;
    } catch (error) {
      elizaLogger.error("Error processing token data:", error);
      throw error;
    }
  }

  formatTokenData(data: ProcessedTokenData): string {
    let output = `**Tokens Report**\n\n`;

    // Token List Data
    output += `**Listing Top Tokens:**\n`;

    for (let i = 0; i < data.tokenList.tokens.length; i++) {
      output += `- Token #${i + 1}\n`;
      output += `- Token Name: ${data.tokenList.tokens[i].name}\n`;
      output += `- Token Symbol: ${data.tokenList.tokens[i].symbol}\n`;
      output += `- Token Address: ${data.tokenList.tokens[i].address}\n`;
      output += `- Token Decimals: ${data.tokenList.tokens[i].decimals}\n`;
      output += `- Timestamp of Last Trade: ${data.tokenList.tokens[i].lastTradeUnixTime}%\n`;
      output += `- Total Liquidity: ${data.tokenList.tokens[i].liquidity}%\n`;
      output += `- 24 Hour Price Change Percent: ${data.tokenList.tokens[i].v24hChangePercent}\n`;
      output += `- 24 Hour Price Chance in USD: ${data.tokenList.tokens[i].v24hUSD}%\n\n`;
    }

    output += `\n`;

    elizaLogger.log("Formatted token data:", output);
    return output;
  }

  async getFormattedTokenReport(): Promise<string> {
    try {
      elizaLogger.log("Generating formatted token report...");
      const processedData = await this.getProcessedTokenData();
      return this.formatTokenData(processedData);
    } catch (error) {
      elizaLogger.error("Error generating token report:", error);
      return "Unable to fetch token information. Please try again later.";
    }
  }
}

const tokenProvider: Provider = {
  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<string> => {
    try {
      const provider = new TokenProvider(runtime.cacheManager);
      return provider.getFormattedTokenReport();
    } catch (error) {
      elizaLogger.error("Error fetching token data:", error);
      return "Unable to fetch token information. Please try again later.";
    }
  },
};

export { tokenProvider };
