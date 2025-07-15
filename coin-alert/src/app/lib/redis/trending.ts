import { RedisClient } from "@/app/lib/redis";
import { getTokenPricesCached } from "@/app/lib/redis/prices";
import { getTokenCached } from "@/app/lib/redis/tokens";
import { PriceData, Token, TokenPriceWithMetadata, TrendingTokensResponse } from "../../../../../shared/types/token";

// Retrieves top N and bottom N movers from the trending:1h sorted set
export async function getTopAndBottomMovers(
  redisClient: RedisClient,
  topN: number = 5,
  pricesCache: Map<string, PriceData[]> = new Map(),
  tokenCache: Map<string, Token> = new Map()
): Promise<TrendingTokensResponse> {
  const metrics = {
    totalTokensProcessed: 0,
    tokensWithPriceData: 0,
    tokensWithoutPriceData: 0,
    tokensWithMissingMetadata: 0,
  };

  try {
    const timeBeforeProcessing = Date.now();
    const topNClamped = Math.min(topN, 50); // Limit to 50 for safety

    // Fetch top N (winners) and bottom N (losers) from trending:1h
    const winners = await redisClient.zRangeWithScores("trending:1h", 0, topNClamped - 1, { REV: true });
    const losers = await redisClient.zRangeWithScores("trending:1h", 0, topNClamped - 1);
    metrics.totalTokensProcessed = winners.length + losers.length;

    const priceChanges: TokenPriceWithMetadata[] = [];

    // Process winners and losers
    for (const { value: mint, score: percentChange } of [...winners, ...losers]) {
      try {
        const [token, source] = await getTokenCached(mint, tokenCache, redisClient);
        if (!token) {
          metrics.tokensWithMissingMetadata++;
          console.warn(`No metadata found for token ${mint}`);
        }

        const prices = await getTokenPricesCached(mint, pricesCache, redisClient);
        if (!prices || prices.length === 0) {
          metrics.tokensWithoutPriceData++;
          console.warn(`No price data for token ${mint}`);
          continue;
        }
        metrics.tokensWithPriceData++;

        const latestPrice = prices.reduce((a, b) => (a.timestamp > b.timestamp ? a : b));
        const symbol = token?.tokenData?.tokenMetadata?.symbol || (mint.slice(0, 6) + "...");

        priceChanges.push({
          mint,
          symbol,
          percentChange,
          currentPrice: latestPrice.price,
          marketCapSol: latestPrice.marketCapSol,
          pool: latestPrice.pool,
          name: token?.tokenData?.tokenMetadata?.name,
          image: token?.tokenData?.tokenMetadata?.image,
          uri: token?.tokenData?.tokenMetadata?.uri,
          description: token?.tokenData?.tokenMetadata?.description,
        });

        console.debug(`Fetched token ${mint} from ${source}`);
      } catch (e) {
        console.error(`Error processing token ${mint}: ${e instanceof Error ? e.stack : e}`);
      }
    }

    const timeAfterProcessing = Date.now();
    const processingTimeSeconds = (timeAfterProcessing - timeBeforeProcessing) / 1000;

    const message = `
      ✅ Fetched ${priceChanges.length} trending tokens in ${processingTimeSeconds.toFixed(2)} seconds.
      Total tokens processed: ${metrics.totalTokensProcessed},
      Tokens with price data: ${metrics.tokensWithPriceData},
      Tokens without price data: ${metrics.tokensWithoutPriceData},
      Tokens with missing metadata: ${metrics.tokensWithMissingMetadata}.
    `;

    return {
      message,
      data: {
        winners: priceChanges.slice(0, Math.min(topNClamped, priceChanges.length)),
        losers: priceChanges.slice(-Math.min(topNClamped, priceChanges.length)).reverse(),
      },
    };
  } catch (error) {
    console.error("❌ Error retrieving trending tokens:", error);
    return {
      message: `Error retrieving trending tokens: ${error instanceof Error ? error.message : String(error)}`,
      data: { winners: [], losers: [] },
    };
  }
}

// Stores a precomputed 1-hour percentage change for a token in the trending:1h sorted set
export async function storeTokenPercentChange(
  tokenMint: string,
  percentChange: number,
  redisClient: RedisClient
): Promise<boolean> {
  try {
    // Validate input
    if (!tokenMint || !isFinite(percentChange)) {
      console.error(`Invalid input for token ${tokenMint}: percentChange=${percentChange}`);
      return false;
    }

    // Store in trending:1h sorted set
    await redisClient.zAdd("trending:1h", { score: percentChange, value: tokenMint });

    // Set TTL (2 hours) if not already set
    const ttl = await redisClient.ttl("trending:1h");
    if (ttl === -1) { // No TTL set
      await redisClient.expire("trending:1h", 7200); // 2 hours
    }

    console.debug(`Stored percent change ${percentChange.toFixed(2)}% for token ${tokenMint}`);
    return true;
  } catch (error) {
    console.error(`❌ Error storing percent change for token ${tokenMint}:`, error);
    return false;
  }
}