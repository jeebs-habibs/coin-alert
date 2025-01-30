import { QuerySnapshot } from "firebase-admin/firestore";
import { db } from "../lib/firebase/firebase";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { Connection, PublicKey, TokenAmount } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface TokenAccountData {
    info: TokenAccountInfo
    "type": string;
}

interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: TokenAmount;
}

// 🔹 Function to Fetch All Unique Tokens and Store in Firestore
export async function updateUniqueTokens() {
  try {
    console.log("🔄 Updating unique tokens...");
    const connection = new Connection(process.env.RPC_ENDPOINT || "")

    // 🔹 1️⃣ Fetch All Users' Wallets
    const usersSnapshot = await getDocs(collection(db, "users"));
    const uniqueTokensSet = new Set<string>(); // Use a Set to avoid duplicates

    const uniqueWallets = new Set<string>();

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.wallets && Array.isArray(userData.wallets)) {
        userData.wallets.forEach((wallet) => uniqueWallets.add(wallet));
      }
    });


    for (const wallet of uniqueWallets){
        const publicKey = new PublicKey(wallet)
        const tokenAccountsForAddress = await connection.getParsedTokenAccountsByOwner(publicKey, {programId: TOKEN_PROGRAM_ID})  
        tokenAccountsForAddress.value.forEach((value) => {
            const tokenAccountData: TokenAccountData = value.account.data.parsed
            if(tokenAccountData.info.tokenAmount.uiAmount || 0 > 0){
                uniqueTokensSet.add(tokenAccountData.info.mint)
            }

        })  
    }

    // 🔹 2️⃣ Store Unique Tokens in Firestore
    const uniqueTokensArray = Array.from(uniqueTokensSet);
    console.log(`✅ Found ${uniqueTokensArray.length} unique tokens.`);

    // 🔹 3️⃣ Store All Tokens in a Single Firestore Document
    const uniqueTokensDocRef = doc(db, "uniqueTokens", "main");
    await setDoc(uniqueTokensDocRef, { tokens: uniqueTokensArray, lastUpdated: new Date() });


    console.log("✅ Unique tokens updated in Firestore.");
  } catch (error) {
    console.error("❌ Error updating unique tokens:", error);
  }
}
