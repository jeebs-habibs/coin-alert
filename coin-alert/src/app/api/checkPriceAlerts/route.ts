import { AlarmConfig } from "@/app/lib/constants/alarmConstants";
import { getAllUsers } from "@/app/lib/firebase/userUtils";
import { getRedisClient } from "@/app/lib/redis";
import { getTokenPricesCached } from "@/app/lib/redis/prices";
import { getTokenCached } from "@/app/lib/redis/tokens";
import { storeTokenPercentChange } from "@/app/lib/redis/trending";
import { getCryptoPrice } from "@/app/lib/utils/cryptoPrice";
import { calculatePriceChange, getAlarmConfig, NotificationReturn } from "@/app/lib/utils/priceAlertHelper";
import { isUserActive } from "@/app/lib/utils/subscription";
import chalk from "chalk";
import { NextRequest } from "next/server";
import { PriceData, Token } from "../../../../../shared/types/token";
import { RecentNotification, SirenUser } from "../../../../../shared/types/user";
import { sendNotification } from "../../lib/sendNotifications"; // Push notification logic

const tokensCache: Map<string, Token> = new Map<string, Token>()
const pricesCache: Map<string, PriceData[]> = new Map<string, PriceData[]>()

// Metrics
let numberOfNotisSkipped = 0
let totalNumberOfTokensGottenFromDB = 0
let totalNumberOfTokensGottenFromCache = 0
let totalNumberOfUsers = 0
let totalUsersSkipped = 0
//let totalNumberOfDeadTokens = 0
let totalNotisSent = 0
let nonZeroPriceChanges = 0 
let numberOfTokensNoPriceEntryForMinute = 0
let numberOfTokensWithPriceEntry = 0 
/**
 * Checks if the last notification for a given token and minute interval is older than the cooldown period.
 * @param token - The token symbol or ID
 * @param minutes - The cooldown period in minutes
 * @param recentNotificationsObj - The user's recent notifications object (Firestore format)
 * @returns true if the last notification was sent more than `minutes` ago, otherwise false
 */
function isTokenMinuteAfterCooldown(
  token: string,
  minutes: number,
  recentNotificationsObj: Record<string, RecentNotification>
): boolean {
  // 🔹 Convert nested Firestore object properly
  const recentNotifications = new Map<string, RecentNotification>();
  let mostRecentNotification: RecentNotification | undefined = undefined

  for (const [key, value] of Object.entries(recentNotificationsObj)) {
    if (value && typeof value === "object") {
      //console.log("setting a val in recentnotfs")
      recentNotifications.set(key, { ...value }); // Ensure deep copy
      if(key.split("_")[0] == token && (!mostRecentNotification || (mostRecentNotification && value.timestamp >= mostRecentNotification.timestamp))){
        mostRecentNotification = value
      }
    } else {
      //console.error(`❌ Skipping invalid entry in recentNotificationsObj:`, key, value);
    }
  }
  const key = `${token}_${minutes}`; // 🔹 Construct key in format "token_minutes"

  
  const lastNotification = recentNotifications.get(key);
  if (!lastNotification) return true; // ✅ No notification exists, so it's after cooldown

  const now = Date.now();
  const lastNotificationTime = lastNotification.timestamp;
  const elapsedTime = (now - lastNotificationTime) / (60 * 1000); // Convert to minutes

  const is10MinsSinceLastNotiForToken = !mostRecentNotification?.timestamp ? true : (now - mostRecentNotification.timestamp) >= (1000 * 60 * 5)

  return (elapsedTime > minutes) || is10MinsSinceLastNotiForToken; // ✅ Return true if notification is older than cooldown
}

function getLastPriceBeforeTimestamp(
  timestamp: number,
  prices: PriceData[]
): PriceData | undefined {
  // Iterate backwards since the list is sorted from oldest to newest
  for (let i = prices.length - 1; i >= 0; i--) {
    if (prices[i].timestamp < timestamp) {
      return prices[i];
    }
  }
  return undefined; // No price older than the given timestamp
}

