import {
  type AgentRuntime,
  type Memory,
  type Provider,
  type State,
  elizaLogger,
  stringToUuid,
} from "@elizaos/core";
import { fetchWithRetry, getStarknetAccount } from "../utils/starknetUtils";
import { ERC20Token } from "../utils/ERC20Token";
import { PORTFOLIO_TOKENS } from "./token";
import { validateStarknetConfig } from "../config/environment";

interface CoingeckoPrices {
  [cryptoName: string]: { usd: number };
}

interface TokenBalances {
  [tokenAddress: string]: bigint;
}

interface TokenInfo {
  address: string;
  coingeckoId: string;
  decimals: number;
}

export class WalletProvider {
  private runtime: AgentRuntime;

  constructor(runtime: AgentRuntime) {
    this.runtime = runtime;
  }

  async getWalletPortfolio(): Promise<TokenBalances> {
    const config = await validateStarknetConfig(this.runtime);
    const cacheKey = `walletPortfolio-${this.runtime.agentId}`;
    const cachedValues = await this.runtime.cacheManager.get<TokenBalances>(cacheKey);
    if (cachedValues) {
      elizaLogger.debug("[PORTFOLIO-PLUGIN] Using cached data for getWalletPortfolio()", { cacheKey });
      return cachedValues;
    }

    const starknetAccount = getStarknetAccount(this.runtime);
    const balances: TokenBalances = {};

    for (const token of Object.values(PORTFOLIO_TOKENS) as TokenInfo[]) {
      const erc20 = new ERC20Token(token.address, starknetAccount);
      const balance = await erc20.balanceOf(starknetAccount.address as string);
      balances[token.address] = balance;
    }

    await this.runtime.cacheManager.set(cacheKey, balances, {
      expires: Date.now() + 180 * 60 * 1000, // 3 hours cache
    });

    return balances;
  }

  async getTokenUsdValues(): Promise<CoingeckoPrices> {
    const cacheKey = "tokenUsdValues";
    const cachedValues = await this.runtime.cacheManager.get<CoingeckoPrices>(cacheKey);
    if (cachedValues) {
      elizaLogger.debug("[PORTFOLIO-PLUGIN] Using cached data for getTokenUsdValues()", { cacheKey });
      return cachedValues;
    }

    const coingeckoIds = Object.values(PORTFOLIO_TOKENS)
      .map((token: TokenInfo) => token.coingeckoId)
      .join(",");

    const coingeckoPrices = await fetchWithRetry<CoingeckoPrices>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd`
    );

    await this.runtime.cacheManager.set(cacheKey, coingeckoPrices, {
      expires: Date.now() + 30 * 60 * 1000, // 30 minutes cache
    });

    return coingeckoPrices;
  }
}

export const walletProvider: Provider = {
  get: async (runtime: AgentRuntime, message: Memory, _state?: State) => {
    const provider = new WalletProvider(runtime);
    let walletPortfolio: TokenBalances | null = null;
    let tokenUsdValues: CoingeckoPrices | null = null;

    try {
      walletPortfolio = await provider.getWalletPortfolio();
      tokenUsdValues = await provider.getTokenUsdValues();
    } catch (error: any) {
      elizaLogger.error("[PORTFOLIO-PLUGIN] Error in walletProvider.get()", {
        error: error.message,
        stack: error.stack,
      });
      const response = {
        text: "Unable to fetch wallet portfolio. Please try again later.",
        source: "PORTFOLIO_PROVIDER",
        user: runtime.character.id,
        thought: `Failed to fetch portfolio: ${error.message}`,
        createdAt: Date.now(),
      };
      await runtime.messageManager.createMemory({
        id: stringToUuid(`${Date.now()}${Math.random()}`),
        content: response,
        agentId: runtime.agentId,
        roomId: message.roomId,
        userId: runtime.character.id,
        createdAt: Date.now(),
      });
      return { text: "" };
    }

    const rows = Object.entries(PORTFOLIO_TOKENS)
      .map(([symbol, token]: [string, TokenInfo]) => {
        const rawBalance = walletPortfolio[token.address];
        if (rawBalance === undefined) return null;

        const decimalBalance = Number(rawBalance) / 10 ** token.decimals;
        const price = tokenUsdValues[token.coingeckoId]?.usd ?? 0;
        const usdValue = decimalBalance * price;

        if (decimalBalance === 0 && usdValue === 0) return null;

        return `${symbol.padEnd(9)}| ${decimalBalance
          .toFixed(18)
          .replace(/\.?0+$/, "")
          .padEnd(20)}| ${usdValue.toFixed(2)}`;
      })
      .filter((row): row is string => row !== null);

    const header = "symbol   | balance             | USD value";
    const separator = "==================================================";
    const portfolioText = [header, separator, ...rows].join("\n");

    const response = {
      text: portfolioText,
      source: "PORTFOLIO_PROVIDER",
      user: runtime.character.id,
      thought: "Fetched wallet portfolio successfully",
      createdAt: Date.now(),
    };

    await runtime.messageManager.createMemory({
      id: stringToUuid(`${Date.now()}${Math.random()}`),
      content: response,
      agentId: runtime.agentId,
      roomId: message.roomId,
      userId: runtime.character.id,
      createdAt: Date.now(),
    });

    return {
      text: portfolioText,
      data: {
        walletPortfolio,
        tokenUsdValues,
      },
      values: {
        totalTokens: rows.length,
        hasBalance: rows.length > 0,
      },
    };
  },
};

export type { TokenBalances };