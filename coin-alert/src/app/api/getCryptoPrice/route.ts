import { getCryptoPriceBySymbolDB } from "@/app/lib/utils/cryptoPrice";
import { getAuth } from "firebase-admin/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol");
    if (!symbol) {
      return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    }

    console.log("🔐 Verifying user...");

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      console.log("✅ User verified:", decodedToken.uid);
    } catch (error) {
      console.error("❌ Invalid token:", error);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const priceData = await getCryptoPriceBySymbolDB(symbol);

    if (!priceData) {
      return NextResponse.json({ error: "Price data not found" }, { status: 404 });
    }

    return NextResponse.json(priceData, { status: 200 });
  } catch (error) {
    console.error("❌ Error fetching price data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
