import { auth } from "@/app/lib/firebase/firebaseAdmin";
import { getUser, updateUser } from "@/app/lib/firebase/userUtils";
import { Keypair } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

async function storeSecretKey(secretKey: Uint8Array<ArrayBufferLike>) {

}

export async function GET(request: NextRequest) {
    try {  
      const userId = request.nextUrl.searchParams.get("userId");
      if (!userId) {
          return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }
  
      console.log("🔐 Verifying user...");
  
      const authHeader = request.headers.get("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
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
  
      const user = await getUser(userId)
      if(user == null){
          return NextResponse.json({ error: "User does not exist" }, { status: 500 });
      }
  
      const newWallet = Keypair.generate()
      const publicKey = newWallet.publicKey
      const secretKey = newWallet.secretKey

      await updateUser(userId, {userSirenWallet: publicKey.toString()})
      

      return NextResponse.json({publicKey: publicKey}, { status: 200 });
    } catch (error) {
      console.error("❌ Error fetching token data:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  