// import { num } from "starknet";
// import {
//   type AgentRuntime,
//   type Memory,
//   type Provider,
//   type State,
//   elizaLogger,
//   stringToUuid,
// } from "@elizaos/core";
// import type {
//   DexScreenerData,
//   DexScreenerPair,
//   HolderData,
//   ProcessedTokenData,
//   TokenSecurityData,
//   CalculatedBuyAmounts,
//   Prices,
//   TokenInfo,
// } from "../types/db";
// import { PORTFOLIO_TOKENS } from "./token";
// import { PROVIDER_CONFIG } from "../index";
// import { Cache } from "../utils/cache";
// import { analyzeHighSupplyHolders, evaluateTokenTrading, type TokenMetrics } from "./utils";
// import { WalletProvider, type TokenBalances } from "./portfolioProvider";

// export class TokenProvider {
//   private cache: Cache;

//   constructor(private tokenAddress: string, private walletProvider: WalletProvider) {
//     this.cache = new Cache();
//   }

//   private async fetchWithRetry<T>(url: string, options: RequestInit = {}): Promise<T> {
//     let lastError: Error;
//     for (let i = 0; i < PROVIDER_CONFIG.MAX_RETRIES; i++) {
//       try {
//         const response = await fetch(url, {
//           ...options,
//           headers: { "Content-Type": "application/json", ...options.headers },
//         });
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
//         }
//         return await response.json();
//       } catch (error) {
//         lastError = error as Error;
//         elizaLogger.error(`Request attempt ${i + 1} failed`, { error: lastError.message });
//         if (i < PROVIDER_CONFIG.MAX_RETRIES - 1) {
//           const delay = PROVIDER_CONFIG.RETRY_DELAY * 2 ** i;
//           await new Promise(resolve => setTimeout(resolve, delay));
//         }
//       }
//     }
//     throw lastError;
//   }

//   async getTokensInWallet(): Promise<TokenBalances> {
//     return await this.walletProvider.getWalletPortfolio();
//   }

//   async getTokenFromWallet(tokenSymbol: string): Promise<string | null> {
//     try {
//       const portfolioToken = Object.values(PORTFOLIO_TOKENS).find(
//         (token: TokenInfo) => token.coingeckoId === tokenSymbol
//       );
//       if (!portfolioToken) {
//         elizaLogger.warn("[TOKEN-PLUGIN] Token not found in PORTFOLIO_TOKENS", { tokenSymbol });
//         return null;
//       }
//       const items = await this.getTokensInWallet();
//       if (items[portfolioToken.address]) {
//         return portfolioToken.address;
//       }
//       elizaLogger.warn("[TOKEN-PLUGIN] Token not found in wallet", { tokenAddress: portfolioToken.address });
//       return null;
//     } catch (error: any) {
//       elizaLogger.error("[TOKEN-PLUGIN] Error checking token in wallet", { error: error.message });
//       return null;
//     }
//   }

//   async fetchPrices(): Promise<Prices> {
//     const cacheKey = "prices";
//     const cachedData = this.cache.getCachedData<Prices>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached prices", { cacheKey });
//       return cachedData;
//     }

//     const { BTC, ETH, STRK } = PROVIDER_CONFIG.TOKEN_ADDRESSES;
//     const tokens = [BTC, ETH, STRK];
//     const prices: Prices = { starknet: { usd: "0" }, bitcoin: { usd: "0" }, ethereum: { usd: "0" } };

//     const tokenResponses = await Promise.all(
//       tokens.map(token =>
//         this.fetchWithRetry<TokenInfo>(`${PROVIDER_CONFIG.AVNU_API}/tokens/${token}`)
//       )
//     );

//     tokenResponses.forEach((tokenInfo, index) => {
//       if (!tokenInfo.market) {
//         elizaLogger.warn("[TOKEN-PLUGIN] No price data available", { token: tokens[index] });
//         return;
//       }
//       const token = tokens[index];
//       const priceKey = token === STRK ? "starknet" : token === BTC ? "bitcoin" : "ethereum";
//       prices[priceKey].usd = tokenInfo.market.currentPrice.toString();
//     });

//     this.cache.setCachedData(cacheKey, prices);
//     return prices;
//   }

