import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { GetPriceResponse, PoolType, PriceData, setTokenDead, Token, TokenData, TokenMetadata, updateToken } from "../lib/firebase/tokenUtils";
import { connection, umi } from "./connection";
import { adminDB } from "./firebase/firebaseAdmin";
import { getToken } from "./firebase/tokenUtils";
import { blockchainTaskQueue } from "./taskQueue";
import { fetchPumpSwapAMM, getPriceFromBondingCurve } from "./utils/pumpUtils";
import { fetchRaydiumPoolAccountsFromToken } from "./utils/raydiumUtils";
import { BILLION, PoolData, TokenAccountData } from "./utils/solanaUtils";
import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata'
import { publicKey } from "@metaplex-foundation/umi";

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
  name?: string;
  image?: string;
  symbol?: string;
  description?: string;
}

async function getTokenAccountBalance(accountPubkey: PublicKey): Promise<number | null> {
  const account = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(accountPubkey))
  return account.value.uiAmount
}

async function calculateTokenPrice(token: string, poolData: PoolData, poolType: PoolType): Promise<GetPriceResponse | undefined> {
  if (!poolData?.baseVault || !poolData?.quoteVault || !poolData?.baseMint) {
    console.log(`ERROR: Insufficient token data for ${poolType} price calculation for token: ${token}`);
    return undefined;
  }

  if(!poolData?.quoteVault){
    return undefined
  }

  const baseBalance = await getTokenAccountBalance(new PublicKey(poolData?.baseVault))
  const quoteBalance = await getTokenAccountBalance(new PublicKey(poolData?.quoteVault))
  if (baseBalance == null || quoteBalance == null) {
    console.error(`Failed to fetch balances for ${poolType} token: ${token}`);
    return undefined;
  }

  let price = 0;
  if (quoteBalance !== 0 && baseBalance !== 0) {
    price = poolData.baseMint.toString() === token ? (quoteBalance / baseBalance) : (baseBalance / quoteBalance);
  }

  if (price) {
    return {
      price: {
        price,
        marketCapSol: BILLION * price,
        timestamp: new Date().getTime(),
        pool: poolType,
      },
      tokenData: { pool: poolType },
    };
  } else {
    console.error(`No ${poolType} price data found for token: ${token}`);
    return undefined;
  }
}

export function isValidMint(mint: string): boolean {
  const validEndings = ["pump"];
  return validEndings.some(ending => mint.endsWith(ending));
}

async function fetchJsonFromUri(uri: string): Promise<URIMetadata | undefined> {
  try {
    const response = await fetch(uri);

    if (!response.ok) {
      console.error(`Failed to fetch JSON from ${uri}: ${response.status} ${response.statusText}`);
      return undefined
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
      uri: asset.metadata.uri
    };
  } catch (error) {
    console.error(`❌ Error getting Metaplex metadata for ${token}:`, error);
    return null;
  }
}

// 🔹 Get Metadata from Blockchain (Fallback)
async function getTokenMetadataFromBlockchain(token: string): Promise<TokenMetadata | undefined> {
  const metaplexMetadata = await blockchainTaskQueue.addTask(() => getTokenMetadataMetaplex(token));

  if (metaplexMetadata){
      // TODO: Once we setup images in notis, retest this code. Now its failing a lot and needs to not be running
    const parsedMetadata: URIMetadata | undefined = await fetchJsonFromUri(metaplexMetadata.uri)
    const tokenMetadata: TokenMetadata = {
      image: parsedMetadata?.image,
      description: parsedMetadata?.description,
      name: parsedMetadata?.name,
      symbol: parsedMetadata?.symbol,
      uri: metaplexMetadata.uri
    }
    return tokenMetadata
  } 
  return undefined
}

function decoratePoolData(priceResponse: GetPriceResponse, poolData: PoolData): GetPriceResponse {
  const finalResponse: GetPriceResponse = {
    ...priceResponse,
    tokenData: {
      baseMint: poolData.baseMint.toString(),
      baseVault: poolData.baseVault.toString(),
      quoteMint: poolData.quoteMint.toString(),
      quoteVault: poolData.quoteVault.toString(),
      marketPoolId: poolData.pubKey.toString()
    }
  }
  return finalResponse
}

