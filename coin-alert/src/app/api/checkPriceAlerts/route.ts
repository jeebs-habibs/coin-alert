import { connection } from "@/app/lib/connection";
import { PriceData, tokenConverter } from "@/app/lib/firebase/tokenUtils";
import { getAllUsers } from "@/app/lib/firebase/userUtils";
import { blockchainTaskQueue } from "@/app/lib/taskQueue";
import { TokenAccountData } from "@/app/lib/utils/solanaUtils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { collection, doc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { sendNotification } from "../../lib/sendNotifications"; // Push notification logic

interface AlarmCriteria {
  percentChange: number;
  minutes: number;
}

interface AlarmConfig {
  standardAlarm: AlarmCriteria;
  criticalAlarm: AlarmCriteria;
}

async function getLastHourPrices(token: string) {
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
  
      const tokenDocRef = doc(db, "uniqueTokens", token).withConverter(tokenConverter);
      const pricesCollectionRef = collection(tokenDocRef, "prices"); // Fetch from subcollection
  
      const pricesQuery = query(
        pricesCollectionRef,
        where("timestamp", ">", oneHourAgo), // Only last 60 mins
        orderBy("timestamp", "desc") // Most recent first
      );
  
      const querySnapshot = await getDocs(pricesQuery);
      const prices = querySnapshot.docs.map((doc) => {
        const docData = doc.data()
        const priceObj: PriceData = {
          price: docData.price,
          timestamp: docData.timestamp,
        }
        return priceObj
      });  
      return prices;
    } catch (error) {
      console.error(`❌ Error fetching prices for ${token}:`, error);
      return [];
    }
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
export async function GET() {
  try {
    console.log("🔄 Checking price alerts for users...");

    const usersSnapshot = await getAllUsers();
    const notificationsToSend: any[] = [];

    // 🔹 1️⃣ Process All Users in Parallel
    const userPromises = usersSnapshot.map(async (user) => {
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
      const tokenPricePromises = allTokens.map(async (token) => {
        console.log("Getting price history for token: " + token)
        const priceHistory = await getLastHourPrices(token);
        console.log("Price history: ")
        priceHistory.forEach((p) => {
          console.log("Price: " + p.price)
          console.log("Timestamp: " + p.timestamp)
          console.log("Sigs: " + p.signatures?.join(','))
        })
        // if (priceHistory.length < 10){
        //   console.error("Not enough price history to send notifications.")
        //   return null; // Skip if not enough data
        // } 

        const latestPrice = priceHistory[0]?.price;
        const checkIntervals = [5, 15, 30, 45]; // Minutes
        let alertType: "normal" | "critical" | null = null;

        for (const minutes of checkIntervals) {
          const oldPriceEntry = priceHistory.find(
            (entry) => entry.timestamp <= Date.now() - minutes * 60 * 1000
          );
          if (!oldPriceEntry) continue;

          const priceChange = calculatePriceChange(oldPriceEntry.price, latestPrice);
          console.log(`📊 ${token} change over ${minutes} mins: ${priceChange.toFixed(2)}%`);

          // 🔹 4️⃣ If Change > 10%, Send Normal Alert
          if (priceChange > 10 || priceChange < -10) {
            console.log("Normal alert")
            alertType = "normal";
          }

          // 🔹 5️⃣ If Change > 50%, Send Critical Alert
          if (priceChange > 50 || priceChange < -50) {
            console.log("Critical alert")
            alertType = "critical";
            break; // Critical alert takes priority
          }
        }

        // 🔹 6️⃣ Queue Notification if Needed
        if (alertType) {
          return {
            userId: user.uid,
            token,
            priceChange: latestPrice,
            alertType,
          };
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
      notificationsToSend.map((notification) =>
        sendNotification(notification.userId, notification.token, notification.priceChange, notification.alertType)
      )
    );

    console.log("✅ Price alerts processed.");
    return new Response(JSON.stringify({ message: "Alerts checked successfully" }), { status: 200 });
  } catch (error) {
    console.error("❌ Error checking price alerts:", error);
    return new Response(JSON.stringify({ error: "Failed to check alerts" }), { status: 500 });
  }
}