//   async calculateBuyAmounts(): Promise<CalculatedBuyAmounts> {
//     const dexScreenerData = await this.fetchDexScreenerData();
//     const prices = await this.fetchPrices();
//     const starknetPrice = num.toBigInt(prices.starknet.usd);

//     if (!dexScreenerData || dexScreenerData.pairs.length === 0) {
//       return { none: 0, low: 0, medium: 0, high: 0 };
//     }

//     const pair = dexScreenerData.pairs[0];
//     const { liquidity, marketCap } = pair;
//     if (!liquidity || !marketCap || liquidity.usd === 0 || marketCap < 100000) {
//       return { none: 0, low: 0, medium: 0, high: 0 };
//     }

//     const impactPercentages = { LOW: 0.01, MEDIUM: 0.05, HIGH: 0.1 };
//     const lowBuyAmountUSD = liquidity.usd * impactPercentages.LOW;
//     const mediumBuyAmountUSD = liquidity.usd * impactPercentages.MEDIUM;
//     const highBuyAmountUSD = liquidity.usd * impactPercentages.HIGH;

//     const lowBuyAmountSTRK = num.toBigInt(lowBuyAmountUSD) / starknetPrice;
//     const mediumBuyAmountSTRK = num.toBigInt(mediumBuyAmountUSD) / starknetPrice;
//     const highBuyAmountSTRK = num.toBigInt(highBuyAmountUSD) / starknetPrice;

//     return {
//       none: 0,
//       low: Number(lowBuyAmountSTRK),
//       medium: Number(mediumBuyAmountSTRK),
//       high: Number(highBuyAmountSTRK),
//     };
//   }

//   async fetchTokenSecurity(): Promise<TokenSecurityData> {
//     const cacheKey = `tokenSecurity_${this.tokenAddress}`;
//     const cachedData = this.cache.getCachedData<TokenSecurityData>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached token security data", { cacheKey });
//       return cachedData;
//     }

//     const url = `${PROVIDER_CONFIG.STARKNET_API}/tokens/${this.tokenAddress}/security`;
//     const data = await this.fetchWithRetry<any>(url).catch(() => ({
//       ownerBalance: "0",
//       creatorBalance: "0",
//       ownerPercentage: 0,
//       creatorPercentage: 0,
//       top10HolderBalance: "0",
//       top10HolderPercent: 0,
//     }));

//     const security: TokenSecurityData = {
//       ownerBalance: data.ownerBalance || "0",
//       creatorBalance: data.creatorBalance || "0",
//       ownerPercentage: data.ownerPercentage || 0,
//       creatorPercentage: data.creatorPercentage || 0,
//       top10HolderBalance: data.top10HolderBalance || "0",
//       top10HolderPercent: data.top10HolderPercent || 0,
//     };

//     this.cache.setCachedData(cacheKey, security);
//     return security;
//   }

//   async fetchTokenTradeData(): Promise<TokenInfo> {
//     const cacheKey = `tokenTradeData_${this.tokenAddress}`;
//     const cachedData = this.cache.getCachedData<TokenInfo>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached token trade data", { cacheKey });
//       return cachedData;
//     }

//     const data = await this.fetchWithRetry<any>(`${PROVIDER_CONFIG.AVNU_API}/tokens/${this.tokenAddress}`);
//     if (!data?.success || !data?.data) {
//       throw new Error("No token trade data available");
//     }

//     const tradeData: TokenInfo = {
//       name: data.data.name,
//       symbol: data.data.symbol,
//       address: data.data.address,
//       logoUri: data.data.logoUri,
//       coingeckoId: data.data.coingeckoId,
//       verified: data.data.verified,
//       market: {
//         currentPrice: data.data.market.currentPrice,
//         marketCap: data.data.market.marketCap,
//         fullyDilutedValuation: data.data.market.fullyDilutedValuation,
//         starknetTvl: data.data.market.starknetTvl,
//         priceChange1h: data.data.market.priceChange1h,
//         priceChangePercentage1h: data.data.market.priceChangePercentage1h,
//         priceChange24h: data.data.market.priceChange24h,
//         priceChangePercentage24h: data.data.market.priceChangePercentage24h,
//         priceChange7d: data.data.market.priceChange7d,
//         priceChangePercentage7d: data.data.market.priceChangePercentage7d,
//         marketCapChange24h: data.data.market.marketCapChange24h,
//         marketCapChangePercentage24h: data.data.market.marketCapChangePercentage24h,
//         starknetVolume24h: data.data.market.starknetVolume24h,
//         starknetTradingVolume24h: data.data.market.starknetTradingVolume24h,
//       },
//       tags: data.data.tags,
//     };

