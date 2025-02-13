import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { doc, getDoc } from "firebase/firestore";
import { connection } from "../connection";
import { db } from "../firebase/firebase";
import { PriceData, tokenConverter } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { TokenAccountData } from "./solanaUtils";

export interface AlarmConfig {
    standardAlarmPercentage: number;
    criticalAlarmPercentage: number;
  }
  
export type AlarmType = "normal" | "critical" | null 
  
export interface NotificationReturn {
    userId: string,
    token: string
    priceChange: number,
    alertType: AlarmType
    minutes: number
    alarmedConfig: AlarmConfig | null
    percentageBreached: number
}
  
const ALARM_CONFIGS = new Map<number, AlarmConfig>([
    [1, { standardAlarmPercentage: 50, criticalAlarmPercentage: 80}],
    [7, { standardAlarmPercentage: 60, criticalAlarmPercentage: 90}],
    [15, {standardAlarmPercentage: 70, criticalAlarmPercentage: 100}],
    [30, {standardAlarmPercentage: 80, criticalAlarmPercentage: 120}],
    [60, {standardAlarmPercentage: 90, criticalAlarmPercentage: 175}]
])

const ALARM_CONFIGS_MAX = new Map<number, AlarmConfig>([
    [1, { standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [7, { standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [15, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [30, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}],
    [60, {standardAlarmPercentage: 0, criticalAlarmPercentage: 0}]
])


const QUIETER_ALARM_CONFIGS = new Map<number, AlarmConfig>();
const NOISIER_ALARM_CONFIGS = new Map<number, AlarmConfig>();

ALARM_CONFIGS.forEach((config, key) => {
QUIETER_ALARM_CONFIGS.set(key, {
    standardAlarmPercentage: config.standardAlarmPercentage * 2,
    criticalAlarmPercentage: config.criticalAlarmPercentage * 2
});
});


ALARM_CONFIGS.forEach((config, key) => {
NOISIER_ALARM_CONFIGS.set(key, {
    standardAlarmPercentage: config.standardAlarmPercentage / 4,
    criticalAlarmPercentage: config.criticalAlarmPercentage / 4
});
});


export async function getLastHourPrices(token: string): Promise<PriceData[]> {
try {
    console.log("Getting last hour prices for token: " + token);

    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
    console.log("One hour ago (ms): " + oneHourAgo);

    const tokenDocRef = doc(db, "uniqueTokens", token).withConverter(tokenConverter);
    const tokenSnapshot = await getDoc(tokenDocRef);

    if (!tokenSnapshot.exists()) {
    console.warn(`⚠️ No document found for token: ${token}`);
    return [];
    }

    const tokenData = tokenSnapshot.data();

    if (!tokenData?.prices || !Array.isArray(tokenData.prices)) {
    console.warn(`⚠️ No price history found for token: ${token}`);
    return [];
    }

    // 🔹 Filter prices to only include last 60 minutes
    const lastHourPrices = tokenData.prices
    .filter((entry: PriceData) => entry.timestamp > oneHourAgo)
    .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

    console.log(`✅ Found ${lastHourPrices.length} price entries for token: ${token}`);
    return lastHourPrices;
} catch (error) {
    console.error(`❌ Error fetching prices for ${token}:`, error);
    return [];
}
}


export function getAlarmConfig(){
    // console.log("Using alarm config: ")
    // console.log(NOISIER_ALARM_CONFIGS)
    return ALARM_CONFIGS_MAX
}


// 🔹 Placeholder: Fetch Tokens Owned by User (Implement This Later)
export async function getTokensFromBlockchain(walletAddress: string): Promise<string[]> {
    const publicKey = new PublicKey(walletAddress);
    const tokenAccountsForAddress = await blockchainTaskQueue.addTask(() => connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })) 
    const tokensHeldByAddress = tokenAccountsForAddress.value.filter((val) => {
        const tokenAccountData: TokenAccountData = val.account.data.parsed
        if ((tokenAccountData.info.tokenAmount.uiAmount || 0) > 0) {
        return true
        } else {
        return false
        }
    }).map((val) => {
        const tokenAccountData: TokenAccountData = val.account.data.parsed
        return tokenAccountData.info.mint
    })
    return tokensHeldByAddress
    }

// 🔹 Check Price Change Percentage
export function calculatePriceChange(oldPrice: number, newPrice: number): number {
    return ((newPrice - oldPrice) / oldPrice) * 100;
}
