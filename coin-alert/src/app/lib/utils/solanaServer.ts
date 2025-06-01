import { PublicKey } from "@solana/web3.js"
import { GetPriceResponse, PoolType } from "../../../../../shared/types/token"
import { connection } from "../connection"
import { blockchainTaskQueue } from "../taskQueue"
import { getPriceFromBondingCurve } from "./pumpUtils"
import { BILLION, PoolData } from "./solanaUtils"

export async function getTokenAccountBalance(accountPubkey: PublicKey): Promise<number | null> {
  const account = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(accountPubkey))
  return account.value.uiAmount
}

function getPriceFromBalances(baseBalance: number | null, quoteBalance: number | null, baseMint: string, token: string, poolType: PoolType): GetPriceResponse | undefined {
  if (baseBalance == null || quoteBalance == null) {
    console.error(`Failed to fetch balances for token: ${token}`);
    return undefined;
  }

  let price = 0;
  if (quoteBalance !== 0 && baseBalance !== 0) {
    price = baseMint === token ? (quoteBalance / baseBalance) : (baseBalance / quoteBalance);
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

export async function calculateTokenPrice(token: string, poolData: PoolData | undefined, poolType: PoolType): Promise<GetPriceResponse | undefined> {
  if(poolType == "pump"){
      const bondingCurvePrice = await getPriceFromBondingCurve(token)
      if(bondingCurvePrice?.complete == false && bondingCurvePrice?.price){
        return bondingCurvePrice
      }
      return undefined
  }
  if(poolType == "pump-swap" && poolData){
    if (!poolData?.baseVault || !poolData?.quoteVault || !poolData?.baseMint || !poolData?.quoteVault) {
      //console.log(`ERROR: Insufficient token data for ${poolType} price calculation for token: ${token} on pump-swap`);
      return undefined;
    }
    const baseBalance = await getTokenAccountBalance(new PublicKey(poolData.baseVault))
    const quoteBalance = await getTokenAccountBalance(new PublicKey(poolData.quoteVault))
    return getPriceFromBalances(baseBalance, quoteBalance, poolData.baseMint.toString(), token, poolType)
  }
  if(poolType == "meteora" && poolData){
    if(poolData.baseLpVault && poolData.quoteLpVault && poolData.baseMint){
      const baseBalance = await getTokenAccountBalance(new PublicKey(poolData.baseLpVault))
      const quoteBalance = await getTokenAccountBalance(new PublicKey(poolData.quoteLpVault))
      return getPriceFromBalances(baseBalance, quoteBalance, poolData.baseMint.toString(), token, poolType)
    }
  }
  if(poolType == "raydium" && poolData){
    if (!poolData?.baseVault || !poolData?.quoteVault || !poolData?.baseMint || !poolData?.quoteVault) {
      //console.log(`ERROR: Insufficient token data for ${poolType} price calculation for token: ${token} on pump-swap`);
      return undefined;
    }
    const baseBalance = await getTokenAccountBalance(new PublicKey(poolData.baseVault))
    const quoteBalance = await getTokenAccountBalance(new PublicKey(poolData.quoteVault))
    return getPriceFromBalances(baseBalance, quoteBalance, poolData.baseMint.toString(), token, poolType)
  }

}
