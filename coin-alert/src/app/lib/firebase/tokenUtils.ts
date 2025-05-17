import { FirestoreDataConverter, Timestamp } from "firebase/firestore";
import { adminDB } from "./firebaseAdmin";
import { RedisClient } from "../redis";

export interface PriceData {
    price: number;
    marketCapSol?: number;
    pool?: PoolType;
    timestamp: number;
    signatures?: string[];
}

export type PoolType = "pump" | "raydium" | "pump-swap" | "meteora"

export interface TokenMetadata {
  symbol?: string;
  name?: string;
  image?: string;
  uri?: string;
  description?: string;
}

export interface TokenData {
  priceFetchFailures?: number;
  pool?: PoolType
  baseVault?: string;
  baseLpVault?: string;
  baseMint?: string;
  quoteVault?: string;
  quoteLpVault?: string;
  quoteMint?: string;
  marketPoolId?: string;
  tokenMetadata?: TokenMetadata;
  metadataFetchFailures?: number;
}

export interface GetPriceResponse {
  price: PriceData;
  tokenData: TokenData;
  complete?: boolean;
  err?: string;
}

export interface Token {
    prices?: PriceData[];
    tokenData?: TokenData;
    isDead?: boolean;
}


const DEAD_PRICE_THRESHOLD = 0.000006;
const PRICE_VARIATION_THRESHOLD = 0.00001; // 0.001% as a decimal
const MIN_ENTRIES_REQUIRED = 15;

export async function setTokenDead(token: string, redisClient: RedisClient): Promise<boolean> {
  try {;
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
      console.log(`🔹 Token ${token} has a recent price of ${mostRecent.price}, which is above DEAD_PRICE_THRESHOLD of (${DEAD_PRICE_THRESHOLD}). Not dead.`);
      return false;
    }

    const referencePrice = prices[0].price;
    if (referencePrice === 0) {
      console.log(`🔹 Token ${token} has a price of 0. Marking as dead...`);
      await redisClient.hSet(`token:${token}`, { isDead: "true" });
      console.log(`✅ Token ${token} successfully marked as dead.`);
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

export const tokenConverter: FirestoreDataConverter<Token> = {
    toFirestore(token: Token) {
      return {
        prices: token?.prices?.map((price) => ({
          timestamp: price.timestamp,
          price: price.price,
        })) || [],
        tokenData: token?.tokenData,
        isDead: token.isDead || false
      };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        prices: data?.prices?.map((price: PriceData) => ({
          timestamp: typeof price.timestamp === "number" ? price.timestamp : (price.timestamp as Timestamp).toMillis(),
          price: price.price,
        })) || [] as PriceData[],
        tokenData: data?.tokenData,
        isDead: data?.isDead || false
      };
    },
  };
  


// 🔹 Fetch a Token from Firestore
export async function getToken(tokenId: string): Promise<Token | undefined> {
  try {
    const tokenDocRef = adminDB.collection("uniqueTokens").doc(tokenId);
    const tokenSnapshot = await tokenDocRef.get();

    if (tokenSnapshot.exists) {
      return tokenSnapshot.data() as Token; // ✅ Explicitly cast to Token
    }
    
    return undefined;
  } catch (error) {
    console.error(`❌ Error fetching token ${tokenId}:`, error);
    return undefined;
  }
}

// 🔹 Update a Token in Firestore with fields from another Token object
export async function updateToken(tokenId: string, updateData: Partial<Token>): Promise<boolean> {
  try {
    const tokenDocRef = adminDB.collection("uniqueTokens").doc(tokenId);
    
    // Convert the update data to Firestore format
    const convertedData = tokenConverter.toFirestore({
      ...updateData,
    } as Token);

    // Update only the provided fields
    await tokenDocRef.set(convertedData, { merge: true });

    //console.log(`✅ Token ${tokenId} successfully updated.`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating token ${tokenId}:`, error);
    return false;
  }
}