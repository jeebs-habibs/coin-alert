import { AlarmConfig, AlarmType, NOISIER_ALARM_CONFIGS, STANDARD_ALARM_CONFIGS } from "../constants/alarmConstants";
import { PriceData, Token } from "../firebase/tokenUtils";
import { AlarmPreset } from "../firebase/userUtils";

export interface NotificationReturn {
    userId: string,
    token: string
    priceChange: number,
    alertType: AlarmType
    minutes: number
    alarmedConfig: AlarmConfig | null
    percentageBreached: number,
    marketCapUsd?: number;
}

export function getLastHourPrices(token: Token | undefined): PriceData[] {
    try {
        if(!token){
            return []
        }
        const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds

        if (!token?.prices || !Array.isArray(token.prices)) {
        console.warn(`⚠️ No price history found for token`);
        return [];
        }

        // 🔹 Filter prices to only include last 60 minutes
        const lastHourPrices = token.prices
        .filter((entry: PriceData) => entry.timestamp > oneHourAgo)
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

        //console.log(`✅ Found ${lastHourPrices.length} price entries for token: ${tokenMint}`);
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

// 🔹 Check Price Change Percentage
export function calculatePriceChange(oldPrice: number, newPrice: number): number {
    return ((newPrice - oldPrice) / oldPrice) * 100;
}

