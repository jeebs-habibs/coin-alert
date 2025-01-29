import { messaging } from "../lib/firebase/firebaseAdmin";
import { db } from "../lib/firebase/firebase";
import { collection, getDocs } from "firebase/firestore";

// Function to fetch all FCM tokens from Firestore
async function getAllFCMTokens(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
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
  const tokens = ["dbcZg-GdYJ_QNuCkAtdZVu:APA91bGwhJoWPEx2Tej52BnEpR8QtlFEnBFPBKzaf8Ek3v7iO3d92ZQa1k4r8kc3aE59ICxax7L4VV3bJKMk-Xc2_vPoX4gVl2vasb_UP7V3mI_vKmfUmno"]

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
