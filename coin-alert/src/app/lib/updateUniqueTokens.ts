import { fetchDigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey } from "@metaplex-foundation/umi";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import chalk from "chalk";
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";
import { GetPriceResponse, getTokenCached, PoolType, PriceData, setTokenDead, Token, TokenData, TokenMetadata, updateToken } from "../lib/firebase/tokenUtils";
import { connection, umi } from "./connection";
import { adminDB } from "./firebase/firebaseAdmin";
import { TrackedToken } from "./firebase/userUtils";
import { blockchainTaskQueue } from "./taskQueue";
// import { fetchPumpSwapAMM, getPriceFromBondingCurve } from "./utils/pumpUtils";
// import { fetchRaydiumPoolAccountsFromToken } from "./utils/raydiumUtils";
import { BILLION, PoolData, TokenAccountData } from "./utils/solanaUtils";
import { getLastHourPrices } from './utils/priceAlertHelper';
//import { fetchMeteoraPoolAccountsFromToken } from './utils/meteoraUtils';

const tokensCache: Map<string, Token> = new Map<string, Token>()

const SOL_THRESHOLD = .01

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
let tokensSkippedWithNoPoolData = 0;
let totalFailedToBuildPoolData = 0;

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

// The number of max price failures we allow before skipping a token
const PRICE_FETCH_THRESHOLD = 8

