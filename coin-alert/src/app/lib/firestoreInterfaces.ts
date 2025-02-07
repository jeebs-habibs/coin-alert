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


export interface Token {
    lastUpdated: Date;
    pool: PoolType;
    prices: PriceData[];
    baseVault: string;
    baseMint: string;
    quoteVault: string;
    quoteMint: string;
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
        pool: token.pool,
        prices: token.prices.map((price) => ({
          timestamp: price.timestamp,
          price: price.price,
        })),
        baseVault: token.baseVault,
        quoteVault: token.quoteVault,
      };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        lastUpdated: typeof data.lastUpdated === "number" ? new Date(data.lastUpdated) : (data.lastUpdated as Timestamp).toDate(),
        pool: data.pool as PoolType,
        prices: data.prices.map((price: any) => ({
          timestamp: typeof price.timestamp === "number" ? price.timestamp : (price.timestamp as Timestamp).toMillis(),
          price: price.price,
        })) as PriceData[],
        baseVault: data.baseVault,
        quoteVault: data.quoteVault,
      };
    },
  };
  