//     this.cache.setCachedData(cacheKey, tradeData);
//     return tradeData;
//   }

//   async fetchDexScreenerData(): Promise<DexScreenerData> {
//     const cacheKey = `dexScreenerData_${this.tokenAddress}`;
//     const cachedData = this.cache.getCachedData<DexScreenerData>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached DexScreener data", { cacheKey });
//       return cachedData;
//     }

//     const url = `${PROVIDER_CONFIG.STARKNET_API}/dex/tokens/${this.tokenAddress}`;
//     const data = await this.fetchWithRetry<any>(url).catch(() => ({ pairs: [] }));

//     const dexData: DexScreenerData = {
//       schemaVersion: data.schemaVersion || "1.0.0",
//       pairs: data.pairs || [],
//     };

//     this.cache.setCachedData(cacheKey, dexData);
//     return dexData;
//   }

//   async searchDexScreenerData(symbol: string): Promise<DexScreenerPair | null> {
//     const cacheKey = `dexScreenerData_search_${symbol}`;
//     const cachedData = this.cache.getCachedData<DexScreenerData>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached search DexScreener data", { cacheKey });
//       return this.getHighestLiquidityPair(cachedData);
//     }

//     const url = `${PROVIDER_CONFIG.STARKNET_API}/dex/search?q=${symbol}`;
//     const data = await this.fetchWithRetry<any>(url).catch(() => ({ pairs: [] }));

//     const dexData: DexScreenerData = {
//       schemaVersion: data.schemaVersion || "1.0.0",
//       pairs: data.pairs || [],
//     };

//     this.cache.setCachedData(cacheKey, dexData);
//     return this.getHighestLiquidityPair(dexData);
//   }

//   getHighestLiquidityPair(dexData: DexScreenerData): DexScreenerPair | null {
//     if (dexData.pairs.length === 0) return null;
//     return dexData.pairs.sort((a, b) => {
//       const liquidityDiff = b.liquidity.usd - a.liquidity.usd;
//       return liquidityDiff !== 0 ? liquidityDiff : b.marketCap - a.marketCap;
//     })[0];
//   }

//   async analyzeHolderDistribution(tradeData: TokenInfo): Promise<string> {
//     const intervals = [
//       { period: "1h", change: tradeData.market.priceChangePercentage1h },
//       { period: "24h", change: tradeData.market.priceChangePercentage24h },
//       { period: "7d", change: tradeData.market.priceChangePercentage7d },
//     ];

//     const validChanges = intervals.map(i => i.change).filter(c => c !== undefined) as number[];
//     if (validChanges.length === 0) return "stable";

//     const averageChange = validChanges.reduce((acc, curr) => acc + curr, 0) / validChanges.length;
//     return averageChange > 10 ? "increasing" : averageChange < -10 ? "decreasing" : "stable";
//   }

//   async fetchHolderList(): Promise<HolderData[]> {
//     const cacheKey = `holderList_${this.tokenAddress}`;
//     const cachedData = this.cache.getCachedData<HolderData[]>(cacheKey);
//     if (cachedData) {
//       elizaLogger.debug("[TOKEN-PLUGIN] Returning cached holder list", { cacheKey });
//       return cachedData;
//     }

//     const url = `${PROVIDER_CONFIG.STARKNET_API}/tokens/${this.tokenAddress}/holders`;
//     const data = await this.fetchWithRetry<any>(url).catch(() => ({ holders: [] }));

//     const holders: HolderData[] = data.holders?.map((h: any) => ({
//       address: h.address,
//       balance: h.balance.toString(),
//     })) || [];

//     this.cache.setCachedData(cacheKey, holders);
//     return holders;
//   }

//   async filterHighValueHolders(tradeData: TokenInfo): Promise<Array<{ holderAddress: string; balanceUsd: string }>> {
//     const holdersData = await this.fetchHolderList();
//     const tokenPriceUsd = num.toBigInt(tradeData.market.currentPrice);

