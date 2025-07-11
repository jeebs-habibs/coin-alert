import { SirenUser } from "../../../../../shared/types/user";

const SEVEN_DAYS_MS = 1000*60*60*24*7

export function isUserActive(sirenUser: SirenUser){
    if((sirenUser.tier == "free-trial" && (Date.now() - (sirenUser?.createdAtTimestampMs || 0)) < SEVEN_DAYS_MS)){
        console.log("Tracking user " + sirenUser.uid + " with free tier created on " + new Date(sirenUser?.createdAtTimestampMs || 0).toLocaleDateString() + " with subscription end of " + new Date((sirenUser?.createdAtTimestampMs || 0) + SEVEN_DAYS_MS).toLocaleDateString())
        return true
    }
    if((sirenUser.tier == "pro" && (sirenUser?.subscriptionEndTimesampMs || 0) > Date.now())){
        console.log("Tracking user " + sirenUser.uid + " with pro tier created on " + new Date(sirenUser?.createdAtTimestampMs || 0).toLocaleDateString() + " with subscription end of " + new Date(sirenUser?.subscriptionEndTimesampMs || 0).toLocaleDateString())
        return true
    }
    console.warn("NOT tracking user " + sirenUser.uid + " with tier: " + sirenUser.tier + " created on " + new Date(sirenUser?.createdAtTimestampMs || 0).toLocaleDateString() + " with subscription end of " + new Date(sirenUser?.subscriptionEndTimesampMs || 0).toLocaleDateString())
    return false
}