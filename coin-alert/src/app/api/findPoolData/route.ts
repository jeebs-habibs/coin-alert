
import { connection } from "@/app/lib/connection";
import { Token, TokenData } from "@/app/lib/firebase/tokenUtils";
import { getRedisClient } from "@/app/lib/redis";
import { getTokenFromRedis, updateTokenInRedis } from "@/app/lib/redis/tokens";
import { retryOnServerError } from "@/app/lib/retry";
import { blockchainTaskQueue } from "@/app/lib/taskQueue";
import { fetchMeteoraPoolAccountsFromToken } from "@/app/lib/utils/meteoraUtils";
import { fetchPumpSwapAMM, getPriceFromBondingCurve } from "@/app/lib/utils/pumpUtils";
import { fetchRaydiumPoolAccountsFromToken } from "@/app/lib/utils/raydiumUtils";
import { PoolData } from "@/app/lib/utils/solanaUtils";
import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";


let tokensWithPoolData = 0
let tokensWithoutPoolData = 0
let tokenPoolDataFound = 0
let tokenPoolDataNotFound = 0
let tokensNotFoundInRedis = 0
let tokensDeadFromTransactions = 0
const poolFetchTimes: number[] = []

const MAX_TOKENS_TO_PROCESS = 200; // Adjust based on your average fetch time
const PRICE_FETCH_ERROR_THRESHOLD = 7;
const MONTH_IN_SECONDS = 60 * 60 * 24 * 28

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }

  try {
    const timeBeforeUpdate = Date.now();

    const redisClient = await getRedisClient();
    const tokensWithoutPoolType: [string, Token][] = [];

    const iter = redisClient.scanIterator({
      MATCH: "token:*",
      COUNT: 100,
    });

    const timeBeforeGettingTokens = Date.now()

    for await (const keys of iter) {
      for (const tokenKey of keys) {
        const tokenMint = tokenKey.split(":")[1];
        const tokenFromRedis = await getTokenFromRedis(tokenMint, redisClient);
        if (!tokenFromRedis) {
          tokensNotFoundInRedis++;
        }
        if (tokenFromRedis?.tokenData?.pool) {
          tokensWithPoolData++;
        }
        if (
          tokenFromRedis &&
          !tokenFromRedis?.tokenData?.pool &&
          tokenFromRedis?.isDead != true &&
          (tokenFromRedis?.tokenData?.priceFetchFailures || 0) < PRICE_FETCH_ERROR_THRESHOLD
           
        ) {
          tokensWithoutPoolType.push([tokenMint, tokenFromRedis]);
          tokensWithoutPoolData++;
        }
      }
    }

    const timeAfterGettingTokens = Date.now()
    const timeToGetTokensSeconds = (timeAfterGettingTokens - timeBeforeGettingTokens) / 1000
    console.log("Got " + tokensWithoutPoolType.length + " total tokens with missing pool data in " + timeToGetTokensSeconds  + " seconds.")
    // LIMIT how many tokens you process to stay under time limit
    const tokensToProcess = tokensWithoutPoolType.slice(0, MAX_TOKENS_TO_PROCESS);
    console.log("Getting pool data for tokens: " + tokensToProcess.map(a => a[0]).join(","))

    await Promise.all(tokensToProcess.map(async ([mint, token]) => {
      try {
        // First, see when the last transaction once and set isDead = true if its over 1 month.
        const mintPubkey = new PublicKey(mint)
        const signatures = await blockchainTaskQueue.addTask(() => connection.getSignaturesForAddress(mintPubkey, {limit: 1}))
        const mostRecentTransactionTimestampSeconds = signatures[0].blockTime
        if(mostRecentTransactionTimestampSeconds != null && mostRecentTransactionTimestampSeconds){
          const nowSeconds = Date.now() / 1000
          if((nowSeconds - mostRecentTransactionTimestampSeconds) > MONTH_IN_SECONDS){
            // Last transaction was from over a month ago, set it as dead
            // console.warn("Marking " + mint + " as dead")
            token.isDead = true
            tokensDeadFromTransactions++
            retryOnServerError(() => updateTokenInRedis(mint, token, redisClient));
            return 
          }
        }


        const timeBeforeFetchPoolData = Date.now();
        const poolData = await findTokenPoolData(mint);
        const timeAfterFetchPoolData = Date.now();
        poolFetchTimes.push(timeAfterFetchPoolData - timeBeforeFetchPoolData);
        if (poolData) {
          token.tokenData = updateTokenDataWithPoolData(token.tokenData || {}, poolData);
          tokenPoolDataFound++;
        } else {
          tokenPoolDataNotFound++;
          const existingPriceFetchFailures = token.tokenData?.priceFetchFailures || 0
          token.tokenData = {
            ...(token.tokenData || {}),
            priceFetchFailures: existingPriceFetchFailures + 1
          }
        }
        retryOnServerError(() => updateTokenInRedis(mint, token, redisClient));
      } catch (e) {
        console.error(`ERROR for token ${mint}:\n${e instanceof Error ? e.stack : e}`);
      }
    }));

    const timeAfterUpdate = Date.now();
    const avgPoolFetchTime = getAverage(poolFetchTimes);

    const message = `
      ✅ Pool data updated successfully in ${((timeAfterUpdate - timeBeforeUpdate) / 1000).toFixed(2)} seconds.
      Got tokens with missing pool data in ${timeToGetTokensSeconds} seconds.
      Tokens with pool data: ${tokensWithPoolData},
      without pool data: ${tokensWithoutPoolData},
      Tokens dead from transactions ${tokensDeadFromTransactions} 
      Token pool data fetch: ${tokenPoolDataFound} 
      Token pool data fetch fail: ${tokenPoolDataNotFound} 
      Average pool fetch time: ${avgPoolFetchTime} ms 
      Tokens not found in redis: ${tokensNotFoundInRedis} 
      Coverage percentage: ${(tokensWithPoolData / (tokensWithPoolData + tokensWithoutPoolData) * 100).toFixed(2)}%.
      Pool fetch success rate: ${(tokenPoolDataFound / (tokenPoolDataFound + tokenPoolDataNotFound) * 100).toFixed(2)}%.
      `

    console.log(message);
    return NextResponse.json({ message });
  } catch (error) {
    console.error("❌ Error updating pool data:", error);
    return NextResponse.json({ error: "Failed to update token pool data" }, { status: 500 });
  }
}



function getAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
}

function updateTokenDataWithPoolData(tokenData: TokenData, poolData: PoolData): TokenData {
  const updatedTokenData: TokenData = { ...tokenData };

  if (poolData.pool !== undefined) updatedTokenData.pool = poolData.pool;
  if (poolData.baseVault !== undefined) updatedTokenData.baseVault = poolData.baseVault.toString();
  if (poolData.baseLpVault !== undefined) updatedTokenData.baseLpVault = poolData.baseLpVault.toString();
  if (poolData.baseMint !== undefined) updatedTokenData.baseMint = poolData.baseMint.toString();
  if (poolData.quoteVault !== undefined) updatedTokenData.quoteVault = poolData.quoteVault.toString();
  if (poolData.quoteLpVault !== undefined) updatedTokenData.quoteLpVault = poolData.quoteLpVault.toString();
  if (poolData.quoteMint !== undefined) updatedTokenData.quoteMint = poolData.quoteMint.toString();
  if (poolData.pubKey !== undefined) updatedTokenData.marketPoolId = poolData.pubKey.toString();

  return updatedTokenData;
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


async function findTokenPoolData(token: string): Promise<PoolData | undefined> {
        if(token.endsWith("pump")){
          const bondingCurvePrice = await getPriceFromBondingCurve(token)
          if(bondingCurvePrice?.complete == false && bondingCurvePrice?.price){
            return {
              pool: "pump"
            }
          }
          if(bondingCurvePrice?.complete){
            // 2. If completed, check pump swap. Shouldn't have any pool data cached in db
            const pumpPoolData: PoolData | undefined = await fetchPumpSwapAMM(new PublicKey(token))
            if(pumpPoolData){
              return pumpPoolData
            }
          }
        }

  
        // 3. If cant find pump or raydium check meteora
        const meteoraPoolData: PoolData | undefined = await fetchMeteoraPoolAccountsFromToken(new PublicKey(token))
        if(meteoraPoolData){
            return meteoraPoolData
        }
  
        // 4. If cant find bonding curve account, check raydium
        const raydiumPoolData: PoolData | undefined = await fetchRaydiumPoolAccountsFromToken(new PublicKey(token))
        if(raydiumPoolData){
          return raydiumPoolData
        }
        
        return undefined
  
}

// 🔹 Fetch Token Price from External APIs
// async function getTokenPrice(token: string, tokenFromFirestore: Token | undefined): Promise<TokenData | undefined> {
//   try {
//     const poolType: PoolType | undefined = tokenFromFirestore?.tokenData?.pool
//     if(!poolType && token.endsWith("pump")){
//       // 1. Bonding curve commenting out tsince
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