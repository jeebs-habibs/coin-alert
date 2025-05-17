
import { Token, TokenData } from "@/app/lib/firebase/tokenUtils";
import { getRedisClient } from "@/app/lib/redis";
import { getTokenFromRedis, updateTokenInRedis } from "@/app/lib/redis/tokens";
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
let poolFetchTimes: number[] = []

const PRICE_FETCH_ERROR_THRESHOLD = 7

export async function GET(request: NextRequest) {
  // DISABLED FOR TESTING
  console.log(request)
//   const authHeader = request.headers.get('authorization');
//   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
//     return new Response('Unauthorized', {
//       status: 401,
//     });
//   }
  
  try {
    const timeBeforeUpdate = Date.now()
 
    const redisClient = await getRedisClient()
    const tokensWithoutPoolType: [string, Token][] = [];

    const iter = redisClient.scanIterator({
        MATCH: "token:*",
        COUNT: 100,
    });

    for await (const keys of iter) {
        for (const tokenKey of keys) {
            const tokenMint = tokenKey.split(":")[1]
            const tokenFromRedis = await getTokenFromRedis(tokenMint, redisClient)
            //console.log("Token from redis: " + JSON.stringify(tokenFromRedis))
            //console.log("Pooltype from redis: " + poolType)
            if (tokenFromRedis && tokenFromRedis?.tokenData?.pool && (tokenFromRedis?.tokenData?.priceFetchFailures || 0) < PRICE_FETCH_ERROR_THRESHOLD) {
                tokensWithoutPoolType.push([tokenMint, tokenFromRedis]);
                tokensWithoutPoolData++
            } else {
                tokensWithPoolData++
            }
        }

    }

    for (const token of tokensWithoutPoolType){
          const updatedToken = token[1]
          const timeBeforeFetchPoolData = Date.now()
          const poolData = await findTokenPoolData(token[0])
          const timeAfterFetchPoolData = Date.now()
          const timeTakenToFetchPoolDataMs = timeAfterFetchPoolData - timeBeforeFetchPoolData
          poolFetchTimes.push(timeTakenToFetchPoolDataMs)
          if(poolData){
            updatedToken.tokenData = updateTokenDataWithPoolData((token[1]?.tokenData || {}), poolData)
            updateTokenInRedis(token[0], updatedToken, redisClient)
            tokenPoolDataFound++
          } else {
            tokenPoolDataNotFound++
          }

          const now = Date.now()
          const timeElapsedMinutes = (now - timeBeforeUpdate) / 1000 /60
          if(timeElapsedMinutes > 4){
            console.warn("Greated then 4 mintues of runtime, approaching 5 minute limit")
          }

          if(timeElapsedMinutes > 4.75){
            console.error("ERROR: Breaking loop at 4.75 minutes. Approaching 5 minute limit")
            break
          }
    }


    const timeAfterUpdate = Date.now()

    const avgPoolFetchTime = getAverage(poolFetchTimes)

    const message = `✅ Pool data updated successfully in ${((timeAfterUpdate - timeBeforeUpdate) / 1000).toFixed(2)} seconds. ` +
    `Tokens with pool data: ${tokensWithPoolData}, ` +
    `without pool data: ${tokensWithoutPoolData}, ` +
    `Token pool data fetch: ${tokenPoolDataFound}` + 
    `Token pool data fetch fail: ${tokenPoolDataNotFound}` + 
    `Average pool fetch time: ${avgPoolFetchTime} ms` + 
    `Coverage percentage: ${(tokensWithPoolData / (tokensWithPoolData + tokensWithoutPoolData) * 100).toFixed(2)}%.` +
    `Pool fetch success rate: ${tokenPoolDataFound / (tokenPoolDataFound + tokenPoolDataNotFound)}`;
  
    console.log(message);
    return NextResponse.json({ message: message });
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