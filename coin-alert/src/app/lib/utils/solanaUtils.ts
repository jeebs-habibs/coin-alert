import { web3 } from "@coral-xyz/anchor";
import { PublicKey, TokenAmount } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse, PoolType } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";

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
}
export interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: TokenAmount;
}

export function shortenString(input: string): string {
    if (input.length <= 6) {
      return input; // Return the original string if it's too short
    }
    return `${input.slice(0, 3)}...${input.slice(-3)}`;
  }

export function areStringListsEqual(list1: string[], list2: string[]): boolean {
    if (list1.length !== list2.length) return false;
  
    const sortedList1 = [...list1].sort();
    const sortedList2 = [...list2].sort();
  
    return sortedList1.every((value, index) => value === sortedList2[index]);
  }

  
async function getTokenAccountBalance(accountPubkey: PublicKey): Promise<number | null> {
    const account = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(accountPubkey))
    return account.value.uiAmount

}

export async function calculateTokenPrice(token: string, poolData: PoolData, poolType: PoolType): Promise<GetPriceResponse | undefined> {
    if (!poolData?.baseVault || !poolData?.quoteVault || !poolData?.baseMint) {
      console.log(`ERROR: Insufficient token data for ${poolType} price calculation for token: ${token}`);
      return undefined;
    }

    if(!poolData?.quoteVault){
      return undefined
    }
  
    const baseBalance = await getTokenAccountBalance(new PublicKey(poolData?.baseVault))
    const quoteBalance = await getTokenAccountBalance(new PublicKey(poolData?.quoteVault))
    if (baseBalance == null || quoteBalance == null) {
      console.error(`Failed to fetch balances for ${poolType} token: ${token}`);
      return undefined;
    }
  
    let price = 0;
    if (quoteBalance !== 0 && baseBalance !== 0) {
      price = poolData.baseMint.toString() === token ? (quoteBalance / baseBalance) : (baseBalance / quoteBalance);
    }
  
    if (price) {
      return {
        price: {
          price,
          marketCapSol: BILLION * price,
          timestamp: new Date().getTime(),
          pool: poolType,
        },
        tokenData: { pool: poolType },
      };
    } else {
      console.error(`No ${poolType} price data found for token: ${token}`);
      return undefined;
    }
  }