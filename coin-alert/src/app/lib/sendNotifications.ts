import { adminDB } from "../lib/firebase/firebaseAdmin";
import { messaging } from "../lib/firebase/firebaseAdmin";
import { AlarmType } from "./constants/alarmConstants";
import { Token } from "./firebase/tokenUtils";
import { updateRecentNotification } from "./firebase/userUtils";

// Function to fetch all FCM tokens from Firestore using adminDB
async function getAllFCMTokens(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const usersSnapshot = await adminDB.collection("users").get();
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      console.log(userData);
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
  const tokens = await getAllFCMTokens();

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
export async function sendNotification(
  userId: string,
  token: string,
  priceChange: number,
  alertType: AlarmType,
  minutes: number,
  percentageBreached: number,
  tokenObj: Token | undefined
) {
  try {
    const userDocRef = adminDB.collection("users").doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.error("ERROR: Unable to find user in DB to notify");
      return;
    }

    const userData = userDocSnap.data();
    if (!userData?.tokens || userData.tokens.length === 0) {
      console.error("ERROR: User has no devices detected to notify.");
      return;
    }

    const tokenSliced = `${token.slice(0, 3)}..${token.slice(-4)}`;
    const symbolOrToken = tokenObj?.tokenData?.tokenMetadata?.symbol
      ? `$${tokenObj?.tokenData?.tokenMetadata?.symbol}`
      : tokenSliced;
    const increaseOrDecrease = priceChange > 0 ? "up" : "down";
    const stonkEmoji = priceChange > 0 ? "📈" : "📉";
    const alertEmoji = alertType === "critical" ? "🚨" : "";

    const notificationTitle = `${alertEmoji} ${symbolOrToken} ${increaseOrDecrease} ${priceChange.toFixed(2)}% in ${minutes} minutes`;
    const notificationBody = `${stonkEmoji} ${tokenSliced} breached threshold of ${percentageBreached}%`;

    for (const fcmToken of userData.tokens) {
      console.log(`Sending ${userId} a notification: ${notificationTitle} to token ${fcmToken}`);
      await messaging
        .send({
          token: fcmToken,
          notification: { title: notificationTitle, body: notificationBody },
          android: { priority: alertType === "critical" ? "high" : "normal" },
          apns: { payload: { aps: { sound: alertType === "critical" ? "emergency" : "default" } } },
        })
        .then(() => {
          updateRecentNotification(userId, token, minutes, {
            timestamp: Date.now(),
            percentageBreached: percentageBreached,
            minutes: minutes,
            percentChange: priceChange,
            alertType: alertType,
          });
        });
    }

    console.log(`✅ Sent ${alertType} alert for ${token} to ${userId}`);
  } catch (error) {
    throw new Error("❌ Error sending notification: " + error);
  }
}
