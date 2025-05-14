import { web3 } from "@coral-xyz/anchor";
import { TokenAmount } from "@solana/web3.js";

export const BILLION = 1000000000

export interface TokenAccountData {
    info: TokenAccountInfo
    "type": string;
}

export interface PoolData {
  quoteVault: web3.PublicKey;
  baseVault: web3.PublicKey;
  baseMint: web3.PublicKey;
  quoteMint: web3.PublicKey;
  pubKey: web3.PublicKey;
  quoteLpVault?: web3.PublicKey;
  baseLpVault?: web3.PublicKey;
}

export interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: TokenAmount;
}
