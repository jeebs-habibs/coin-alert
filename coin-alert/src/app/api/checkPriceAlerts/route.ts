import { collection, doc, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { sendNotification } from "../../lib/sendNotifications"; // Push notification logic

async function getLastHourPrices(token: string) {
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
  
      const tokenDocRef = doc(db, "uniqueTokens", token);
      const pricesCollectionRef = collection(tokenDocRef, "prices"); // Fetch from subcollection
  
      const pricesQuery = query(
        pricesCollectionRef,
        where("timestamp", ">", oneHourAgo), // Only last 60 mins
        orderBy("timestamp", "desc") // Most recent first
      );
  
      const querySnapshot = await getDocs(pricesQuery);
      const prices = querySnapshot.docs.map((doc) => doc.data());
  
      return prices;
    } catch (error) {
      console.error(`❌ Error fetching prices for ${token}:`, error);
      return [];
    }
  }

// 🔹 Placeholder: Fetch Tokens Owned by User (Implement This Later)
async function getTokensFromBlockchain(walletAddress: string): Promise<string[]> {
  // TODO: Implement logic to fetch tokens owned by a given wallet address
  return [];
}

// 🔹 Check Price Change Percentage
function calculatePriceChange(oldPrice: number, newPrice: number): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

// 🔹 Main API Function
export async function GET() {
  try {
    console.log("🔄 Checking price alerts for users...");

    const usersSnapshot = await getDocs(collection(db, "users"));
    const notificationsToSend: any[] = [];

    // 🔹 1️⃣ Loop Through Users
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (!userData.wallets || !Array.isArray(userData.wallets)) continue; // Skip users with no wallets

      console.log(`👤 Checking tokens for user: ${userDoc.id}`);

      // 🔹 2️⃣ Get All Tokens Owned by User (via Blockchain)
      let allTokens = new Set<string>(); // Avoid duplicates
      for (const wallet of userData.wallets) {
        const tokens = await getTokensFromBlockchain(wallet);
        tokens.forEach((token) => allTokens.add(token));
      }

      // 🔹 3️⃣ Check Price Changes for Each Token
      for (const token of allTokens) {
        const priceHistory = await getLastHourPrices(token);
        if (priceHistory.length < 10) continue; // Skip if not enough data

        const latestPrice = priceHistory[0].price;
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
            alertType = "normal";
          }

          // 🔹 5️⃣ If Change > 50%, Send Critical Alert
          if (priceChange > 50 || priceChange < -50) {
            alertType = "critical";
            break; // Critical alert takes priority
          }
        }

        // 🔹 6️⃣ Send Notification if Needed
        if (alertType) {
          notificationsToSend.push({
            userId: userDoc.id,
            token,
            priceChange: latestPrice,
            alertType,
          });
        }
      }
    }

    // 🔹 7️⃣ Send Notifications in Bulk
    for (const notification of notificationsToSend) {
      await sendNotification(notification.userId, notification.token, notification.priceChange, notification.alertType);
    }

    console.log("✅ Price alerts processed.");
    return new Response(JSON.stringify({ message: "Alerts checked successfully" }), { status: 200 });
  } catch (error) {
    console.error("❌ Error checking price alerts:", error);
    return new Response(JSON.stringify({ error: "Failed to check alerts" }), { status: 500 });
  }
}
