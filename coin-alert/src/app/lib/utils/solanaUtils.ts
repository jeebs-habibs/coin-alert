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

  