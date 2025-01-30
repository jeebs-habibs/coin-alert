import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";
import { messaging } from "../lib/firebase/firebaseAdmin";

// Function to fetch all FCM tokens from Firestore
async function getAllFCMTokens(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log(userData)
      if (userData.tokens && Array.isArray(userData.tokens)) {
        tokens.push(...userData.tokens);
      }
    });
  } catch (error) {
    console.error("❌ Error fetching FCM tokens:", error);
  }
  return tokens;
}

// Function to send notifications to all users
export async function sendNotificationsToAllUsers() {
  const tokens = await getAllFCMTokens()

  if (tokens.length === 0) {
    console.log("⚠️ No tokens found. Skipping notification.");
    return;
  }

  for (const token of tokens) {
    const message = {
      token,
      notification: {
        title: "🔔 Notification",
        body: "This is a test notification sent every 10 seconds.",
      },
    };

    try {
      await messaging.send(message);
      console.log(`✅ Notification sent to token: ${token}`);
    } catch (error) {
      console.error(`❌ Error sending notification to token ${token}:`, error);
    }
  }
}
