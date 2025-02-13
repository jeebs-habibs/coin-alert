import { connection } from "@/app/lib/connection";
import { PriceData, tokenConverter } from "@/app/lib/firebase/tokenUtils";
import { getAllUsers, SirenUser } from "@/app/lib/firebase/userUtils";
import { blockchainTaskQueue } from "@/app/lib/taskQueue";
import { TokenAccountData } from "@/app/lib/utils/solanaUtils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { sendNotification } from "../../lib/sendNotifications"; // Push notification logic


export interface AlarmConfig {
  standardAlarmPercentage: number;
  criticalAlarmPercentage: number;
}

export type AlarmType = "normal" | "critical" | null 

interface NotificationReturn {
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

console.log("Noisey configs: " + NOISIER_ALARM_CONFIGS)



async function getLastHourPrices(token: string): Promise<PriceData[]> {
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


function getAlarmConfig(){
  // console.log("Using alarm config: ")
  // console.log(NOISIER_ALARM_CONFIGS)
  return NOISIER_ALARM_CONFIGS
}


// 🔹 Placeholder: Fetch Tokens Owned by User (Implement This Later)
async function getTokensFromBlockchain(walletAddress: string): Promise<string[]> {
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
function calculatePriceChange(oldPrice: number, newPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

// 🔹 Main API Function
export async function GET(req: Request) {
  const apiKey = req.headers.get("Authorization");
  console.log("API KEY:" + apiKey)

  if (apiKey !== process.env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }

  try {
    console.log("🔄 Checking price alerts for users...");

    const usersSnapshot = await getAllUsers();
    const notificationsToSend: (NotificationReturn | null)[] = [];

    // 🔹 1️⃣ Process All Users in Parallel
    const userPromises = usersSnapshot.map(async (user: SirenUser) => {
      if (!user.wallets || !Array.isArray(user.wallets)) return; // Skip users with no wallets

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
        const minuteToAlarmConfig = getAlarmConfig()
        let percentChange = 0
        let minutes = 0
        let percentageBreached = 0

        for (const config of minuteToAlarmConfig) {
          const oldPriceEntry = priceHistory.find(
            (entry) => entry.timestamp <= Date.now() - config[0] * 60 * 1000
          );
          if (!oldPriceEntry) continue;

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
    return new Response(JSON.stringify({ error: "Failed to check alerts" }), { status: 500 });
  }
}