//     return holdersData
//       .filter(holder => {
//         const balanceUsd = num.toBigInt(holder.balance) * tokenPriceUsd;
//         return balanceUsd > 5;
//       })
//       .map(holder => ({
//         holderAddress: holder.address,
//         balanceUsd: (num.toBigInt(holder.balance) * tokenPriceUsd).toString(),
//       }));
//   }

//   async checkRecentTrades(volume24hUsd: bigint): Promise<boolean> {
//     return volume24hUsd > 0;
//   }

//   async countHighSupplyHolders(securityData: TokenSecurityData): Promise<number> {
//     const holders = await this.fetchHolderList();
//     const result = analyzeHighSupplyHolders({
//       holders,
//       ownerBalance: securityData.ownerBalance,
//       creatorBalance: securityData.creatorBalance,
//     });
//     return result.count;
//   }

//   async getProcessedTokenData(): Promise<ProcessedTokenData> {
//     const [security, tradeData, dexData] = await Promise.all([
//       this.fetchTokenSecurity(),
//       this.fetchTokenTradeData(),
//       this.fetchDexScreenerData(),
//     ]);

//     const holderDistributionTrend = await this.analyzeHolderDistribution(tradeData);
//     const highValueHolders = await this.filterHighValueHolders(tradeData);
//     const recentTrades = await this.checkRecentTrades(num.toBigInt(tradeData.market.starknetTradingVolume24h));
//     const highSupplyHoldersCount = await this.countHighSupplyHolders(security);
//     const isDexScreenerListed = dexData.pairs.length > 0;
//     const isDexScreenerPaid = dexData.pairs.some(pair => pair.boosts && pair.boosts.active > 0);

//     return {
//       security,
//       tradeData,
//       holderDistributionTrend,
//       highValueHolders,
//       recentTrades,
//       highSupplyHoldersCount,
//       dexScreenerData: dexData,
//       isDexScreenerListed,
//       isDexScreenerPaid,
//     };
//   }

//   async shouldTradeToken(): Promise<boolean> {
//     const tokenData = await this.getProcessedTokenData();
//     const { tradeData, security, dexScreenerData } = tokenData;
//     const { ownerBalance, creatorBalance } = security;
//     const { liquidity, marketCap } = dexScreenerData.pairs[0] || { liquidity: { usd: 0 }, marketCap: 0 };

//     const totalSupply = num.toBigInt(ownerBalance) + num.toBigInt(creatorBalance);
//     const metrics: TokenMetrics = {
//       liquidityUsd: num.toBigInt(liquidity.usd),
//       marketCapUsd: num.toBigInt(marketCap),
//       totalSupply,
//       ownerPercentage: Number(num.toBigInt(ownerBalance)) / Number(totalSupply),
//       creatorPercentage: Number(num.toBigInt(creatorBalance)) / Number(totalSupply),
//       top10HolderPercent: Number(num.toBigInt(tradeData.market.starknetTradingVolume24h)) / Number(totalSupply),
//       priceChange24hPercent: Number(num.toBigInt(tradeData.market.priceChange24h)),
//       priceChange12hPercent: Number(num.toBigInt(tradeData.market.priceChange24h)), // Placeholder
//       uniqueWallet24h: 0, // Placeholder
//       volume24hUsd: num.toBigInt(tradeData.market.starknetTradingVolume24h),
//     };

//     const { shouldTrade } = evaluateTokenTrading(metrics);
//     return shouldTrade;
//   }

