import { FirestoreDataConverter, Timestamp } from "firebase/firestore";

export interface SirenUser {
    uid: string;           // Firestore User ID (same as Firebase Auth UID)
    email?: string;
    wallets: string[];     // List of wallet addresses
    tokens?: string[];     // Optional FCM tokens for notifications
}

interface PriceData {
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

export const userConverter: FirestoreDataConverter<SirenUser> = {
    toFirestore(user: SirenUser) {
      return {
        uid: user.uid,
        email: user.email,
        wallets: user.wallets,
        tokens: user.tokens || [],
      };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        uid: snapshot.id,
        email: data?.email,
        wallets: data.wallets,
        tokens: data.tokens || [],
      };
    },
  };


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
  