async function calculateTokenPrice(token: string, poolData: PoolData, poolType: PoolType): Promise<GetPriceResponse | undefined> {
  if (!poolData?.baseVault || !poolData?.quoteVault || !poolData?.baseMint || !poolData?.quoteVault) {
    console.log(`ERROR: Insufficient token data for ${poolType} price calculation for token: ${token}`);
    return undefined;
  }


  const baseBalance = poolType === "meteora" && poolData?.baseLpVault
    ? await getTokenAccountBalance(new PublicKey(poolData.baseLpVault))
    : poolData?.baseVault
      ? await getTokenAccountBalance(new PublicKey(poolData.baseVault))
      : undefined;

  const quoteBalance = poolType === "meteora" && poolData?.quoteLpVault
    ? await getTokenAccountBalance(new PublicKey(poolData.quoteLpVault))
    : poolData?.quoteVault
      ? await getTokenAccountBalance(new PublicKey(poolData.quoteVault))
      : undefined;

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

export function isInvalidMint(mint: string): boolean {
  const invalidEndings = ["bonk", "moon", "boop"];
  return invalidEndings.some(ending => mint.endsWith(ending));
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

// function decoratePoolData(priceResponse: GetPriceResponse, poolData: PoolData, poolType: PoolType): GetPriceResponse {
//   const finalResponse: GetPriceResponse = {
//     ...priceResponse,
//     tokenData: {
//       baseMint: poolData.baseMint.toString(),
//       baseVault: poolData.baseVault.toString(),
//       quoteMint: poolData.quoteMint.toString(),
//       quoteVault: poolData.quoteVault.toString(),
//       marketPoolId: poolData.pubKey.toString(),
//       baseLpVault: poolData?.baseLpVault?.toString(),
//       quoteLpVault: poolData?.quoteLpVault?.toString(),
//       pool: poolType
//     }
//   }
//   return finalResponse
// }

function buildPoolDataFromTokenData(tokenData: TokenData): PoolData | undefined {
  // Validate required fields
  if (!tokenData.baseVault || !tokenData.quoteVault || !tokenData.baseMint || 
      !tokenData.quoteMint || !tokenData.marketPoolId) {
    return undefined
  }

  return {
    quoteVault: new PublicKey(tokenData.quoteVault),
    baseVault: new PublicKey(tokenData.baseVault),
    baseMint: new PublicKey(tokenData.baseMint),
    quoteMint: new PublicKey(tokenData.quoteMint),
    pubKey: new PublicKey(tokenData.marketPoolId),
    quoteLpVault: tokenData?.quoteLpVault ? new PublicKey(tokenData.quoteLpVault) : undefined,
    baseLpVault: tokenData?.baseLpVault ? new PublicKey(tokenData.baseLpVault) : undefined,
  };
}

// // 🔹 Fetch Token Price from External APIs
// async function getTokenPrice(token: string, tokenFromFirestore: Token | undefined): Promise<GetPriceResponse | undefined> {
//   try {
//     const poolType: PoolType | undefined = tokenFromFirestore?.tokenData?.pool
//     if(!poolType){
//       // 1. Bonding curve
//       const bondingCurvePrice = await getPriceFromBondingCurve(token)
//       if(bondingCurvePrice?.complete == false && bondingCurvePrice?.price){
//         return bondingCurvePrice
//       }
//       if(bondingCurvePrice?.complete){
//         // 2. If completed, check pump swap. Shouldn't have any pool data cached in db
//         const pumpPoolData: PoolData | undefined = await fetchPumpSwapAMM(new PublicKey(token))
//         if(pumpPoolData){
//           const priceResponse = await calculateTokenPrice(token, pumpPoolData, "pump-swap")
//           if(priceResponse){
//             return decoratePoolData(priceResponse, pumpPoolData, "pump-swap")
//           }
//         }
//       }

//       // 3. If cant find pump or raydium check meteora
//       const meteoraPoolData: PoolData | undefined = await fetchMeteoraPoolAccountsFromToken(new PublicKey(token))
//       if(meteoraPoolData){
//           const priceResponse = await calculateTokenPrice(token, meteoraPoolData, "meteora")
//           if(priceResponse){
//             return decoratePoolData(priceResponse, meteoraPoolData, "meteora")
//           }
//       }

//       // 4. If cant find bonding curve account, check raydium
//       const raydiumPoolData: PoolData | undefined = await fetchRaydiumPoolAccountsFromToken(new PublicKey(token))
//       if(raydiumPoolData){
//         const priceResponse = await calculateTokenPrice(token, raydiumPoolData, "raydium")
//           if(priceResponse){
//             return decoratePoolData(priceResponse, raydiumPoolData, "raydium")
//           }
//       }
      
//       return undefined

//     } else {
//       if(poolType == "pump"){
//         // Check bonding curve
//         const bondingCurvePrice = await getPriceFromBondingCurve(token)
//         if(bondingCurvePrice?.complete){
//           // If completed, check pump swap
//           const pumpPoolData: PoolData | undefined = await fetchPumpSwapAMM(new PublicKey(token))
//           if(pumpPoolData){
//             const priceResponse = await calculateTokenPrice(token, pumpPoolData, "pump-swap")
//             if(priceResponse){
//               return decoratePoolData(priceResponse, pumpPoolData, "pump-swap")
//             }
//           }
//         } 
//         if(bondingCurvePrice?.complete == false){
//           return bondingCurvePrice
//         }
//       } 
//       if(!tokenFromFirestore?.tokenData?.baseMint || !tokenFromFirestore.tokenData.baseVault || !tokenFromFirestore.tokenData.quoteMint || !tokenFromFirestore.tokenData.quoteVault || !tokenFromFirestore.tokenData.marketPoolId){
//         return undefined
//       }
//       const poolData: PoolData = {
//         baseMint: new PublicKey(tokenFromFirestore?.tokenData?.baseMint),
//         baseVault: new PublicKey(tokenFromFirestore.tokenData.baseVault),
//         quoteMint: new PublicKey(tokenFromFirestore.tokenData.quoteMint),
//         quoteVault: new PublicKey(tokenFromFirestore.tokenData.quoteVault),
//         pubKey: new PublicKey(tokenFromFirestore.tokenData.marketPoolId)
//       }
//       if(poolType == "raydium"){
//         //Check if pool data is in db and call general function to get price
//         const priceResponse = await calculateTokenPrice(token, poolData, "raydium")
//         if(priceResponse){
//           return decoratePoolData(priceResponse, poolData, "raydium")
//         }
//       }
//       if(poolType == "pump-swap"){
//         //Check if pool data is in db and call general function to get price
//         const priceResponse = await calculateTokenPrice(token, poolData, "pump-swap")
//         if(priceResponse){
//           return decoratePoolData(priceResponse, poolData, "pump-swap")
//         }
//       }
//       if(poolType == "meteora"){
//         const priceResponse = await calculateTokenPrice(token, poolData, "meteora")
//         if(priceResponse){
//           return decoratePoolData(priceResponse, poolData, "meteora")
//         }
//       }
      
//     }
//   } catch (error) {
//     console.error(`❌ Error getting price data for ${token}:`, error);
//   }
//   return undefined;
// }

// Function to update trackedTokens in Firestore, preserving isNotificationsOn
async function updateUserTrackedTokens(
  userTokenMap: Map<string, Set<TrackedToken>>,
  usersSnapshot: QuerySnapshot<DocumentData>
) {
  for (const [userId, tokenSet] of userTokenMap) {
    try {
      const userRef = adminDB.collection("users").doc(userId);
      const userDoc = usersSnapshot.docs.find((doc) => doc.id === userId);
      const userData = userDoc?.data() || {};

      // Get existing trackedTokens from Firestore (or empty array if none)
      const existingTokens: TrackedToken[] = Array.isArray(userData.trackedTokens)
        ? userData.trackedTokens
        : [];

      // Convert new tokenSet to array and merge isNotificationsOn from existing tokens
      const newTokens = Array.from(tokenSet);
      const updatedTokens: TrackedToken[] = newTokens.map((newToken) => {
        const existingToken = existingTokens.find((token) => token.mint === newToken.mint);
        return {
          mint: newToken.mint,
          tokensOwned: newToken.tokensOwned,
          isNotificationsOn: existingToken ? existingToken?.isNotificationsOn : newToken.isNotificationsOn,
        };
      });

      console.log("Updating user: " + userId + " with " + updatedTokens.length + " trackedTokens.")
      //updatedTokens.forEach((a) => console.log(a))

      // Update Firestore with new trackedTokens
      await userRef.update({
        trackedTokens: updatedTokens
      });
    } catch (error) {
      console.error(`Error updating trackedTokens for user ${userId}:`, error);
    }
  }
  console.log(`Updated trackedTokens for ${userTokenMap.size} users.`);
}

function getTrackedToken(set: Set<TrackedToken>, mint: string): TrackedToken | undefined {
  for (const token of set) {
    if (token.mint === mint) {
      return token;
    }
  }
  return undefined;
}

function isTokenOverThreshold(price: number | null, tokenAmount: number): boolean {
  if(price == null){
    return true
  }
  return ((price * tokenAmount) > SOL_THRESHOLD)
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

    // 🔹 1️⃣ Fetch All Users' Wallets and Initialize Token Tracking
    const usersSnapshot: QuerySnapshot<DocumentData> = await adminDB.collection("users").get();
    const userTokenMap = new Map<string, Set<TrackedToken>>(); // Map<userId, Set<TrackedToken>>
    const uniqueWalletSet = new Set<string>();
    const uniqueTokensSet = new Set<string>();
    totalUsers = usersSnapshot.docs.length; // Assuming totalUsers is defined elsewhere

    // Initialize userTokenMap for each user
    usersSnapshot.docs.forEach((userDoc) => {
      const userId = userDoc.id;
      const userData = userDoc.data();
      userTokenMap.set(userId, new Set<TrackedToken>());
      if (Array.isArray(userData.wallets)) {
        userData.wallets.forEach((wallet: string) => uniqueWalletSet.add(wallet));
      }
    });

    console.log("Unique wallets: ")
    uniqueWalletSet.forEach((wallet) => console.log(wallet))

    const updateTrackedTokensStartTime = Date.now()
    // Collect all token mints across all wallets
    // Precompute wallet-to-users map to avoid duplicate user lookups
    const walletToUsers = new Map<string, Set<string>>();
    usersSnapshot.docs.forEach((userDoc) => {
      const userId = userDoc.id;
      const wallets = userDoc.data().wallets || [];
      wallets.forEach((wallet: string) => {
        if (!walletToUsers.has(wallet)) walletToUsers.set(wallet, new Set());
        (walletToUsers.get(wallet) || new Set()).add(userId);
      });
    });

    // Process wallets
    await Promise.all(
      Array.from(uniqueWalletSet).map(async (wallet) => {
        try {
          const publicKey = new PublicKey(wallet);
          const startTimeGettingTokenAccounts = Date.now();
          const tokenAccountsForAddress = await blockchainTaskQueue.addTask(() =>
            connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
          );
          console.log(
            `Getting tokens owned by ${wallet} took ${
              (Date.now() - startTimeGettingTokenAccounts) / 1000
            } seconds`
          );

          // Get users for this wallet
          const usersWithWallet = walletToUsers.get(wallet) || new Set();

          // Collect unique token mints for this wallet
          const tokenMints = new Set<string>();
          const tokenInfoList: { mint: string; amount: number }[] = [];
          tokenAccountsForAddress.value.forEach((value) => {
            const tokenAccountData: TokenAccountData = value.account.data.parsed;
            if (tokenAccountData.info.tokenAmount.uiAmount != null) {
              const mint = tokenAccountData.info.mint;
              tokenMints.add(mint);
              tokenInfoList.push({ mint, amount: tokenAccountData.info.tokenAmount.uiAmount });
            }
          });

          // Fetch token metadata in parallel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tokenDataMap = new Map<string, any>();
          await Promise.all(
            Array.from(tokenMints).map(async (mint) => {
              try {
                //console.log(`Fetching metadata for token: ${mint}`);
                const tokenObj = await getTokenCached(mint, tokensCache);
                tokenDataMap.set(mint, tokenObj);
              } catch (error) {
                console.error(`Error fetching token ${mint}:`, error);
              }
            })
          );

          // Process tokens in parallel (extracted for loop)
          await Promise.all(
            tokenInfoList.map(async ({ mint, amount }) => {
              try {
                //console.log(`Processing token: ${mint} for wallet ${wallet}`);
                if (amount <= 50 || isInvalidMint(mint)) return;

                const tokenObj = tokenDataMap.get(mint);
                if (
                  tokenObj && tokenObj[0]?.isDead != true &&
                  (tokenObj[0]?.tokenData?.priceFetchFailures || 0) < PRICE_FETCH_THRESHOLD &&
                  isTokenOverThreshold(getLastHourPrices(tokenObj[0])[0]?.price, amount)
                ) {
                  uniqueTokensSet.add(mint);
                  const walletTokenInfo: TrackedToken = {
                    mint,
                    tokensOwned: amount,
                    isNotificationsOn: true,
                  };

                  // Update user token sets
                  usersWithWallet.forEach((userId: string) => {
                    const userTokens = userTokenMap.get(userId)!;
                    const token = getTrackedToken(userTokens, mint);
                    if (token) {
                      token.tokensOwned += walletTokenInfo.tokensOwned;
                    } else {
                      userTokens.add(walletTokenInfo);
                    }
                  });
                }
              } catch (error) {
                console.error(`Error processing token ${mint} for wallet ${wallet}:`, error);
              }
            })
          );
        } catch (error) {
          console.error(`Error processing wallet ${wallet}:`, error);
        }
      })
    );

    // Update Firestore (unchanged)
    await updateUserTrackedTokens(userTokenMap, usersSnapshot);

    // userTokenMap.forEach((tokens, userId) => {
    //   console.log(`User ID: ${userId}`);
    //   tokens.forEach((token) => {
    //     console.log(`  Token: ${JSON.stringify(token, null, 2)}`);
    //   });
    // });    
    totalUniqueTokens = uniqueTokensSet.size;
    const updateTrackedTokensFinishTime = Date.now()
    console.log(`✅ Finished fetching ${totalUniqueTokens} unique tokens in ${(updateTrackedTokensFinishTime - updateTrackedTokensStartTime) / 1000} sec.`);

    // 🔹 3️⃣ Process Each Token
    await Promise.all(
      Array.from(uniqueTokensSet).map(async (token) => {
        //console.log(`🔹 Processing token: ${token}`);
        try {
          const performanceStart = Date.now();

          const tokenFromFirestore: Token | undefined = (await getTokenCached(token, tokensCache))[0]
          if(tokenFromFirestore?.isDead == true){
            totalDeadTokensSkippedFirestore = totalDeadTokensSkippedFirestore + 1
            return;
          }
          const isTokenDead = await setTokenDead(token, tokenFromFirestore);

          if (isTokenDead) {
            totalDeadTokensSkipped = totalDeadTokensSkipped + 1
            return;
          }
          if((tokenFromFirestore?.tokenData?.priceFetchFailures || 0) >= PRICE_FETCH_THRESHOLD){
            totalSkippedPrice = totalSkippedPrice + 1
            return;
          }

          const isGetMetadata = false
          let blockchainMetadataFailures = 0
          let tokenMetadata = tokenFromFirestore?.tokenData?.tokenMetadata
          if(!tokenMetadata && (tokenFromFirestore?.tokenData?.metadataFetchFailures || 0) < 7 && isGetMetadata){
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

          // const data = await getTokenPrice(token, tokenFromFirestore);
          let data: GetPriceResponse | undefined = undefined

          if(tokenFromFirestore && tokenFromFirestore.tokenData?.pool){
            const poolData: PoolData | undefined = buildPoolDataFromTokenData(tokenFromFirestore.tokenData)
            if(poolData){
              data = await calculateTokenPrice(token, poolData, tokenFromFirestore.tokenData?.pool)
              if(!data){
                totalFailedPrice++;
                const tokenData = tokenFromFirestore?.tokenData || {}
                tokenData.priceFetchFailures = (tokenData?.priceFetchFailures || 0) + 1

                const updatedToken: Token = {
                  ...tokenFromFirestore,
                  tokenData
                }
                
                updateToken(token, updatedToken)
              }
            } else {
              totalFailedToBuildPoolData++
            }

          } else {
            tokensSkippedWithNoPoolData++
          }

          if(data) {
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
        } catch (error) {
          console.error(`Error processing token ${token}:`, error);
          throw error; // Ensure the promise rejects
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
         Total dead tokens skipped from firestore: ${totalDeadTokensSkippedFirestore}
          Total dead tokens skipped ${totalDeadTokensSkipped}
      🔍 Total Metadata Fetch Failures: ${totalFailedToGetMetadata} (${metadataFailureRate.toFixed(2)}%)
      ✅ Total Metadata Fetch Successes: ${totalSucceededToGetMetadata}
      ⏭️ Total Metadata Fetch Skipped: ${totalMetadataFetchSkipped} 
      🗄️ Total uncached pool data: ${totalUncachedPoolData} 
      🚫 Total skipped prices: ${totalSkippedPrice}
          Total skipped with no pool data: ${tokensSkippedWithNoPoolData}
          Total failed to build pool data: ${totalFailedToBuildPoolData}
      ❌ Total Price Fetch Failures: ${totalFailedPrice} (${priceFailureRate.toFixed(2)}%)
      💵 Total Price Fetch Successes: ${totalSucceedPrice}
    `;

    console.log(chalk.green(metricsSummary));

    return "✅ Unique tokens updated successfully." + metricsSummary
  } catch (error) {
    throw Error("❌ Error updating unique tokens:" + error)
  }
}
