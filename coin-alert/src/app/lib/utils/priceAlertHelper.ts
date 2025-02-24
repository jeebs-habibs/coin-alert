import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { AlarmConfig, AlarmType, NOISIER_ALARM_CONFIGS, STANDARD_ALARM_CONFIGS } from "../constants/alarmConstants";
import { PriceData, Token } from "../firebase/tokenUtils";
import { AlarmPreset } from "../firebase/userUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { TokenAccountData } from "./solanaUtils";

export interface NotificationReturn {
    userId: string,
    token: string
    priceChange: number,
    alertType: AlarmType
    minutes: number
    alarmedConfig: AlarmConfig | null
    percentageBreached: number
}

export async function getLastHourPrices(token: Token | undefined): Promise<PriceData[]> {
    try {
        if(!token){
            return []
        }
        const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
        console.log("One hour ago (ms): " + oneHourAgo);

        if (!token?.prices || !Array.isArray(token.prices)) {
        console.warn(`⚠️ No price history found for token`);
        return [];
        }

        // 🔹 Filter prices to only include last 60 minutes
        const lastHourPrices = token.prices
        .filter((entry: PriceData) => entry.timestamp > oneHourAgo)
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

        console.log(`✅ Found ${lastHourPrices.length} price entries for token: ${token}`);
        return lastHourPrices;
    } catch (error) {
        console.error(`❌ Error fetching prices for ${token}:`, error);
        return [];
    }
}


export function getAlarmConfig(alarmPreset: AlarmPreset){
    // console.log("Using alarm config: ")
    // console.log(NOISIER_ALARM_CONFIGS)
    // if(userId == "D7gDyfspTANknhFTJwYlCEM9NLW2"){
    //     return ALARM_CONFIGS_MAX
    // }
    if(alarmPreset == "left"){
        return NOISIER_ALARM_CONFIGS
    } 
    if(alarmPreset == "center"){
        return STANDARD_ALARM_CONFIGS
    }
    if(alarmPreset == "right"){
        return NOISIER_ALARM_CONFIGS
    }
    return STANDARD_ALARM_CONFIGS
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

