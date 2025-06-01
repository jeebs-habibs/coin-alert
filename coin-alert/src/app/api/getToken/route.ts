import { getRedisClient } from "@/app/lib/redis";
import { getTokenPrices } from "@/app/lib/redis/prices";
import { getTokenFromRedis } from "@/app/lib/redis/tokens";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";
import { Token } from "../../../../../shared/types/token";


export async function GET(request: NextRequest) {
  try {
    // 👇 You could use the UID to scope the token fetching if needed
    const mint = request.nextUrl.searchParams.get("mint");
    if (!mint) {
        return NextResponse.json({ error: "Token ID is required" }, { status: 400 });
    }

    console.log("🔐 Verifying user...");

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    let decodedToken;
    try {
        decodedToken = await getAuth().verifyIdToken(idToken);
        console.log("✅ User verified:", decodedToken.uid);
    } catch (error) {
        console.error("❌ Invalid token:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redisClient = await getRedisClient();
    const tokenFromRedis = await getTokenFromRedis(mint, redisClient);
    const prices = await getTokenPrices(mint, redisClient);
    const token: Token = {...tokenFromRedis, prices}

    return NextResponse.json(token, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching token data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
