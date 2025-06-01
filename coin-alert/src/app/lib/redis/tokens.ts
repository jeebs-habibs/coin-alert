import { Token, TokenData } from "../../../../../shared/types/token";
import { RedisClient } from "../redis";

// 🔹 Get Token from Redis
export async function getTokenFromRedis(tokenId: string, redisClient: RedisClient): Promise<Token | undefined> {
  try {
    const key = `token:${tokenId}`;
    const rawData = await redisClient.hGetAll(key);

    if (!rawData || Object.keys(rawData).length === 0) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenData: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenMetadata: any = {};

    for (const [field, value] of Object.entries(rawData)) {
      if (field.startsWith("tokenMetadata:")) {
        const metaKey = field.replace("tokenMetadata:", "");
        tokenMetadata[metaKey] = isNaN(Number(value)) ? value : Number(value);
      } else if (field === "isDead") {
        tokenData.isDead = value === "true";
      } else {
        tokenData[field] = isNaN(Number(value)) ? value : Number(value);
      }
    }

    const token: Token = {
      tokenData: {
        ...tokenData,
        tokenMetadata,
      },
      isDead: tokenData.isDead ?? false,
    };

    return token;
  } catch (error) {
    console.error(`❌ Error fetching token ${tokenId} from Redis:`, error);
    return undefined;
  }
}


// 🔹 Update Token in Redis
export async function updateTokenInRedis(tokenId: string, updateData: Partial<Token>, redisClient: RedisClient): Promise<boolean> {
  try {
    const key = `token:${tokenId}`;
    const updateFields: Record<string, string> = {};

    if (updateData.tokenData) {
      for (const [field, value] of Object.entries(updateData.tokenData)) {
        if (value == null) continue;

        if (field === "tokenMetadata") {
          for (const [metaKey, metaValue] of Object.entries(value)) {
            if (metaValue != null) {
              updateFields[`tokenMetadata:${metaKey}`] = String(metaValue);
            }
          }
        } else {
          updateFields[field] = String(value);
        }
      }
    }

    if (typeof updateData.isDead !== "undefined") {
      updateFields["isDead"] = String(updateData.isDead);
    }

    if (Object.keys(updateFields).length > 0) {
      await redisClient.hSet(key, updateFields);
    }

    console.log("Updated token in redis with isDead: " + updateData?.isDead)
    return true;
  } catch (error) {
    console.error(`❌ Error updating token ${tokenId} in Redis:`, error);
    return false;
  }
}


export async function setTokenDead(token: string, redisClient: RedisClient): Promise<boolean> {
    const DEAD_PRICE_THRESHOLD = 0.000006;
    const PRICE_VARIATION_THRESHOLD = 0.00001; // 0.001% as a decimal
    const MIN_ENTRIES_REQUIRED = 15;
  try {
    const priceKey = `prices:${token}`;
    
    // Get the 15 most recent prices (timestamps are sorted)
    const rawPrices = await redisClient.zRangeWithScores(priceKey, -MIN_ENTRIES_REQUIRED, -1);
    if (rawPrices.length < MIN_ENTRIES_REQUIRED) {
      //console.log(`🔹 Not enough price data to determine if ${token} is dead. Need at least ${MIN_ENTRIES_REQUIRED} entries, got ${rawPrices.length}.`);
      return false;
    }

    const prices = rawPrices.map(entry => {
      const parsed = JSON.parse(entry.value);
      return {
        price: parsed.price,
        timestamp: parsed.timestamp,
      };
    });

    const mostRecent = prices.reduce((latest, entry) =>
      entry.timestamp > latest.timestamp ? entry : latest
    );

    if (mostRecent.price >= DEAD_PRICE_THRESHOLD) {
     // console.log(`🔹 Token ${token} has a recent price of ${mostRecent.price}, which is above DEAD_PRICE_THRESHOLD of (${DEAD_PRICE_THRESHOLD}). Not dead.`);
      return false;
    }

    const referencePrice = prices[0].price;
    if (referencePrice === 0) {
      //console.log(`🔹 Token ${token} has a price of 0. Marking as dead...`);
      await redisClient.hSet(`token:${token}`, { isDead: "true" });
      //console.log(`✅ Token ${token} successfully marked as dead.`);
      return true;
    }

    const maxAllowedVariation = referencePrice * PRICE_VARIATION_THRESHOLD;
    const allWithinVariation = prices.every(entry =>
      Math.abs(entry.price - referencePrice) <= maxAllowedVariation
    );

    if (allWithinVariation) {
      console.log(`💀 Token ${token} detected as dead (price variation < 0.001% across ${MIN_ENTRIES_REQUIRED} entries). Marking as dead...`);
      await redisClient.hSet(`token:${token}`, { isDead: "true" });
      console.log(`✅ Token ${token} successfully marked as dead.`);
      return true;
    }

    console.log(`🔹 Token ${token} is still active (price variation exceeds 0.001%).`);
    return false;
  } catch (error) {
    console.error(`❌ Error marking token ${token} as dead:`, error);
    return false;
  }
}

export async function getTokenCached(token: string, tokenCache: Map<string, Token>, redisClient: RedisClient): Promise<[Token | undefined, string]> {
  if(tokenCache.has(token)){
    return [tokenCache.get(token), "cache"]
  } 
  const tokenDb = await getTokenFromRedis(token, redisClient)
  if(tokenDb){
    tokenCache.set(token, tokenDb)
    return [tokenDb, "db"]
  }
  return [undefined, "not_found"]

}


export function tokenDataToRedisHash(tokenData: TokenData): Record<string, string> {
  const hash: Record<string, string> = {};
  if (!tokenData) return hash;

  for (const [key, value] of Object.entries(tokenData)) {
    if (value != null && key !== "tokenMetadata") hash[key] = String(value);
  }

  if (tokenData.tokenMetadata) {
    for (const [key, value] of Object.entries(tokenData.tokenMetadata)) {
      if (value != null) hash[`tokenMetadata:${key}`] = String(value);
    }
  }

  return hash;
}
