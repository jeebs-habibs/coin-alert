import { NextResponse } from "next/server";
import { sendNotificationsToAllUsers } from "../../lib/sendNotifications";

export async function GET() {
  try {
    console.log("🚀 Sending test notifications to all users...");

    // 🔹 Call function to send notifications
    await sendNotificationsToAllUsers();

    console.log("✅ Test notifications sent successfully!");
    return NextResponse.json({ message: "Test notifications sent successfully!" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error sending test notifications:", error);
    return NextResponse.json({ error: "Failed to send test notifications" }, { status: 500 });
  }
}
