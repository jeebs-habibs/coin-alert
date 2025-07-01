import { adminDB, auth } from "@/app/lib/firebase/firebaseAdmin";
import { getUser, updateUser } from "@/app/lib/firebase/userUtils";
import { Keypair } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

interface SirenWallet {
    uid: string;
    publicKey: string;
    secretKey: number[];
}

/**
 * Stores or updates the secret key for a user's wallet in the sirenWallets collection.
 * @param uid - The user's ID
 * @param publicKey - The wallet's public key
 * @param secretKey - The wallet's secret key as a Uint8Array
 */
export async function storeSecretKey(uid: string, publicKey: string, secretKey: Uint8Array): Promise<void> {
    try {
      const walletDocRef = adminDB.collection("sirenWallets").doc(publicKey);
  
      // Convert the secretKey to a serializable array
      const secretKeyArray = Array.from(secretKey);
  
      // Check if the wallet document exists
      const walletSnapshot = await walletDocRef.get();
      if (!walletSnapshot.exists) {
        console.warn(`⚠️ Wallet for user ${uid} not found. Creating a new document.`);
        await walletDocRef.set({
          uid,
          publicKey,
          secretKey: secretKeyArray,
        });
      } else {
        // Update only the secretKey field
        await walletDocRef.update({
          secretKey: secretKeyArray,
        });
      }
  
      console.log(`✅ Successfully stored secret key for user ${uid}`);
    } catch (error) {
      throw Error(`❌ Error storing secret key for user ${uid}: ` + error);
    }
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

      if(user?.userSirenWallet){
        return NextResponse.json({ error: "User already has a wallet: " + user.userSirenWallet }, { status: 500 });
      }
  
      const newWallet = Keypair.generate()
      const publicKey = newWallet.publicKey
      const secretKey = newWallet.secretKey

      await updateUser(userId, {userSirenWallet: publicKey.toString()})
      await storeSecretKey(userId, publicKey.toString(), secretKey)

      return NextResponse.json({publicKey: publicKey}, { status: 200 });
    } catch (error) {
      console.error("❌ Error fetching token data:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }
  