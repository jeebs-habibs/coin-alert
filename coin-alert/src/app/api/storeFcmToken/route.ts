import { adminDB, auth, messaging } from "@/app/lib/firebase/firebaseAdmin";
import { FirebaseMessagingError } from "firebase-admin/messaging";
import { NextRequest, NextResponse } from "next/server";
import { SirenUser } from "../../../../../shared/types/user";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ No Authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
      console.log("✅ User verified:", decodedToken.uid);
    } catch (error) {
      console.error("❌ Invalid token:", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, fcmToken }: { userId: string; fcmToken: string } = await request.json();

    if (!userId || !fcmToken) {
      console.error("❌ Missing userId or fcmToken");
      return NextResponse.json({ error: "Missing userId or fcmToken" }, { status: 400 });
    }

    const userRef = adminDB.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.error("❌ User not found:", userId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data() as SirenUser;
    const existingTokens: string[] = userData?.fcmTokens ?? [];

    if(!userData?.didSendWelcomeNoti){
      const notification = {
        title: "Welcome to Siren!",
        body: "This is a test notification. You’ll now receive alerts and see tokens in your dashboard.",
      };
  
      console.log("📤 Attempting to send notification to token:", fcmToken);
  
      try {
        const result = await messaging.send({
          token: fcmToken,
          notification,
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        });
  
        console.log("✅ Notification sent successfully. Message ID:", result);
        await userRef.update({ didSendWelcomeNoti: true });
      } catch (sendError: unknown) {
        if (sendError instanceof Error) {
          const typedError = sendError as FirebaseMessagingError;
          console.error(
            "❌ Failed to send FCM notification:",
            typedError.code,
            typedError.message,
            typedError.stack
          );
          return NextResponse.json(
            {
              error: "Failed to send FCM notification",
              fcmError: typedError.code,
              message: typedError.message,
            },
            { status: 500 }
          );
        } else {
          console.error("❌ Unknown error during FCM send:", sendError);
          return NextResponse.json(
            { error: "Unknown error during FCM send" },
            { status: 500 }
          );
        }
      }
    }

    if (existingTokens.includes(fcmToken)) {
      console.log("⚠️ FCM token already stored");
      return NextResponse.json({ success: true, message: "Token already exists" }, { status: 200 });
    }

    const updatedTokens = [...existingTokens, fcmToken];
    await userRef.update({ fcmTokens: updatedTokens });
    console.log("✅ FCM token stored");

    return NextResponse.json({ success: true, message: "FCM token added and notification sent" }, { status: 200 });
  } catch (error) {
    console.error("❌ Unexpected error while storing FCM token or sending notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