// 🔹 Main API Function
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  const startTime = Date.now()

  try {

    //console.log("🔄 Checking price alerts for users...");

    const usersSnapshot = await getAllUsers();
    const usersToNotify = usersSnapshot.filter((sirenUser) => {
      return isUserActive(sirenUser)
    })
    const notificationsToSend: (NotificationReturn | null)[] = [];
    const redisClient = await getRedisClient()

    let solPriceUsd = undefined
    if(usersToNotify.length){
      const solPrice = await getCryptoPrice("SOL")
      if(solPrice){
        solPriceUsd = solPrice.priceUsd
      }
    }

    // 🔹 1️⃣ Process All Users in Parallel
    const userPromises = usersToNotify.map(async (user: SirenUser) => {
      totalNumberOfUsers++

      // Skip users with no wallets or with notis turned off
      if (!user.userWallets || !Array.isArray(user.userWallets) || !user.isNotificationsOn){
        totalUsersSkipped++ 
        return
      }

      //console.log(`👤 Checking tokens for user: ${JSON.stringify(user)} (${user.wallets.join(",")})`);

      // 🔹 2️⃣ Get All Tokens Owned by User (via Blockchain) in Parallel
      // const allTokensSet = new Set<string>();
      // const tokenPromises = user.wallets.map(async (wallet) => {
      //   totalNumberOfWallets++
      //   const walletPubkey = new PublicKey(wallet)
      //   const tokenAccountsForAddress = await blockchainTaskQueue.addTask(() => connection.getParsedTokenAccountsByOwner(walletPubkey, { programId: TOKEN_PROGRAM_ID }));

      //   console.log("Address " + wallet + " has " + tokenAccountsForAddress.value.length + " unique tokens held")
      //   tokenAccountsForAddress.value.forEach((value) => {
      //     const tokenAccountData: TokenAccountData = value.account.data.parsed;
      //     if ((tokenAccountData.info.tokenAmount.uiAmount || 0) > 50 && isValidMint(tokenAccountData.info.mint)) {
      //       console.log(`Wallet ${wallet} has ${tokenAccountData.info.tokenAmount.uiAmount} of ${tokenAccountData.info.mint} Adding to unique set`)
      //       allTokensSet.add(tokenAccountData.info.mint);
      //     }
      //   })

      // });

      const trackedTokensForUser = user?.trackedTokens?.filter((token) => token.isNotificationsOn)?.map((token) => token.mint) || []

      console.log("Checking prices for user: " + user.uid + " and maybe sending notis for tokens: " + trackedTokensForUser.join(","))

      // await Promise.all(tokenPromises);
      // const allTokens = Array.from(allTokensSet);

      // 🔹 3️⃣ Check Price Changes for Each Token in Parallel
      const tokenPricePromises: Promise<NotificationReturn | null>[] = trackedTokensForUser.map(async (token) => {
        if(token == "HZju4Hc1dmK3d1b8Vz4DXDiPiHcUu9vZQiqUT8RDpump" || token == "BmMu5Mtuf3gsG8tX9qwdrFEpCa7JiAQpFncaMpa5pump"){
          console.log("Checking price for user " + user.uid + " and token " + token)
        }
        const tokenObj = await getTokenCached(token, tokensCache, redisClient)
        if(tokenObj[1] == "db"){
          totalNumberOfTokensGottenFromDB++
        }
        if(tokenObj[1] == "cache"){
          totalNumberOfTokensGottenFromCache++
        }
        // const isTokenDead = await setTokenDead(token, redisClient)
        // if(isTokenDead){
        //   return null
        // }
        const priceHistory = (await getTokenPricesCached(token, pricesCache, redisClient)) || [];
        if(token == "HZju4Hc1dmK3d1b8Vz4DXDiPiHcUu9vZQiqUT8RDpump" || token == "BmMu5Mtuf3gsG8tX9qwdrFEpCa7JiAQpFncaMpa5pump"){
          console.log("Price history for token " + token)
          console.log(JSON.stringify(priceHistory))
        }

        // console.log("Price history: ")
        // priceHistory.forEach((p) => {
        //   console.log("Price: " + p.price)
        //   console.log("Timestamp: " + p.timestamp)
        // })
        // if (priceHistory.length < 10){
        //   //console.error("Not enough price history to send notifications.")
        //   return null; // Skip if not enough data
        // } 
        const mostRecentPriceData: PriceData = priceHistory[priceHistory.length - 1]
        const latestPrice = mostRecentPriceData?.price;
        const latestPriceMarketCapUsd = mostRecentPriceData?.marketCapSol && solPriceUsd ? mostRecentPriceData.marketCapSol * solPriceUsd : undefined
        let alertType: "normal" | "critical" | null = null;
        let alarmedConfig: AlarmConfig | null = null
        const minuteToAlarmConfig = getAlarmConfig(user.alarmPreset)
        let percentChange = 0
        let minutes = 0
        let percentageBreached = 0

        for (const config of minuteToAlarmConfig) {
          const nowMinusMinutesMillis = Date.now() - config[0] * 60 * 1000
          const oldPriceEntry = getLastPriceBeforeTimestamp(nowMinusMinutesMillis, priceHistory)

          if(token == "HZju4Hc1dmK3d1b8Vz4DXDiPiHcUu9vZQiqUT8RDpump" || token == "BmMu5Mtuf3gsG8tX9qwdrFEpCa7JiAQpFncaMpa5pump"){
            console.log(`Old price: ${oldPriceEntry?.price} and latest price ${latestPrice} for token ${token}`)
          }
          if (!oldPriceEntry) {
            numberOfTokensNoPriceEntryForMinute++
            continue;
          } else {
            numberOfTokensWithPriceEntry++
          }

          // If token_minute got alarmed within minute threshold, skip
          if(!isTokenMinuteAfterCooldown(token, config[0], user.recentNotifications || {})){
            console.warn("Skipping token due to cooldown")
            numberOfNotisSkipped++
            continue;
          }

          // console.log("Old price entry: " + oldPriceEntry.price)
          // console.log("Latest price: " + latestPrice)

          const priceChange = calculatePriceChange(oldPriceEntry.price, latestPrice);
          if(config[0] == 60){
            await storeTokenPercentChange(token, priceChange, redisClient)
          }
          if(priceChange != 0){
            nonZeroPriceChanges++
            console.log(`📊 ${token} change over ${config[0]} mins: ${priceChange.toFixed(2)}%`);
          } else {
            //console.warn("Token " + token + " has not changed in price over " + config[0] + " minutes.")
          }

          // 🔹 5️⃣ If Change > 50%, Send Critical Alert
          if (priceChange > config[1].criticalAlarmPercentage || priceChange < (config[1].criticalAlarmPercentage * -1)) {
            //console.log("Critical alert. Price changed "  + priceChange + " %, which is over/under threshold of " + config[1].criticalAlarmPercentage)
            alertType = "critical";
            alarmedConfig = config[1]
            percentChange = priceChange
            minutes = config[0]
            percentageBreached = config[1].criticalAlarmPercentage
            break;
          }

          // 🔹 4️⃣ If Change > 10%, Send Normal Alert
          if (priceChange > config[1].standardAlarmPercentage || priceChange < (config[1].standardAlarmPercentage * -1)) {
            //console.log("Normal alert. Price changed "  + priceChange + " %, which is over/under threshold of " + config[1].standardAlarmPercentage)
            alertType = "normal";
            alarmedConfig = config[1]
            percentChange = priceChange
            minutes = config[0]
            percentageBreached = config[1].standardAlarmPercentage
            break;
          }

 
        }

        // 🔹 6️⃣ Queue Notification if Needed
        if (alertType) {
          const notification: NotificationReturn = {
            userId: user.uid,
            token,
            priceChange: percentChange,
            alertType,
            minutes,
            alarmedConfig,
            percentageBreached: percentageBreached,
            marketCapUsd: latestPriceMarketCapUsd
          };
          return notification
        }
        return null;
      });

      // Collect valid notifications
      const userNotifications = (await Promise.all(tokenPricePromises)).filter(Boolean);
      notificationsToSend.push(...userNotifications);
    });

    // 🔹 7️⃣ Wait for all users to be processed
    await Promise.all(userPromises);

    // 🔹 8️⃣ Send Notifications in Bulk
    await Promise.all(
      notificationsToSend.map(async (notification) => {
        if (notification != null) {
          totalNotisSent++;
          try {
            // Send the notification
            await sendNotification(
              notification.userId,
              notification.token,
              notification.priceChange,
              notification.alertType,
              notification.minutes,
              notification.percentageBreached,
              tokensCache.get(notification.token),
              notification?.marketCapUsd
            );
          } catch (error) {
            console.error(`Failed to send notification for user ${notification.userId}:`, error);
          }
        }
      })
    );

    await redisClient.quit()

    const endTime = Date.now()
    const timeInSeconds = (endTime - startTime) / 1000
    const metrics = `
      time = ${timeInSeconds} seconds
      numberOfNotisSkipped = ${numberOfNotisSkipped}
      totalNumberOfTokensGottenFromDB = ${totalNumberOfTokensGottenFromDB}
      totalNumberOfTokensGottenFromCache = ${totalNumberOfTokensGottenFromCache}
      totalNumberOfUsers = ${totalNumberOfUsers}
      totalNotisSent = ${totalNotisSent}
      totalUsersSkipped = ${totalUsersSkipped}
      nonZeroPriceChanges = ${nonZeroPriceChanges}
      numberOfTokensNoPriceEntryForMinute = ${numberOfTokensNoPriceEntryForMinute}
      numberOfTokensWithPriceEntry = ${numberOfTokensWithPriceEntry}
    `
    console.log(chalk.green("API METRICS \n" + metrics))
    return new Response(JSON.stringify({ message: "Alerts checked successfully in " + timeInSeconds + " seconds. \n ======Metrics===== \n " + metrics }), { status: 200 });
  } catch (error) {
    console.error("❌ Error checking price alerts:", error);
    const e = error as Error
    console.error("Full stack trace: " + e.stack)
  
    return new Response(JSON.stringify({ error: "Failed to check alerts: " + error }), { status: 500 });
  }
}