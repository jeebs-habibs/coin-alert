import { PriceData } from "../firebase/tokenUtils";
import { RedisClient } from "../redis";

// 🔹 Get Token Prices from Redis (last hour)
export async function getTokenPrices(
  token: string,
  redisClient: RedisClient
): Promise<PriceData[]> {
  try {
    const priceKey = `prices:${token}`;

    // Get prices from the last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    const pricesWithScores = await redisClient.zRangeByScoreWithScores(
      priceKey,
      oneHourAgo,
      Date.now()
    );

    // Parse each value from JSON
    const parsedPrices: PriceData[] = pricesWithScores.map(entry => {
      const data = JSON.parse(entry.value);
      return {
        ...data,
        timestamp: entry.score, // override with Redis score
      };
    });

    return parsedPrices;

  } catch (error) {
    console.error(`❌ Error retrieving prices for ${token} from Redis:`, error);
    return [];
  }
}

export async function getTokenPricesCached(
  token: string,
  pricesCache: Map<string, PriceData[]>,
  redisClient: RedisClient
): Promise<PriceData[] | undefined> {
  // Check local cache first
  if (pricesCache.has(token)) {
    return pricesCache.get(token);
  }

  // Otherwise, fetch from Redis
  const prices = await getTokenPrices(token, redisClient);

  if (prices.length > 0) {
    pricesCache.set(token, prices);
    return prices;
  }

  return undefined;
}