// 🔹 Fetch Token Price from External APIs
async function getTokenPrice(token: string, tokenFromFirestore: Token | undefined): Promise<GetPriceResponse | undefined> {
  try {
    const poolType: PoolType | undefined = tokenFromFirestore?.tokenData?.pool
    if(!poolType){
      // 1. Bonding curve
      const bondingCurvePrice = await getPriceFromBondingCurve(token)
      if(bondingCurvePrice?.complete == false && bondingCurvePrice?.price){
        return bondingCurvePrice
      }
      if(bondingCurvePrice?.complete){
        // 2. If completed, check pump swap
        const pumpPoolData: PoolData | undefined = await fetchPumpSwapAMM(new PublicKey(token))
        if(pumpPoolData){
          const priceResponse = await calculateTokenPrice(token, pumpPoolData, "pump-swap")
          if(priceResponse){
            return decoratePoolData(priceResponse, pumpPoolData)
          }
        }
      }

      // 3. If cant find bonding curve account, check raydium
      const raydiumPoolData: PoolData | undefined = await fetchRaydiumPoolAccountsFromToken(new PublicKey(token))
      if(raydiumPoolData){
        const priceResponse = await calculateTokenPrice(token, raydiumPoolData, "raydium")
          if(priceResponse){
            return decoratePoolData(priceResponse, raydiumPoolData)
          }
      }

      return undefined
    } else {
      if(poolType == "pump"){
        // Check bonding curve
        const bondingCurvePrice = await getPriceFromBondingCurve(token)
        if(bondingCurvePrice?.complete){
          // If completed, check pump swap
          const pumpPoolData: PoolData | undefined = await fetchPumpSwapAMM(new PublicKey(token))
          if(pumpPoolData){
            const priceResponse = await calculateTokenPrice(token, pumpPoolData, "pump-swap")
            if(priceResponse){
              return decoratePoolData(priceResponse, pumpPoolData)
            }
          }
        } 
        if(bondingCurvePrice?.complete == false){
          return bondingCurvePrice
        }
      } 
      if(!tokenFromFirestore?.tokenData?.baseMint || !tokenFromFirestore.tokenData.baseVault || !tokenFromFirestore.tokenData.quoteMint || !tokenFromFirestore.tokenData.quoteVault || !tokenFromFirestore.tokenData.marketPoolId){
        return undefined
      }
      const poolData: PoolData = {
        baseMint: new PublicKey(tokenFromFirestore?.tokenData?.baseMint),
        baseVault: new PublicKey(tokenFromFirestore.tokenData.baseVault),
        quoteMint: new PublicKey(tokenFromFirestore.tokenData.quoteMint),
        quoteVault: new PublicKey(tokenFromFirestore.tokenData.quoteVault),
        pubKey: new PublicKey(tokenFromFirestore.tokenData.marketPoolId)
      }
      if(poolType == "raydium"){
        //Check if pool data is in db and call general function to get price
        const priceResponse = await calculateTokenPrice(token, poolData, "raydium")
        if(priceResponse){
          return decoratePoolData(priceResponse, poolData)
        }
      }
      if(poolType == "pump-swap"){
        //Check if pool data is in db and call general function to get price
        const priceResponse = await calculateTokenPrice(token, poolData, "pump-swap")
        if(priceResponse){
          return decoratePoolData(priceResponse, poolData)
        }
      }
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
        if(tokenFromFirestore?.isDead == true){
          totalDeadTokensSkippedFirestore = totalDeadTokensSkippedFirestore + 1
          return;
        }
        const isTokenDead = await setTokenDead(token, tokenFromFirestore);

        if (isTokenDead) {
          totalDeadTokensSkipped = totalDeadTokensSkipped + 1
          return;
        }

        if((tokenFromFirestore?.tokenData?.priceFetchFailures || 0) > 2){
          totalSkippedPrice = totalSkippedPrice + 1
          return;
        }

        let blockchainMetadataFailures = 0
        let tokenMetadata = tokenFromFirestore?.tokenData?.tokenMetadata
        if(!tokenMetadata && (tokenFromFirestore?.tokenData?.metadataFetchFailures || 0) < 7){
          const metadataFromBlockchain = await getTokenMetadataFromBlockchain(token)
          if(metadataFromBlockchain){
            tokenMetadata = metadataFromBlockchain
            totalSucceededToGetMetadata++;
          } else {
            totalFailedToGetMetadata++
            blockchainMetadataFailures = 1
          }
        } else {
          totalMetadataFetchSkipped++
        }

        const data = await getTokenPrice(token, tokenFromFirestore);
        if(!data){
          totalFailedPrice++;
          const tokenData = tokenFromFirestore?.tokenData || {}
          tokenData.priceFetchFailures = (tokenData?.priceFetchFailures || 0) + 1

          const updatedToken: Token = {
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
            console.log("Updated token " + token + " with price of " + data.price.marketCapSol + " SOL MC at " + data.price.timestamp + " from pool " + data.tokenData.pool)
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
      👛 Total Unique Wallets Processed: ${uniqueWalletSet.size}
      💰 Total Unique Tokens Found: ${totalUniqueTokens}
      ⚰️ Total Dead Tokens Skipped: ${totalDeadTokensSkipped}
      ⚰️ Total Dead Tokens Skipped from Firestore: ${totalDeadTokensSkippedFirestore}
      🔍 Total Metadata Fetch Failures: ${totalFailedToGetMetadata} (${metadataFailureRate.toFixed(2)}%)
      ✅ Total Metadata Fetch Successes: ${totalSucceededToGetMetadata}
      ⏭️ Total Metadata Fetch Skipped: ${totalMetadataFetchSkipped} 
      🗄️ Total uncached pool data: ${totalUncachedPoolData} 
      🚫 Total skipped prices: ${totalSkippedPrice}
      ❌ Total Price Fetch Failures: ${totalFailedPrice} (${priceFailureRate.toFixed(2)}%)
      💵 Total Price Fetch Successes: ${totalSucceedPrice}
    `;

    console.log(chalk.green(metricsSummary));

    return "✅ Unique tokens updated successfully." + metricsSummary
  } catch (error) {
    throw Error("❌ Error updating unique tokens:" + error)
  }
}
