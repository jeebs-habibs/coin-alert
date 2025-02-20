import { AlarmConfig } from "@/app/lib/constants/alarmConstants";
import { getAllUsers, RecentNotification, SirenUser } from "@/app/lib/firebase/userUtils";
import { calculatePriceChange, getAlarmConfig, getLastHourPrices, getTokensFromBlockchain, NotificationReturn } from "@/app/lib/utils/priceAlertHelper";
import { sendNotification } from "../../lib/sendNotifications"; // Push notification logic
import { getToken } from "@/app/lib/firebase/tokenUtils";

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

  for (const [key, value] of Object.entries(recentNotificationsObj)) {
    if (value && typeof value === "object") {
      //console.log("setting a val in recentnotfs")
      recentNotifications.set(key, { ...value }); // Ensure deep copy
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

  return elapsedTime > minutes; // ✅ Return true if notification is older than cooldown
}



// 🔹 Main API Function
export async function GET(req: Request) {
  const apiKey = req.headers.get("Authorization");

  if (apiKey !== process.env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  try {
    console.log("🔄 Checking price alerts for users...");

    const usersSnapshot = await getAllUsers();
    const notificationsToSend: (NotificationReturn | null)[] = [];

    // 🔹 1️⃣ Process All Users in Parallel
    const userPromises = usersSnapshot.map(async (user: SirenUser) => {
      if (!user.wallets || !Array.isArray(user.wallets) || !user.isNotificationsOn) return; // Skip users with no wallets or with notis turned off

      console.log(`👤 Checking tokens for user: ${user.uid} (${user.wallets.join(",")})`);

      // 🔹 2️⃣ Get All Tokens Owned by User (via Blockchain) in Parallel
      const allTokensSet = new Set<string>();
      const tokenPromises = user.wallets.map(async (wallet) => {
        const tokens = await getTokensFromBlockchain(wallet);
        console.log("Address " + wallet + " has " + tokens.length + " unique tokens held")
        tokens.forEach((token) => allTokensSet.add(token));
      });

      await Promise.all(tokenPromises);
      const allTokens = Array.from(allTokensSet);

      // 🔹 3️⃣ Check Price Changes for Each Token in Parallel
      const tokenPricePromises: Promise<NotificationReturn | null>[] = allTokens.map(async (token) => {
        console.log("Getting price history for token: " + token)
        const priceHistory = await getLastHourPrices(token);
        // console.log("Price history: ")
        // priceHistory.forEach((p) => {
        //   console.log("Price: " + p.price)
        //   console.log("Timestamp: " + p.timestamp)
        // })
        // if (priceHistory.length < 10){
        //   console.error("Not enough price history to send notifications.")
        //   return null; // Skip if not enough data
        // } 

        const latestPrice = priceHistory[0]?.price;
        let alertType: "normal" | "critical" | null = null;
        let alarmedConfig: AlarmConfig | null = null
        const minuteToAlarmConfig = getAlarmConfig(user.alarmPreset)
        let percentChange = 0
        let minutes = 0
        let percentageBreached = 0

        for (const config of minuteToAlarmConfig) {
          const oldPriceEntry = priceHistory.find(
            (entry) => entry.timestamp <= Date.now() - config[0] * 60 * 1000
          );
          if (!oldPriceEntry) continue;

          // If token_minute got alarmed within minute threshold, skip
          if(!isTokenMinuteAfterCooldown(token, config[0], user.recentNotifications || {})){
            console.warn(`Skipping noti for token ${token}, user ${user.uid}, minute ${config[0]}`)
            continue;
          } else {
            console.log(`No recent noti detected for token ${token}, user ${user.uid} minute: ${config[0]}`)
          }

          const priceChange = calculatePriceChange(oldPriceEntry.price, latestPrice);
          console.log(`📊 ${token} change over ${config[0]} mins: ${priceChange.toFixed(2)}%`);

          // 🔹 5️⃣ If Change > 50%, Send Critical Alert
          if (priceChange > config[1].criticalAlarmPercentage || priceChange < (config[1].criticalAlarmPercentage * -1)) {
            console.log("Critical alert. Price changed "  + priceChange + " %, which is over/under threshold of " + config[1].criticalAlarmPercentage)
            alertType = "critical";
            alarmedConfig = config[1]
            percentChange = priceChange
            minutes = config[0]
            percentageBreached = config[1].criticalAlarmPercentage
            break;
          }

          // 🔹 4️⃣ If Change > 10%, Send Normal Alert
          if (priceChange > config[1].standardAlarmPercentage || priceChange < (config[1].standardAlarmPercentage * -1)) {
            console.log("Normal alert. Price changed "  + priceChange + " %, which is over/under threshold of " + config[1].standardAlarmPercentage)
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
            percentageBreached: percentageBreached
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
      notificationsToSend.map((notification) => {
        if(notification != null){
          sendNotification(notification.userId, notification.token, notification.priceChange, notification.alertType, notification.minutes, notification.percentageBreached)
        }
      })
    );

    console.log("✅ Price alerts processed.");
    return new Response(JSON.stringify({ message: "Alerts checked successfully" }), { status: 200 });
  } catch (error) {
    console.error("❌ Error checking price alerts:", error);
    return new Response(JSON.stringify({ error: "Failed to check alerts: " + error }), { status: 500 });
  }
}