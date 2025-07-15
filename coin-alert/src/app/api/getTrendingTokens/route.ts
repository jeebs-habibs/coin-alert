import { getRedisClient } from "@/app/lib/redis";
import { getTokenPricesCached } from "@/app/lib/redis/prices";
import { getTokenCached } from "@/app/lib/redis/tokens"; // Import getTokenCached (adjust path as needed)
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
let tokensWithMissingMetadata: number = 0; // Track tokens with no metadata

const MAX_TOKENS_TO_PROCESS: number = 200;
const TIMEFRAME_SECONDS: number = 3600; // 1 hour

export async function GET(request: NextRequest): Promise<NextResponse<TrendingTokensResponse>> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const timeBeforeProcessing: number = Date.now();
    const redisClient = await getRedisClient();
    const pricesCache: Map<string, PriceData[]> = new Map<string, PriceData[]>();
    const tokenCache: Map<string, Token> = new Map<string, Token>(); // Cache for token metadata

    const tokensToProcess: [string, Token][] = [];

    // Get all price keys using scanIterator
    const iter = redisClient.scanIterator({
      MATCH: "prices:*",
      COUNT: 100,
    });

    const timeBeforeGettingTokens: number = Date.now();

    // Collect tokens from Redis
    for await (const keys of iter) {
      for (const priceKey of keys) {
        const tokenMint: string = priceKey.split(":")[1];
        totalTokensProcessed++;
        // Fetch token metadata using getTokenCached
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

    const timeAfterGettingTokens: number = Date.now();
    const timeToGetTokensSeconds: number = (timeAfterGettingTokens - timeBeforeGettingTokens) / 1000;

    // Limit processing to avoid timeout
    const tokensToProcessSubset: [string, Token][] = tokensToProcess.slice(0, MAX_TOKENS_TO_PROCESS);
    console.log(
      `Processing ${tokensToProcessSubset.length} tokens: ${tokensToProcessSubset.map((a) => a[0]).join(",")}`
    );

    const now: number = Math.floor(Date.now());
    const oneHourAgo: number = now - TIMEFRAME_SECONDS * 1000;

    const priceChanges: TokenPriceWithMetadata[] = [];
    const priceFetchTimes: number[] = [];

    // Process tokens in parallel
    await Promise.all(
      tokensToProcessSubset.map(async ([mint, token]: [string, Token]): Promise<void> => {
        try {
          const timeBeforeFetchPrice: number = Date.now();

          const prices: PriceData[] | undefined = await getTokenPricesCached(mint, pricesCache, redisClient);
          if (!prices || prices.length === 0) {
            tokensWithoutPriceData++;
            return;
          }
          tokensWithPriceData++;

          const latestPrice: PriceData = prices.reduce((latest: PriceData, current: PriceData) =>
            current.timestamp > latest.timestamp ? current : latest
          );
          const currentPrice: number = latestPrice.price;
          const latestTimestamp: number = latestPrice.timestamp;

          if (latestTimestamp < oneHourAgo) {
            tokensWithoutRecentPrice++;
            return;
          }
          tokensWithRecentPrice++;

          const historicalPrice: PriceData = prices.reduce((closest: PriceData, current: PriceData) => {
            const currentDiff: number = Math.abs(current.timestamp - oneHourAgo);
            const closestDiff: number = Math.abs(closest.timestamp - oneHourAgo);
            return currentDiff < closestDiff ? current : closest;
          });
          const price1hAgo: number = historicalPrice.price;

          if (!historicalPrice || currentPrice <= 0 || price1hAgo <= 0) {
            tokensWithoutHistoricalPrice++;
            return;
          }
          tokensWithHistoricalPrice++;

          const percentChange: number = ((currentPrice - price1hAgo) / price1hAgo) * 100;

          const symbol: string = token.tokenData?.tokenMetadata?.symbol || (mint.slice(0, 6) + "...");

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

          const timeAfterFetchPrice: number = Date.now();
          priceFetchTimes.push(timeAfterFetchPrice - timeBeforeFetchPrice);
        } catch (e) {
          console.error(`ERROR for token ${mint}:\n${e instanceof Error ? e.stack : e}`);
        }
      })
    );

    const timeAfterProcessing: number = Date.now();

    priceChanges.sort((a: TokenPriceWithMetadata, b: TokenPriceWithMetadata) => b.percentChange - a.percentChange);

    const topN: number = Math.min(parseInt(request.nextUrl.searchParams.get("topN") || "5"), 50);
    const winners: TokenPriceWithMetadata[] = priceChanges.slice(0, topN);
    const losers: TokenPriceWithMetadata[] = priceChanges.slice(-topN).reverse();

    await redisClient.quit();

    const avgPriceFetchTime: number = getAverage(priceFetchTimes);

    const message: string = `
      ✅ Trending tokens retrieved successfully in ${((timeAfterProcessing - timeBeforeProcessing) / 1000).toFixed(2)} seconds.
      Got tokens in ${timeToGetTokensSeconds} seconds.
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
    const dataResponse: TrendingTokensResponse = {
      message,
      data: { winners, losers },
    };
    return NextResponse.json(dataResponse, { status: 200 });
  } catch (error) {
    console.error("❌ Error retrieving trending tokens:", error);
    return NextResponse.json({ error: "Failed to retrieve trending tokens" }, { status: 500 });
  }
}

function getAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum: number = numbers.reduce((acc: number, num: number) => acc + num, 0);
  return sum / numbers.length;
}