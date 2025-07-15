import { getRedisClient, RedisClient } from "@/app/lib/redis";
import { getTokenPricesCached } from "@/app/lib/redis/prices";
import { getTokenCached } from "@/app/lib/redis/tokens";
import { NextRequest, NextResponse } from "next/server";
import { PriceData, Token, TokenData, TokenPriceWithMetadata, TrendingTokensResponse } from "../../../../../shared/types/token";

// Metrics for logging
let totalTokensProcessed: number = 0;
let tokensWithPriceData: number = 0;
let tokensWithoutPriceData: number = 0;
let tokensWithRecentPrice: number = 0;
let tokensWithoutRecentPrice: number = 0;
let tokensWithHistoricalPrice: number = 0;
let tokensWithoutHistoricalPrice: number = 0;
let tokensWithMissingMetadata: number = 0;
let timeToGetTokensSeconds: number = 0;

const TIMEFRAME_SECONDS: number = 3600; // 1 hour

// Stores a precomputed percentage change in the trending:1h sorted set
async function storeTokenPercentChange(
  tokenMint: string,
  percentChange: number,
  redisClient: RedisClient
): Promise<boolean> {
  try {
    if (!tokenMint || !isFinite(percentChange)) {
      console.error(`Invalid input for token ${tokenMint}: percentChange=${percentChange}`);
      return false;
    }
    await redisClient.zAdd("trending:1h", { score: percentChange, value: tokenMint });
    const ttl = await redisClient.ttl("trending:1h");
    if (ttl === -1) {
      await redisClient.expire("trending:1h", TIMEFRAME_SECONDS * 2); // 2 hours
    }
    console.debug(`Stored percent change ${percentChange.toFixed(2)}% for token ${tokenMint}`);
    return true;
  } catch (error) {
    console.error(`❌ Error storing percent change for token ${tokenMint}:`, error);
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<TrendingTokensResponse>> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const timeBeforeProcessing = Date.now();
    const redisClient = await getRedisClient();
    const pricesCache = new Map<string, PriceData[]>();
    const tokenCache = new Map<string, Token>();
    const topN = Math.min(parseInt(request.nextUrl.searchParams.get("topN") || "5"), 50);

    const priceChanges: TokenPriceWithMetadata[] = [];
    const priceFetchTimes: number[] = [];
    let usedSortedSet = false;

    // Try fetching from trending:1h sorted set
    const winners = await redisClient.zRangeWithScores("trending:1h", 0, topN - 1, { REV: true });
    const losers = await redisClient.zRangeWithScores("trending:1h", 0, topN - 1);

    if (winners.length >= topN && losers.length >= topN) {
      usedSortedSet = true;
      totalTokensProcessed = winners.length + losers.length;

      // Process winners and losers in parallel
      await Promise.all(
        [...winners, ...losers].map(async ({ value: mint, score: percentChange }) => {
          try {
            const timeBeforeFetchPrice = Date.now();
            const [token, source] = await getTokenCached(mint, tokenCache, redisClient);
            if (!token) {
              tokensWithMissingMetadata++;
              console.warn(`No metadata found for token ${mint}`);
            }

            const prices = await getTokenPricesCached(mint, pricesCache, redisClient);
            if (!prices || prices.length === 0) {
              tokensWithoutPriceData++;
              console.warn(`No price data for token ${mint}`);
              return;
            }
            tokensWithPriceData++;

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

            const timeAfterFetchPrice = Date.now();
            priceFetchTimes.push(timeAfterFetchPrice - timeBeforeFetchPrice);
            console.debug(`Fetched token ${mint} from ${source}`);
          } catch (e) {
            console.error(`Error processing token ${mint}: ${e instanceof Error ? e.stack : e}`);
          }
        })
      );
    } else {
      // Fallback: Scan all tokens and compute percent changes
      console.warn("trending:1h has insufficient data, falling back to scanning");
      const tokensToProcess: [string, Token][] = [];
      const iter = redisClient.scanIterator({ MATCH: "prices:*", COUNT: 1000 });
      const timeBeforeGettingTokens = Date.now();

      // Collect tokens
      for await (const keys of iter) {
        for (const priceKey of keys) {
          const tokenMint = priceKey.split(":")[1];
          totalTokensProcessed++;
          let token: Token = { tokenData: {} as TokenData, isDead: false };
          try {
            const [tokenData, source] = await getTokenCached(tokenMint, tokenCache, redisClient);
            if (tokenData) {
              token = tokenData;
              console.debug(`Fetched token ${tokenMint} from ${source}`);
            } else {
              tokensWithMissingMetadata++;
              console.warn(`No metadata found for token ${tokenMint}`);
            }
          } catch (e) {
            tokensWithMissingMetadata++;
            console.error(`Failed to fetch metadata for token ${tokenMint}: ${e instanceof Error ? e.stack : e}`);
          }
          tokensToProcess.push([tokenMint, token]);
        }
      }

      const timeAfterGettingTokens = Date.now();
      timeToGetTokensSeconds = (timeAfterGettingTokens - timeBeforeGettingTokens) / 1000;
      console.log(`Collected ${tokensToProcess.length} tokens for processing`);

      const now = Math.floor(Date.now());
      const oneHourAgo = now - TIMEFRAME_SECONDS * 1000;

      // Process tokens sequentially
      for (const [mint, token] of tokensToProcess) {
        try {
          const timeBeforeFetchPrice = Date.now();
          const prices = await getTokenPricesCached(mint, pricesCache, redisClient);
          if (!prices || prices.length === 0) {
            tokensWithoutPriceData++;
            continue;
          }
          tokensWithPriceData++;

          const latestPrice = prices.reduce((latest: PriceData, current: PriceData) =>
            current.timestamp > latest.timestamp ? current : latest
          );
          const currentPrice = latestPrice.price;
          const latestTimestamp = latestPrice.timestamp;

          if (latestTimestamp < oneHourAgo) {
            tokensWithoutRecentPrice++;
            continue;
          }
          tokensWithRecentPrice++;

          const historicalPrice = prices.reduce((closest: PriceData, current: PriceData) => {
            const currentDiff = Math.abs(current.timestamp - oneHourAgo);
            const closestDiff = Math.abs(closest.timestamp - oneHourAgo);
            return currentDiff < closestDiff ? current : closest;
          });
          const price1hAgo = historicalPrice.price;

          if (!historicalPrice || currentPrice <= 0 || price1hAgo <= 0) {
            tokensWithoutHistoricalPrice++;
            continue;
          }
          tokensWithHistoricalPrice++;

          const percentChange = ((currentPrice - price1hAgo) / price1hAgo) * 100;

          // Store percent change in trending:1h
          await storeTokenPercentChange(mint, percentChange, redisClient);

          const symbol = token.tokenData?.tokenMetadata?.symbol || (mint.slice(0, 6) + "...");

          priceChanges.push({
            mint,
            symbol,
            percentChange,
            currentPrice,
            marketCapSol: latestPrice.marketCapSol,
            pool: latestPrice.pool,
            name: token.tokenData?.tokenMetadata?.name,
            image: token.tokenData?.tokenMetadata?.image,
            uri: token.tokenData?.tokenMetadata?.uri,
            description: token.tokenData?.tokenMetadata?.description,
          });

          const timeAfterFetchPrice = Date.now();
          priceFetchTimes.push(timeAfterFetchPrice - timeBeforeFetchPrice);
        } catch (e) {
          console.error(`ERROR for token ${mint}:\n${e instanceof Error ? e.stack : e}`);
        }
      }
    }

    // Sort by percentage change
    priceChanges.sort((a: TokenPriceWithMetadata, b: TokenPriceWithMetadata) => b.percentChange - a.percentChange);

    // Get top N winners and losers
    const winnersResult = priceChanges.slice(0, topN);
    const losersResult = priceChanges.slice(-topN).reverse();

    await redisClient.quit();

    const avgPriceFetchTime = priceFetchTimes.length ? priceFetchTimes.reduce((a, b) => a + b, 0) / priceFetchTimes.length : 0;
    const timeAfterProcessing = Date.now();
    const processingTimeSeconds = (timeAfterProcessing - timeBeforeProcessing) / 1000;

    const message = `
      ✅ Trending tokens retrieved ${usedSortedSet ? "from trending:1h" : "via fallback scanning"} in ${processingTimeSeconds.toFixed(2)} seconds.
      ${usedSortedSet ? "" : `Got tokens in ${timeToGetTokensSeconds} seconds.`}
      Total tokens processed: ${totalTokensProcessed},
      Tokens with price data: ${tokensWithPriceData},
      Tokens without price data: ${tokensWithoutPriceData},
      Tokens with recent price: ${tokensWithRecentPrice},
      Tokens without recent price: ${tokensWithoutRecentPrice},
      Tokens with historical price: ${tokensWithHistoricalPrice},
      Tokens without historical price: ${tokensWithoutHistoricalPrice},
      Tokens with missing metadata: ${tokensWithMissingMetadata},
      Average price fetch time: ${avgPriceFetchTime.toFixed(2)} ms,
      Coverage percentage: ${totalTokensProcessed ? ((tokensWithHistoricalPrice / totalTokensProcessed) * 100).toFixed(2) : 0}%.
    `;

    console.log(message);
    return NextResponse.json(
      {
        message,
        data: { winners: winnersResult, losers: losersResult },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error retrieving trending tokens:", error);
    return NextResponse.json({ error: "Failed to retrieve trending tokens" }, { status: 500 });
  }
}