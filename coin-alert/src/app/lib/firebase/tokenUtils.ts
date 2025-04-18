import { FirestoreDataConverter, Timestamp } from "firebase/firestore";
import { adminDB } from "./firebaseAdmin";

export interface PriceData {
    price: number;
    timestamp: number;
    signatures?: string[];
}

export type PoolType = "pump" | "raydium" | "pump-swap"

export interface TokenMetadata {
  symbol: string;
  name: string;
  uri: string
}

export interface TokenData {
  pool?: PoolType
  baseVault?: string;
  baseMint?: string;
  quoteVault?: string;
  quoteMint?: string;
  marketPoolId?: string;
  tokenMetadata?: TokenMetadata;
}

export interface GetPriceResponse {
  price: PriceData;
  tokenData: TokenData;
  err?: string;
}

export interface Token {
    lastUpdated?: Date;
    prices?: PriceData[];
    tokenData?: TokenData;
    isDead?: boolean;
}

export async function getTokenCached(token: string, tokenCache: Map<string, Token>): Promise<[Token | undefined, string]> {
  if(tokenCache.has(token)){
    return [tokenCache.get(token), "cache"]
  } 
  const tokenDb = await getToken(token)
  if(tokenDb){
    tokenCache.set(token, tokenDb)
    return [tokenDb, "db"]
  }
  return [undefined, "not_found"]

}


export async function setTokenDead(token: string, tokenDb: Token | undefined): Promise<boolean> {
  try {
    if (!tokenDb || !tokenDb.prices || tokenDb.prices.length < 2) {
      console.log(`🔹 Not enough price data to determine if ${token} is dead.`);
      return false;
    }

    const prices = tokenDb.prices;
    const fortyFiveMinMs = 45 * 60 * 1000;

    // 🔹 Check if any two price entries are more than 45 minutes apart and identical
    for (let i = 0; i < prices.length - 1; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const timeDifference = Math.abs(prices[j].timestamp - prices[i].timestamp);
        if (timeDifference > fortyFiveMinMs && prices[i].price === prices[j].price) {
          console.log(`💀 Token ${token} detected as dead (same price > 45 min apart). Marking as dead...`);

          // 🔹 Update Firestore to mark the token as dead
          const tokenDocRef = adminDB.collection("uniqueTokens").doc(token)
          await tokenDocRef.update({ isDead: true });

          console.log(`✅ Token ${token} successfully marked as dead.`);
          return true;
        }
      }
    }

    console.log(`🔹 Token ${token} is still active.`);
    return false;
  } catch (error) {
    console.error(`❌ Error marking token ${token} as dead:`, error);
    return false;
  }
}

export const tokenConverter: FirestoreDataConverter<Token> = {
    toFirestore(token: Token) {
      return {
        lastUpdated: token.lastUpdated instanceof Date ? token.lastUpdated.getTime() : token.lastUpdated,
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
        lastUpdated: typeof data.lastUpdated === "number" ? new Date(data.lastUpdated) : (data.lastUpdated as Timestamp).toDate(),
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
