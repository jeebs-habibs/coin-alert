import { adminDB, messaging } from "../lib/firebase/firebaseAdmin";
import { AlarmType } from "./constants/alarmConstants";
import { Token } from "./firebase/tokenUtils";
import { RecentNotification, SirenUser, updateRecentNotification } from "./firebase/userUtils";
import { getRedisClient } from "./redis";

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

function formatNumber(num: number): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1_000_000_000) {
      return `${sign}${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 1_000) {
      return `${sign}${(num / 1_000).toFixed(1)}K`;
  }
  return `${sign}${num.toFixed(1)}`;
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

/**
 * Removes an FCM token from a user's tokens array in Firestore.
 * @param uid - The user's ID
 * @param fcmToken - The FCM token to remove
 */
export async function removeFcmTokenFromUser(uid: string, fcmToken: string) {
  try {
    console.log(`Removing FCM token from user ${uid}: ${fcmToken}`);
    const userDocRef = adminDB.collection("users").doc(uid);
    const userSnapshot = await userDocRef.get();

    if (!userSnapshot.exists) {
      console.warn(`⚠️ User ${uid} not found while trying to remove token.`);
      return;
    }

    const userData = userSnapshot.data() as SirenUser;

    if (!userData.tokens || !Array.isArray(userData.tokens)) {
      console.warn(`⚠️ No tokens found for user ${uid}.`);
      return;
    }

    const updatedTokens = userData.tokens.filter((token) => token !== fcmToken);

    // Only update if the token was actually removed
    if (updatedTokens.length !== userData.tokens.length) {
      await userDocRef.update({ tokens: updatedTokens });
      console.log(`✅ Removed invalid FCM token from user ${uid}.`);
    } else {
      console.log(`ℹ️ Token ${fcmToken} not found in user ${uid}'s tokens array.`);
    }
  } catch (error) {
    console.error(`❌ Error removing FCM token for user ${uid}:`, error);
  }
}


async function updateRedisWithNotification(uid: string, token: string, percentChange: number, alertType: AlarmType, minutes: number, percentageBreached: number, timestamp: number){
  try {  
    const redisClient = await getRedisClient()
    const timestampMillis = Date.now();

    // Prepare notification data for Redis
    const notificationData: RecentNotification = {
      uid,
      mint: token,
      percentChange,
      alertType,
      minutes,
      percentageBreached,
      timestamp,
    };

    // Generate daily key (e.g., notifications:2025-05-21)
    const date = new Date();
    const dateKey = `notifications:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    // Add to Redis sorted set using zAdd
    await redisClient.zAdd(dateKey, {
      score: timestampMillis,
      value: JSON.stringify(notificationData),
    });

    // Set TTL of 7 days (259200 seconds)
    await redisClient.expire(dateKey, 7 * 24 * 60 * 60);
    await redisClient.quit()
  } catch (error){
    console.error(`Failed to store notification in redis for user ${uid}:`, error);
  }
}

export async function sendNotification(
  userId: string,
  token: string,
  priceChange: number,
  alertType: AlarmType,
  minutes: number,
  percentageBreached: number,
  tokenObj: Token | undefined,
  marketCapUsd?: number
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
      console.error("ERROR: User " + userData?.uid + " has no devices detected to notify.");
      return;
    }

    const tokenSliced = `${token.slice(0, 3)}..${token.slice(-4)}`;
    const symbolOrToken = tokenObj?.tokenData?.tokenMetadata?.symbol
      ? `$${tokenObj.tokenData.tokenMetadata.symbol}`
      : tokenSliced;
    const increaseOrDecrease = priceChange > 0 ? "up" : "down";
    const stonkEmoji = priceChange > 0 ? "📈" : "📉";
    const alertEmoji = alertType === "critical" ? "🚨" : "";
    const marketCap = marketCapUsd ? ` to MC of $${formatNumber(marketCapUsd)},` : "";

    const notificationTitle = `${alertEmoji} ${symbolOrToken} ${increaseOrDecrease} ${priceChange.toFixed(2)}% in ${minutes} minutes`;
    const notificationBody = `${stonkEmoji}${marketCap} breached threshold of ${percentageBreached}%`;

    for (const fcmToken of userData.tokens) {
      try {
        console.log(`Sending ${userId} a notification: ${notificationTitle} to token ${fcmToken}`);
        const image = tokenObj?.tokenData?.tokenMetadata?.image;
        const notification = image ? {
          title: notificationTitle,
          body: notificationBody,
          imageUrl: image,
        } : {
          title: notificationTitle,
          body: notificationBody,
        };

        await messaging.send({
          token: fcmToken,
          notification,
          android: { priority: alertType === "critical" ? "high" : "normal" },
          apns: { payload: { aps: { sound: alertType === "critical" ? "emergency" : "default" } } },
        });

        const notificationTimestamp = Date.now()
        await updateRecentNotification(userId, token, minutes, {
          timestamp: notificationTimestamp,
          percentageBreached,
          minutes,
          percentChange: priceChange,
          alertType,
          image,
          notificationTitle,
          notificationBody,
        });

        await updateRedisWithNotification(userId, token, priceChange, alertType, minutes, percentageBreached, notificationTimestamp)

      } catch (err) {
        if (err instanceof Error) {
          console.error(`❌ Failed to send notification to token ${fcmToken}: ${err.message}`);

          // Narrow the type for FirebaseMessagingError
          const firebaseErr = err as { code?: string; message?: string };

          if (
            firebaseErr.code === "messaging/registration-token-not-registered" ||
            firebaseErr.message?.includes("Requested entity was not found")
          ) {
            console.warn(`⚠️ Removing unregistered token ${fcmToken} for user ${userId}`);
            await removeFcmTokenFromUser(userId, fcmToken);
          }
        } else {
          console.error(`❌ Unknown error sending to token ${fcmToken}:`, err);
        }
      }

    }

    console.log(`✅ Sent ${alertType} alert for ${token} to ${userId}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Error sending notification: " + error.message + "\n" + error.stack);
    } else {
      console.error("❌ Unknown error: " + JSON.stringify(error));
    }
    return;
  }
}
