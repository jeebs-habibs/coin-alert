import { NextResponse } from "next/server";
import { sendNotificationsToAllUsers } from "../../../lib/sendNotifications";

let intervalId: NodeJS.Timeout | null = null;

export async function GET() {
  if (intervalId) {
    return NextResponse.json({ message: "Notifications are already running." });
  }

  console.log("🔔 Starting push notifications every 10 seconds...");

  // Start an interval to send notifications every 10 seconds
  intervalId = setInterval(async () => {
    await sendNotificationsToAllUsers();
  }, 10000); // 10 seconds

  return NextResponse.json({ message: "Started sending notifications every 10 seconds." });
}
