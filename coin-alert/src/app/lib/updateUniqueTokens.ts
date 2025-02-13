import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";
import { GetPriceResponse, PriceData, Token, TokenData } from "../lib/firebase/tokenUtils";
import { connection } from "./connection";
import { getToken } from "./firebase/tokenUtils";
import { blockchainTaskQueue } from "./taskQueue";
import { getTokenPricePump } from './utils/pumpUtils';
import { getTokenPriceRaydium } from './utils/raydiumUtils';
import { TokenAccountData } from "./utils/solanaUtils";

async function getTokenPrice(token: string, tokenFromFirestore: Token | undefined): Promise<GetPriceResponse | undefined> {
  try {
    //console.log("Getting token price for token " + token)
    const raydiumTokenPrice = await getTokenPriceRaydium(token, tokenFromFirestore)
    //console.log("received raydium price of " + raydiumTokenPrice)

    if(!raydiumTokenPrice?.price){
      //console.log("Getting pump price")
      const pumpPrice = await getTokenPricePump(token)
      if(pumpPrice?.price){
        return pumpPrice
      } else {
        console.error("Failed to update price data for token: " + token)
      }
      
    } else {
      console.log("Returning raydium price")
      return raydiumTokenPrice
    }
    
  } catch(e) {
    console.error("Error getting price data for token " + token + ": " + e)
    throw e
  }
}

