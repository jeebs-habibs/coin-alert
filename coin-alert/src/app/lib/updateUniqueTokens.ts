import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, TokenAmount } from "@solana/web3.js";
import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";

async function getTokenPrice(token: string) {
  // Get latest transaction from token pool 
  // Parse if its a raydium or pump token
  // Get sol amount from latest swap
  // Return sol amount, pool, and timestamp
}

// 🔹 Function to Store Token Price in Firestore
export async function storeTokenPrice(token: string, price: number) {
  try {
    const tokenDocRef = doc(db, "uniqueTokens", token);
    const pricesCollectionRef = collection(tokenDocRef, "prices"); // Subcollection for price history

    const timestamp = Date.now(); // Store timestamp in milliseconds

    // 🔹 Store price data
    await setDoc(doc(pricesCollectionRef, timestamp.toString()), {
      price,
      timestamp,
    });

    console.log(`✅ Price stored for ${token}: $${price}`);

    // 🔹 Clean up old prices (Keep only last 60 minutes)
    await deleteOldPrices(token);
  } catch (error) {
    console.error(`❌ Error storing price for ${token}:`, error);
  }
}

// 🔹 Function to Delete Prices Older Than 1 Hour
async function deleteOldPrices(token: string) {
  try {
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour ago in milliseconds
    const tokenDocRef = doc(db, "uniqueTokens", token);
    const pricesCollectionRef = collection(tokenDocRef, "prices");

    const oldPricesQuery = query(pricesCollectionRef, orderBy("timestamp"));
    const querySnapshot = await getDocs(oldPricesQuery);

    querySnapshot.forEach(async (docSnap) => {
      if (docSnap.data().timestamp < oneHourAgo) {
        await deleteDoc(docSnap.ref);
        console.log(`🗑 Deleted old price data for ${token}`);
      }
    });
  } catch (error) {
    console.error(`❌ Error deleting old prices for ${token}:`, error);
  }
}


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
    for (const token of uniqueTokensSet) {
      // TODO: Add fetching of price data here and store in db
      // getTokenPrice()
      // storeTokenPrice()
      const tokenDocRef = doc(db, "uniqueTokens", token);
      await setDoc(tokenDocRef, { lastUpdated: new Date() }, { merge: true }); // Merge ensures we don’t overwrite
    }


    console.log("✅ Unique tokens updated in Firestore.");
  } catch (error) {
    console.error("❌ Error updating unique tokens:", error);
  }
}
