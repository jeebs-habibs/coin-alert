import { PublicKey } from "@solana/web3.js"
import { blockchainTaskQueue } from "../taskQueue"
import { connection } from "../connection"
import { BILLION, PoolData } from "./solanaUtils"
import { GetPriceResponse, PoolType } from "../firebase/tokenUtils"

export async function getTokenAccountBalance(accountPubkey: PublicKey): Promise<number | null> {
  const account = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(accountPubkey))
  return account.value.uiAmount
}

export async function calculateTokenPrice(token: string, poolData: PoolData, poolType: PoolType): Promise<GetPriceResponse | undefined> {
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