async function storeTokenPrice(
  token: string,
  price: PriceData,
  tokenData: TokenData,
  timesToUpdateFirestore: number[],
  timesToDeleteFirestore: number[]
) {
  try {
    const tokenDocRef = doc(db, "uniqueTokens", token);
    
    // 🔹 Check if the document exists
    const docSnapshot = await getDoc(tokenDocRef);

    if (!docSnapshot.exists()) {
      console.log(`📄 Token ${token} does not exist. Creating document...`);
      await setDoc(tokenDocRef, {
        lastUpdated: new Date(),
        tokenData: tokenData,
        prices: [price], // Initialize with the first price
      });
      console.log(`✅ Created new Firestore document for token: ${token}`);
    } else {
      // 🔹 Append New Price Data to Prices Array
      console.log(`✏️ Updating existing document for token: ${token}`);
      const updatePerformance = new Date().getTime();
      await updateDoc(tokenDocRef, {
        lastUpdated: new Date(),
        tokenData: tokenData,
        prices: arrayUnion(price),
      });
      const afterUpdatePerformance = new Date().getTime();
      const timeToUpdateFirestore = afterUpdatePerformance - updatePerformance;
      timesToUpdateFirestore.push(timeToUpdateFirestore);
    }

    console.log(`✅ Price stored for ${token}: $${price.price}`);

    // 🔹 Clean up old prices (Keep only last 60 minutes)
    const deletePerformance = new Date().getTime();
    await deleteOldPrices(token);
    const afterDeletePerformance = new Date().getTime();
    const timeToDeleteFirestore = afterDeletePerformance - deletePerformance;
    timesToDeleteFirestore.push(timeToDeleteFirestore);
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

// 🔹 Function to Fetch All Unique Tokens and Store in Firestore
export async function updateUniqueTokens() {
  try {
    console.log("🔄 Updating unique tokens...");
    const timesToUpdateFirestore: number[] = []
    const timesToDeleteFirestore: number[] = []
    const timesToGetTokenPrice: number[] = []

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


    const walletPromises = Array.from(uniqueWallets).map((wallet) => 
      blockchainTaskQueue.addTask(async () => {
        const publicKey = new PublicKey(wallet);
        const tokenAccountsForAddress = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
        tokenAccountsForAddress.value.forEach((value) => {
          const tokenAccountData: TokenAccountData = value.account.data.parsed;
          if ((tokenAccountData.info.tokenAmount.uiAmount || 0) > 0) {
            uniqueTokensSet.add(tokenAccountData.info.mint);
          }
        });
      }, "Adding task to get all unique tokens across all wallets")
    );

    await Promise.all(walletPromises);
    console.log("Finished getting " + uniqueTokensSet.size + " unique tokens")

    const tokenSetTest = new Set<string>()
    tokenSetTest.add("2RuDRx9RAcXrSoLupeMLGuBay6w5Q1nUrdPySjA3pump")

    // 🔹 3️⃣ Fetch Token Prices Using the Queue
    const tokensFailedToGetPrice: string[] = [];
    const tokenPricePromises = Array.from(uniqueTokensSet).map(async (token) => {
        console.log("===========Getting price for token: " + token + "============");
        const performancePrice = Date.now();
        const tokenFromFirestore: Token | undefined = await getToken(token);
        const data: GetPriceResponse | undefined = await getTokenPrice(token, tokenFromFirestore);
        const afterPerformancePrice = Date.now();
        const timeTakenToGetPrice = afterPerformancePrice - performancePrice;

        timesToGetTokenPrice.push(timeTakenToGetPrice);

        if (data?.price) {
          await storeTokenPrice(token, data.price, data.tokenData, timesToUpdateFirestore, timesToDeleteFirestore);
        } else {
          tokensFailedToGetPrice.push(token);
        }
      }
    );

    console.log("About to get all token prices with queue")
    await Promise.all(tokenPricePromises);
    console.log(chalk.green("SUCCESSFULLY GOT ALL TOKEN PRICES"))

    if(tokensFailedToGetPrice.length){
      console.error(`Failed to get price for ${tokensFailedToGetPrice.length}/${uniqueTokensSet.size} (${(tokensFailedToGetPrice.length / uniqueTokensSet.size) * 100}%) tokens: ${tokensFailedToGetPrice.join(",")}`)
    }

    const avgTimeToUpdateFirestore = timesToUpdateFirestore.reduce((acc, num) => acc + num, 0) / timesToUpdateFirestore.length
    const avgTimeToDeleteFirestore = timesToDeleteFirestore.reduce((acc, num) => acc + num, 0) / timesToDeleteFirestore.length
    const avgTimeToGetTokenPrice = timesToGetTokenPrice.reduce((acc, num) => acc + num, 0) / timesToGetTokenPrice.length
    const maxTimeToUpdateFirestore = Math.max(...timesToUpdateFirestore)
    const maxTimeToDeleteFirestore = Math.max(...timesToDeleteFirestore)
    const maxTimeToGetTokenPrice = Math.max(...timesToGetTokenPrice)

    console.log("=====API METRICS=====")
    console.log("Update firestore: " + avgTimeToUpdateFirestore + " ms (avg) " + maxTimeToUpdateFirestore + " ms (max)")
    console.log("Delete firestore: " + avgTimeToDeleteFirestore + " ms (avg) " + maxTimeToDeleteFirestore + " ms (max)")
    console.log("Get token price: " + avgTimeToGetTokenPrice + " ms (avg) " + maxTimeToGetTokenPrice + " ms (max)")

    console.log("✅ Unique tokens updated in Firestore.");
  } catch (error) {
    console.error("❌ Error updating unique tokens:", error);
  }
}

// 🔹 Utility: Exponential Backoff with Jitter. Not in use but leaving here
// async function getTokenPriceWithBackoff(token: string, tokenFromFirestore: Token | undefined, maxRetries = 5): Promise<GetPriceResponse | undefined> {
//   const baseDelay = 100; // Initial delay in ms
//   console.log(chalk.green("In backoff function"))
//   for (let attempt = 0; attempt <= maxRetries; attempt++) {
//     try {
//       // 🔹 Calculate exponential delay with random jitter
//       const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 10000;
//       console.log(`⏳ Retrying ${token} in ${Math.round(delay)}ms...`);
//       await new Promise((resolve) => setTimeout(resolve, delay));
//       return await getTokenPrice(token, tokenFromFirestore);
//     } catch (error) {
//       console.error(`⚠️ Error fetching ${token} (Attempt ${attempt + 1}):`, error);

//       if (attempt === maxRetries) {
//         console.error(`❌ Max retries reached for ${token}, skipping.`);
//         return undefined;
//       }
//     }
//   }
// }
