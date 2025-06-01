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