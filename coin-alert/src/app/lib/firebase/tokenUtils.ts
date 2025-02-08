import { db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { FirestoreDataConverter, Timestamp } from "firebase/firestore";

export interface PriceData {
    price: number;
    timestamp: number;
    signatures?: string[];
}

export type PoolType = "pump" | "raydium"

export interface TokenData {
  pool?: PoolType
  baseVault?: string;
  baseMint?: string;
  quoteVault?: string;
  quoteMint?: string;
  marketPoolId?: string;
}

export interface GetPriceResponse {
  price: PriceData;
  tokenData: TokenData;
}

export interface Token {
    lastUpdated?: Date;
    prices?: PriceData[];
    tokenData?: TokenData;
}

const tokenConverter: FirestoreDataConverter<Token> = {
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