//   formatTokenData(data: ProcessedTokenData): string {
//     let output = `**Token Security and Trade Report**\nToken Address: ${this.tokenAddress}\n\n`;
//     output += `**Ownership Distribution:**\n`;
//     output += `- Owner Balance: ${data.security.ownerBalance}\n`;
//     output += `- Creator Balance: ${data.security.creatorBalance}\n`;
//     output += `- Owner Percentage: ${data.security.ownerPercentage}%\n`;
//     output += `- Creator Percentage: ${data.security.creatorPercentage}%\n`;
//     output += `- Top 10 Holders Balance: ${data.security.top10HolderBalance}\n`;
//     output += `- Top 10 Holders Percentage: ${data.security.top10HolderPercent}%\n\n`;
//     output += `**Trade Data:**\n`;
//     output += `- Price Change (24h): ${data.tradeData.market.priceChange24h}%\n`;
//     output += `- Volume (24h USD): $${num.toBigInt(data.tradeData.market.starknetTradingVolume24h).toString()}\n`;
//     output += `- Current Price: $${num.toBigInt(data.tradeData.market.currentPrice).toString()}\n\n`;
//     output += `**Holder Distribution Trend:** ${data.holderDistributionTrend}\n\n`;
//     output += `**High-Value Holders (>$5 USD):**\n`;
//     output += data.highValueHolders.length === 0 ? `- No high-value holders found.\n` : data.highValueHolders.map(h => `- ${h.holderAddress}: $${h.balanceUsd}\n`).join("");
//     output += `\n**Recent Trades (Last 24h):** ${data.recentTrades ? "Yes" : "No"}\n\n`;
//     output += `**Holders with >2% Supply:** ${data.highSupplyHoldersCount}\n\n`;
//     output += `**DexScreener Listing:** ${data.isDexScreenerListed ? "Yes" : "No"}\n`;
//     if (data.isDexScreenerListed) {
//       output += `- Listing Type: ${data.isDexScreenerPaid ? "Paid" : "Free"}\n`;
//       output += `- Number of DexPairs: ${data.dexScreenerData.pairs.length}\n\n`;
//       output += `**DexScreener Pairs:**\n`;
//       data.dexScreenerData.pairs.forEach((pair, index) => {
//         output += `\n**Pair ${index + 1}:**\n`;
//         output += `- DEX: ${pair.dexId}\n`;
//         output += `- URL: ${pair.url}\n`;
//         output += `- Price USD: $${num.toBigInt(pair.priceUsd).toString()}\n`;
//         output += `- Volume (24h USD): $${num.toBigInt(pair.volume.h24).toString()}\n`;
//         output += `- Boosts Active: ${pair.boosts && pair.boosts.active}\n`;
//         output += `- Liquidity USD: $${num.toBigInt(pair.liquidity.usd).toString()}\n`;
//       });
//     }
//     return output;
//   }

//   async getFormattedTokenReport(): Promise<string> {
//     try {
//       const processedData = await this.getProcessedTokenData();
//       return this.formatTokenData(processedData);
//     } catch (error: any) {
//       elizaLogger.error("[TOKEN-PLUGIN] Error generating token report", { error: error.message });
//       return "Unable to fetch token information. Please try again later.";
//     }
//   }
// }

// export const tokenProvider: Provider = {
//   get: async (runtime: AgentRuntime, message: Memory, _state?: State) => {
//     try {
//       const content = message.content?.text || "";
//       const tokenAddressMatch = content.match(/0x[a-fA-F0-9]{64}/);
//       const tokenAddress = tokenAddressMatch ? tokenAddressMatch[0] : PROVIDER_CONFIG.DEFAULT_TOKEN_ADDRESS;

//       const walletProvider = new WalletProvider(runtime);
//       const provider = new TokenProvider(tokenAddress, walletProvider);
//       const report = await provider.getFormattedTokenReport();

//       const response: Content = {
//         text: report,
//         source: "TOKEN_PROVIDER",
//         user: runtime.character.id,
//         thought: `Generated token report for ${tokenAddress}`,
//         createdAt: Date.now(),
//       };

//       await runtime.messageManager.createMemory({
//         id: stringToUuid(`${Date.now()}${Math.random()}`),
//         content: response,
//         agentId: runtime.agentId,
//         roomId: message.roomId,
//         userId: runtime.character.id,
//         createdAt: Date.now(),
//       });

//       return {
//         text: report,
//         data: { tokenAddress, report },
//         values: { tokenAddress },
//       };
//     } catch (error: any) {
//       elizaLogger.error("[TOKEN-PLUGIN] Error fetching token data", { error: error.message });
//       const response: Content = {
//         text: "Unable to fetch token information. Please try again later.",
//         source: "TOKEN_PROVIDER",
//         user: runtime.character.id,
//         thought: `Failed to fetch token data: ${error.message}`,
//         createdAt: Date.now(),
//       };
//       await runtime.messageManager.createMemory({
//         id: stringToUuid(`${Date.now()}${Math.random()}`),
//         content: response,
//         agentId: runtime.agentId,
//         roomId: message.roomId,
//         userId: runtime.character.id,
//         createdAt: Date.now(),
//       });
//       return { text: "" };
//     }
//   },
// };