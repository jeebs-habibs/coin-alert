import { collection, getDocs } from "firebase/firestore";
import { sendMessageToFCMToken } from "../lib/fcm";
import { db } from "../lib/firebase/firebase";

export interface Message {
    notification: Notification
}

interface Notification {
    title: string;
    body: string;
    icon: string;
}

// Fetch all FCM tokens from your database
async function getAllFCMTokens(): Promise<string[]> {
  const tokens: string[] = [];
  try {
    const tokenSnapshot = await getDocs(collection(db, "fcm_tokens"));
    tokenSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });
  } catch (error) {
    console.error("Error fetching FCM tokens:", error);
  }
  return tokens;
}

// Send a normal notification to all tokens
export async function sendNormalNotification() {
  const tokens = await getAllFCMTokens();

  for (const token of tokens) {
    const message: Message = {
      notification: {
        title: "Normal Notification",
        body: "This is a normal notification sent from the server.",
        icon: "/icon.png",
      },
    };

    try {
      await sendMessageToFCMToken(token, message);
      console.log(`Normal notification sent to token: ${token}`);
    } catch (error) {
      console.error(`Error sending notification to token ${token}:`, error);
    }
  }
}

// Send an emergency notification to all tokens (currently commented out)
export async function sendEmergencyNotification() {
  const tokens = await getAllFCMTokens();

  for (const token of tokens) {
    const message = {
      notification: {
        title: "🚨 Emergency Notification",
        body: "This is an emergency notification requiring immediate attention!",
        icon: "/icon.png",
        vibrate: [200, 100, 200, 100, 200], // Vibrate pattern for attention
        requireInteraction: true, // Keep the notification until the user interacts
      },
    };

    try {
      await sendMessageToFCMToken(token, message);
      console.log(`Emergency notification sent to token: ${token}`);
    } catch (error) {
      console.error(`Error sending notification to token ${token}:`, error);
    }
  }
}
