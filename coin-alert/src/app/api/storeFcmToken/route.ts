import { adminDB, auth, messaging } from "@/app/lib/firebase/firebaseAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No Authorization header");
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

    const { userId, fcmToken } = await request.json();

    if (!userId || !fcmToken) {
      return NextResponse.json({ error: "Missing userId or fcmToken" }, { status: 400 });
    }

    const userRef = adminDB.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.data();
    const existingTokens: string[] = userData?.fcmTokens ?? [];


    const notification = {
        title: "Welcome to Siren!",
        body: "This is a test notification, you will now start to receive notifications and see tokens in your dashboard"
    };

    await messaging.send({
        token: fcmToken,
        notification
    });

    if (existingTokens.includes(fcmToken)) {
      console.log("⚠️ FCM token already stored");
      return NextResponse.json({ success: true, message: "Token already exists" }, { status: 200 });
    }

    const updatedTokens = [...existingTokens, fcmToken];
    await userRef.update({ fcmTokens: updatedTokens });

    return NextResponse.json({ success: true, message: "FCM token added" }, { status: 200 });
  } catch (error) {
    console.error("❌ Error storing FCM token:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
