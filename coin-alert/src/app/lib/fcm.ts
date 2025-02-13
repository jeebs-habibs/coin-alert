import { messaging } from "../lib/firebase/firebaseAdmin";
import { Message } from "./notificationService";

// Send a notification to a specific FCM token
export async function sendMessageToFCMToken(token: string, message: Message) {
  try {
    await messaging.send({
      token,
      notification: message.notification,
    });
    console.log(`Message sent to ${token}`);
  } catch (error) {
    console.error("Error sending FCM message:", error);
    throw error;
  }
}
