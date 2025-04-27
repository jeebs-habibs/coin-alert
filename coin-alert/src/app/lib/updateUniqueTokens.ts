import { fetchDigitalAsset } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { getTokenMetadata, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { GetPriceResponse, PoolType, PriceData, setTokenDead, Token, TokenData, updateToken } from "../lib/firebase/tokenUtils";
import { connection, umi } from "./connection";
import { adminDB } from "./firebase/firebaseAdmin";
import { getToken } from "./firebase/tokenUtils";
import { blockchainTaskQueue } from "./taskQueue";
import { getTokenPricePump } from "./utils/pumpUtils";
import { getTokenPriceRaydium } from "./utils/raydiumUtils";
import { TokenAccountData } from "./utils/solanaUtils";

// 🔹 Metrics Tracking
let totalUsers = 0;
let totalUniqueTokens = 0;
let totalDeadTokensSkipped = 0;
let totalDeadTokensSkippedFirestore = 0;
let totalFailedToGetMetadata = 0;
let totalMetadataFetchSkipped = 0;
let totalSucceededToGetMetadata = 0;
let totalFailedPrice = 0;
let totalSucceedPrice = 0;
let totalSkippedPrice = 0;
let totalUncachedPoolData = 0;

interface URIMetadata {
  name: string;
  image: string;
  symbol: string;
  description: string;
}

function isValidMint(mint: string): boolean {
  const validEndings = ["bonk", "pump", "ray", "moon"];
  return validEndings.some(ending => mint.endsWith(ending));
}

async function fetchJsonFromUri(uri: string): Promise<URIMetadata | undefined> {
  try {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON from ${uri}: ${response.status} ${response.statusText}`);
    }

    const data: URIMetadata = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching JSON:", error);
    return undefined
  }
}


// 🔹 Fetch Metadata from Metaplex
async function getTokenMetadataMetaplex(token: string) {
  const mint = publicKey(token);
  try {
    const asset = await fetchDigitalAsset(umi, mint);
    //console.log(chalk.green(`✅ Got metadata for token: ${token}`));
    return {
      name: asset.metadata.name,
      symbol: asset.metadata.symbol,
      uri: asset.metadata.uri,
    };
  } catch (error) {
    console.error(`❌ Error getting Metaplex metadata for ${token}:`, error);
    return null;
  }
}

// 🔹 Get Metadata from Blockchain (Fallback)
async function getTokenMetadataFromBlockchain(token: string) {
  const metaplexMetadata = await blockchainTaskQueue.addTask(() => getTokenMetadataMetaplex(token));

  if (metaplexMetadata){
      // TODO: Once we setup images in notis, retest this code. Now its failing a lot and needs to not be running

    //const parsedMetadata = await fetchJsonFromUri(metaplexMetadata.uri)
    return metaplexMetadata
  } 

  return blockchainTaskQueue.addTask(() =>
    getTokenMetadata(connection, new PublicKey(token), "confirmed", TOKEN_PROGRAM_ID)
      .then(async (val) => {
        if(val == null){
          return null
        }

        return val
        
        // TODO: Once we setup images in notis, retest this code. Now its failing a lot and needs to not be running
        // const parsedMetadata = await fetchJsonFromUri(val.uri)

        // return {
        //   ...val,
        //   image: parsedMetadata?.image
        // }

      })
      .catch((e) => {
        console.error(`❌ Error getting metadata for ${token}:`, e);
        return null;
      })
  );
}

// 🔹 Fetch Token Price from External APIs
async function getTokenPrice(token: string, tokenFromFirestore: Token | undefined): Promise<GetPriceResponse | undefined> {
  try {

    let poolType: PoolType | undefined = tokenFromFirestore?.tokenData?.pool
    if(poolType == undefined){
      // 1. Bonding curve
      const bondingCurvePrice = 
      // 2. If completed, check pump swap
      // 3. If cant find bonding curve account, check raydium
    } else {
      if(poolType == "pump"){
        // Check bonding curve
        // If completed, check pump swap
      } 
      else if(poolType == "raydium"){
        //Check if pool data is in db and call general function to get price
      }
      else if(poolType == "pump-swap"){
        //Check if pool data is in db and call general function to get price
      }
    }
    // If raydium pool is defined in db, check that
    // If pump-swap pool is defined in db, check that
    //  
    // If bonding curve check pump bonding curve account. if marked as completed then look for pump swap

    // If no data in db, start with pump bonding curve -> pump swap -> raydium


    const raydiumTokenPrice = await getTokenPriceRaydium(token, tokenFromFirestore);

    if (!raydiumTokenPrice?.price) {
      const pumpPrice = await getTokenPricePump(token, tokenFromFirestore);
      if (pumpPrice?.price) return pumpPrice;
      console.error(`❌ Failed to get price data for token: ${token}`);
    } else {
      return raydiumTokenPrice;
    }
  } catch (error) {
    console.error(`❌ Error getting price data for ${token}:`, error);
  }
  return undefined;
}

// 🔹 Store Token Price in Firestore
export async function storeTokenPrice(
  token: string,
  price: PriceData,
  tokenData: TokenData,
  timesToUpdateFirestore: number[]
) {
  try {
    const tokenDocRef = adminDB.collection("uniqueTokens").doc(token);
    const docSnapshot = await tokenDocRef.get();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    let updatedPrices = [];

    if (docSnapshot.exists) {
      const tokenDataFromDB = docSnapshot.data();
      updatedPrices = (tokenDataFromDB?.prices || []).filter((p: PriceData) => p.timestamp > oneHourAgo);
    }

    updatedPrices.push(price);

    await tokenDocRef.set(
      {
        lastUpdated: new Date(),
        tokenData: tokenData,
        prices: updatedPrices,
      },
      { merge: true }
    );

    //console.log(`✅ Price stored for ${token}: $${price.price}`);
    timesToUpdateFirestore.push(Date.now() - oneHourAgo);
  } catch (error) {
    console.error(`❌ Error storing price for ${token}:`, error);
  }
}

// 🔹 Fetch All Unique Tokens and Store in Firestore
export async function updateUniqueTokens() {
  try {

    console.log("🔄 Updating unique tokens...");
    const timesToUpdateFirestore: number[] = [];
    const timesToGetTokenPrice: number[] = [];

    // 🔹 1️⃣ Fetch All Users' Wallets
    const usersSnapshot = await adminDB.collection("users").get();
    const uniqueTokensSet = new Set<string>();
    const uniqueWalletSet = new Set<string>();
    totalUsers = usersSnapshot.docs.length;

    usersSnapshot.docs.forEach((userDoc) => {
      const userData = userDoc.data();
      if (Array.isArray(userData.wallets)) {
        userData.wallets.forEach((wallet) => uniqueWalletSet.add(wallet));
      }
    });


    // 🔹 2️⃣ Fetch Token Data from Blockchain
    await Promise.all(
      Array.from(uniqueWalletSet).map((wallet) =>
        blockchainTaskQueue.addTask(async () => {
          const publicKey = new PublicKey(wallet);
          const tokenAccountsForAddress = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });

          tokenAccountsForAddress.value.forEach((value) => {
            const tokenAccountData: TokenAccountData = value.account.data.parsed;
            if ((tokenAccountData.info.tokenAmount.uiAmount || 0) > 50 && isValidMint(tokenAccountData.info.mint)) {
              //console.log(`Wallet ${wallet} has ${tokenAccountData.info.tokenAmount.uiAmount} of ${tokenAccountData.info.mint} Adding to unique set`)
              uniqueTokensSet.add(tokenAccountData.info.mint);
            }
          });
        })
      )
    );

    totalUniqueTokens = uniqueTokensSet.size;
    console.log(`✅ Finished fetching ${totalUniqueTokens} unique tokens`);

    // 🔹 3️⃣ Process Each Token
    await Promise.all(
      Array.from(uniqueTokensSet).map(async (token) => {
        //console.log(`🔹 Processing token: ${token}`);
        const performanceStart = Date.now();

        const tokenFromFirestore: Token | undefined = await getToken(token);
        if(tokenFromFirestore?.isDead){
          totalDeadTokensSkippedFirestore++
          return
        }
        const isTokenDead = await setTokenDead(token, tokenFromFirestore);

        if (isTokenDead) {
          totalDeadTokensSkipped++;
          return;
        }

        if((tokenFromFirestore?.tokenData?.priceFetchFailures || 0) > 2){
          totalSkippedPrice++
          return;
        }

        let blockchainMetadataFailures = 0
        let tokenMetadata = tokenFromFirestore?.tokenData?.tokenMetadata
        if(!tokenMetadata && (tokenFromFirestore?.tokenData?.metadataFetchFailures || 0) < 3){
          const metadataFromBlockchain = await getTokenMetadataFromBlockchain(token)
          if(metadataFromBlockchain){
            tokenMetadata = metadataFromBlockchain
            totalSucceededToGetMetadata++;
          } else {
            totalFailedToGetMetadata++
            blockchainMetadataFailures = 1
          }
        }
        if((tokenFromFirestore?.tokenData?.metadataFetchFailures || 0) < 3){
          totalMetadataFetchSkipped++
        }

        const data = await getTokenPrice(token, tokenFromFirestore);
        if(!data){
          totalFailedPrice++;
          let tokenData = tokenFromFirestore?.tokenData || {}
          tokenData.priceFetchFailures = (tokenData?.priceFetchFailures || 0) + 1

          let updatedToken: Token = {
            ...tokenFromFirestore,
            tokenData
          }
          
          updateToken(token, updatedToken)
          
        } else {
          if (tokenMetadata) data.tokenData.tokenMetadata = tokenMetadata;

          timesToGetTokenPrice.push(Date.now() - performanceStart);
  
          if (data?.price) {
            totalSucceedPrice++;
            data.tokenData.metadataFetchFailures = (data?.tokenData.metadataFetchFailures || 0 ) + blockchainMetadataFailures
   
            if(!tokenFromFirestore?.tokenData?.baseVault || !tokenFromFirestore.tokenData.quoteVault){
              totalUncachedPoolData++
            }
            await storeTokenPrice(token, data.price, data.tokenData, timesToUpdateFirestore);
          } else {
            totalFailedPrice++;
          }
        }
 
      })
    );

    // 🔹 Metrics Summary
    const totalProcessed = totalSucceedPrice + totalFailedPrice;
    const metadataFailureRate = (totalFailedToGetMetadata / totalUniqueTokens) * 100;
    const priceFailureRate = (totalFailedPrice / totalProcessed) * 100;

    const metricsSummary = `
      ====== API METRICS SUMMARY ======
      👤 Total Users Processed: ${totalUsers}
      👛 Total Unique Wallets Processed: ${uniqueWalletSet.size} // Added 👛 for wallets
      💰 Total Unique Tokens Found: ${totalUniqueTokens}
      ⚰️ Total Dead Tokens Skipped: ${totalDeadTokensSkipped}
      ⚰️ Total Dead Tokens Skipped from Firestore: ${totalDeadTokensSkippedFirestore}
      🔍 Total Metadata Fetch Failures: ${totalFailedToGetMetadata} (${metadataFailureRate.toFixed(2)}%)
      ✅ Total Metadata Fetch Successes: ${totalSucceededToGetMetadata}
      ⏭️ Total Metadata Fetch Skipped: ${totalMetadataFetchSkipped} // Added ⏭️ for skipped
      🗄️ Total uncached pool data: ${totalUncachedPoolData} // Added 🗄️ for data/cache
      🚫 Total skipped prices: ${totalSkippedPrice} // Added 🚫 for skipped
      ❌ Total Price Fetch Failures: ${totalFailedPrice} (${priceFailureRate.toFixed(2)}%)
      💵 Total Price Fetch Successes: ${totalSucceedPrice}
    `;

    console.log(chalk.green(metricsSummary));

    return "✅ Unique tokens updated successfully." + metricsSummary
  } catch (error) {
    throw Error("❌ Error updating unique tokens:" + error)
  }
}
