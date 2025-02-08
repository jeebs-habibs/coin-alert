import { TokenAmount } from "@solana/web3.js";

export interface TokenAccountData {
    info: TokenAccountInfo
    "type": string;
}

export interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: TokenAmount;
}