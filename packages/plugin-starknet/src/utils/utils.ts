import { num } from "starknet";
import { elizaLogger } from "@elizaos/core";


export interface HolderData {
  address: string;
  balance: string;
}

export interface TokenMetrics {
  liquidityUsd: bigint;
  marketCapUsd: bigint;
  totalSupply: bigint;
  ownerPercentage: number;
  creatorPercentage: number;
  top10HolderPercent: number;
  priceChange24hPercent: number;
  priceChange12hPercent: number;
  uniqueWallet24h: number;
  volume24hUsd: bigint;
}

export interface TradingThresholds {
  volume24hUsdThreshold?: number;
  priceChange24hPercentThreshold?: number;
  priceChange12hPercentThreshold?: number;
  top10HolderPercentThreshold?: number;
  uniqueWallet24hThreshold?: number;
  minimumLiquidityUsd?: number;
  minimumMarketCapUsd?: number;
}

export function evaluateTokenTrading(
  metrics: TokenMetrics,
  thresholds: TradingThresholds = {}
): { shouldTrade: boolean; reasons: string[] } {
  const {
    volume24hUsdThreshold = 1000,
    priceChange24hPercentThreshold = 10,
    priceChange12hPercentThreshold = 5,
    top10HolderPercentThreshold = 0.05,
    uniqueWallet24hThreshold = 100,
    minimumLiquidityUsd = 1000,
    minimumMarketCapUsd = 100000,
  } = thresholds;

  const reasons: string[] = [];

  if (metrics.top10HolderPercent >= top10HolderPercentThreshold) {
    reasons.push("High concentration in top 10 holders");
  }

  if (metrics.volume24hUsd >= BigInt(volume24hUsdThreshold)) {
    reasons.push("High 24h trading volume");
  }

  if (metrics.priceChange24hPercent >= priceChange24hPercentThreshold) {
    reasons.push("Significant 24h price change");
  }

  if (metrics.priceChange12hPercent >= priceChange12hPercentThreshold) {
    reasons.push("Significant 12h price change");
  }

  if (metrics.uniqueWallet24h >= uniqueWallet24hThreshold) {
    reasons.push("High number of unique wallets");
  }

  if (metrics.liquidityUsd < BigInt(minimumLiquidityUsd)) {
    reasons.push("Low liquidity");
  }

  if (metrics.marketCapUsd < BigInt(minimumMarketCapUsd)) {
    reasons.push("Low market cap");
  }

  return {
    shouldTrade: reasons.length > 0,
    reasons,
  };
}

export interface HolderAnalysisParams {
  holders: HolderData[];
  ownerBalance: string;
  creatorBalance: string;
  thresholdPercentage?: number;
}

export interface HolderAnalysisResult {
  count: number;
  holders: Array<{
    address: string;
    percentage: number;
  }>;
  totalSupply: bigint;
}

export function analyzeHighSupplyHolders(
  params: HolderAnalysisParams
): HolderAnalysisResult {
  try {
    const {
      holders,
      ownerBalance,
      creatorBalance,
      thresholdPercentage = 0.02,
    } = params;

    const ownerBalanceBigInt = num.toBigInt(ownerBalance);
    const totalSupply = ownerBalanceBigInt + num.toBigInt(creatorBalance);

    const highSupplyHolders = holders
      .map((holder) => {
        const balance = num.toBigInt(holder.balance);
        const percentage = Number(balance) / Number(totalSupply);
        return {
          address: holder.address,
          percentage,
        };
      })
      .filter((holder) => holder.percentage > thresholdPercentage);

    return {
      count: highSupplyHolders.length,
      holders: highSupplyHolders,
      totalSupply,
    };
  } catch (error: any) {
    elizaLogger.error("[TOKEN-PLUGIN] Error analyzing high supply holders", { error: error.message });
    return {
      count: 0,
      holders: [],
      totalSupply: BigInt(0),
    };
  }
}