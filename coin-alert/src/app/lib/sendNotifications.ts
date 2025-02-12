import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";
import { messaging } from "../lib/firebase/firebaseAdmin";
import { AlarmConfig } from "../api/checkPriceAlerts/route";

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

// 🔹 Send Push Notification to User
export async function sendNotification(userId: string, token: string, priceChange: number, alertType: "normal" | "critical", minutes: number, alarmedConfig: AlarmConfig) {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()){
      console.error("ERROR: Unable to find user in DB to notify")
      return 
    } 

    const userData = userDocSnap.data();
    if (!userData.tokens || userData.tokens.length === 0){
      console.error("ERROR: User has no devices detected to notify.")
      return
    } 

    const increaseOrDecrease = priceChange > 0 ? "increased" : "decrease"
    const stonkEmoji = priceChange > 0 ? "📈" : "📉"

    const notificationTitle = alertType === "critical" ? "🚨 Critical Price Alert! " : "Standard Price Alert";
    const notificationBody = `${stonkEmoji} ${token} price ${increaseOrDecrease} by ${priceChange.toFixed(2)}% within ${minutes} minutes.`;

    for (const fcmToken of userData.tokens) {
      console.log(`Sending ${userId} a notification: ${notificationTitle}`)
      await messaging.send({
        token: fcmToken,
        notification: { title: notificationTitle, body: notificationBody },
        android: { priority: alertType === "critical" ? "high" : "normal" },
        apns: { payload: { aps: { sound: alertType === "critical" ? "emergency" : "default" } } },
      });
    }

    console.log(`✅ Sent ${alertType} alert for ${token} to ${userId}`);
  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }
}
