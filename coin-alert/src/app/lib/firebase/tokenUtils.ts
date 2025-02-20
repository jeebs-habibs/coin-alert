import { doc, FirestoreDataConverter, getDoc, Timestamp } from "firebase/firestore";
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
