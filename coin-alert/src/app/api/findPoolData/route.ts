
import { NextRequest, NextResponse } from "next/server";
// // import { updateUniqueTokens } from "../../lib/updateUniqueTokens";
// import { GetPriceResponse, PoolType} from "@/app/lib/firebase/tokenUtils";
// // import { fetchPumpSwapAMM, getPriceFromBondingCurve } from "@/app/lib/utils/pumpUtils";
// import { PoolData } from "@/app/lib/utils/solanaUtils";
// import { calculateTokenPrice } from "@/app/lib/utils/solanaServer";
// import { PublicKey } from "@solana/web3.js";
// import { fetchMeteoraPoolAccountsFromToken } from "@/app/lib/utils/meteoraUtils";
// import { fetchRaydiumPoolAccountsFromToken } from "@/app/lib/utils/raydiumUtils";
import { getRedisClient } from "@/app/lib/redis";
import { getTokenFromRedis } from "@/app/lib/redis/tokens";


let tokensWithPoolData = 0
let tokensWithoutPoolData = 0

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
    const tokensWithoutPoolType: string[] = [];

    const iter = redisClient.scanIterator({
        MATCH: "token:*",
        COUNT: 100,
    });

    for await (const keys of iter) {
        for (const tokenKey of keys) {
            const tokenMint = tokenKey.split(":")[1]
            const rawData = await getTokenFromRedis(tokenMint, redisClient)
            console.log("Token from redis: " + JSON.stringify(rawData))
            const poolType = await redisClient.hGet(tokenKey, "poolType");
            console.log("Pooltype from redis: " + poolType)
            if (poolType === null || poolType === undefined) {
                tokensWithoutPoolType.push(tokenMint);
                tokensWithoutPoolData++
            } else {
                tokensWithPoolData++
            }
        }

    }

    console.log("Number of tokens without pool data: " + tokensWithoutPoolData)
    console.log("Number of tokens with pool data: " + tokensWithPoolData)
    console.log("% of tokens with pool data: " + ((tokensWithPoolData)/(tokensWithPoolData+tokensWithoutPoolData) * 100))

    const timeAfterUpdate = Date.now()

    console.log("✅ Updated pool data in " + ((timeAfterUpdate - timeBeforeUpdate) / 1000) + " seconds.")
    return NextResponse.json({ message: "✅ Pool data updated successfully in " + ((timeAfterUpdate - timeBeforeUpdate) / 1000) + " seconds."});
  } catch (error) {
    console.error("❌ Error updating pool data:", error);
    return NextResponse.json({ error: "Failed to update token pool data" }, { status: 500 });
  }
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


// // 🔹 Fetch Token Price from External APIs
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