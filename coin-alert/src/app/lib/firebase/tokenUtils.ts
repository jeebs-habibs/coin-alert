import { deleteDoc, doc, FirestoreDataConverter, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface PriceData {
    price: number;
    timestamp: number;
    signatures?: string[];
}

export type PoolType = "pump" | "raydium"

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
}

export async function getTokenCached(token: string, tokenCache: Map<string, Token>){
  if(tokenCache.has(token)){
    return tokenCache.get(token)
  } 
  const tokenDb = await getToken(token)
  if(tokenDb){
    tokenCache.set(token, tokenDb)
    return tokenDb
  }

}


export async function removeTokenIfDead(token: string, tokenDb: Token | undefined): Promise<boolean> {
  try {
    if (!tokenDb || !tokenDb.prices || tokenDb.prices.length < 2) {
      console.log(`🔹 Not enough price data to determine if ${token} is dead.`);
      return false;
    }

    const prices = tokenDb.prices;
    const oneHourMs = 60 * 60 * 1000;

    // 🔹 Check if any two price entries are more than 60 minutes apart and identical
    for (let i = 0; i < prices.length - 1; i++) {
      for (let j = i + 1; j < prices.length; j++) {
        const timeDifference = Math.abs(prices[j].timestamp - prices[i].timestamp);
        if (timeDifference > oneHourMs && prices[i].price === prices[j].price) {
          console.log(`💀 Token ${token} detected as dead (same price > 60 min apart). Removing...`);

          // 🔹 Remove the token from Firestore
          const tokenDocRef = doc(db, "uniqueTokens", token);
          await deleteDoc(tokenDocRef);
          console.log(`✅ Token ${token} successfully removed from Firestore.`);
          return true;
        }
      }
    }

    console.log(`🔹 Token ${token} is still active.`);
    return false;
  } catch (error) {
    console.error(`❌ Error removing dead token ${token}:`, error);
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
        tokenData: token?.tokenData
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
        tokenData: data?.tokenData
      };
    },
  };
  


// 🔹 Fetch a Token from Firestore
export async function getToken(tokenId: string): Promise<Token | undefined> {
  try {
    const tokenDocRef = doc(db, "uniqueTokens", tokenId).withConverter(tokenConverter);
    const tokenSnapshot = await getDoc(tokenDocRef);

    if (tokenSnapshot.exists()) {
      return tokenSnapshot.data(); // ✅ Typed as Token
    }
    
    return undefined;
  } catch (error) {
    console.error(`❌ Error fetching token ${tokenId}:`, error);
    return undefined;
  }
}
