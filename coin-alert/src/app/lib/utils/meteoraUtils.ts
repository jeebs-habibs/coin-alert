import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { heliusPoolQueue } from "../taskQueue";
import { heliusConnection } from "../connection";
import * as borsh from "@coral-xyz/borsh";
import { PoolData } from "./solanaUtils";

export const METEORA_POOLS_PROGRAM = "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB"

const meteoraMarketSchema = borsh.struct([
// Discriminator (8 bytes, program-specific identifier for the account type)
  borsh.array(borsh.u8(), 8, "discriminator"),
  
  // Liquidity Pool Mint (PublicKey, 32 bytes, the mint address of the LP token)
  borsh.publicKey("lpMint"),
  
  // Token A Mint (PublicKey, 32 bytes, mint address of the first token)
  borsh.publicKey("tokenAMint"),
  
  // Token B Mint (PublicKey, 32 bytes, mint address of the second token)
  borsh.publicKey("tokenBMint"),
  
  // Vault A (PublicKey, 32 bytes, token account holding Token A reserves)
  borsh.publicKey("aVault"),
  
  // Vault B (PublicKey, 32 bytes, token account holding Token B reserves)
  borsh.publicKey("bVault"),
  
  // Vault A LP (PublicKey, 32 bytes, token account for LP tokens associated with Vault A)
  borsh.publicKey("aVaultLp"),
  
  // Vault B LP (PublicKey, 32 bytes, token account for LP tokens associated with Vault B)
  borsh.publicKey("bVaultLp"),
  
  // Admin Token Fee A (PublicKey, 32 bytes, account for collecting admin fees in Token A)
  borsh.publicKey("adminTokenFeeA"),
  
  // Admin Token Fee B (PublicKey, 32 bytes, account for collecting admin fees in Token B)
  borsh.publicKey("adminTokenFeeB"),
  
  // Authority (PublicKey, 32 bytes, program authority for managing the pool)
  borsh.publicKey("authority"),
  
  // Reserve A (u64, 8 bytes, amount of Token A in the pool)
  borsh.u64("reserveA"),
  
  // Reserve B (u64, 8 bytes, amount of Token B in the pool)
  borsh.u64("reserveB"),
  
  // LP Supply (u64, 8 bytes, total supply of LP tokens)
  borsh.u64("lpSupply"),
  
  // Trade Fee Numerator (u64, 8 bytes, numerator for trading fee, e.g., 2000)
  borsh.u64("tradeFeeNumerator"),
  
  // Trade Fee Denominator (u64, 8 bytes, denominator for trading fee, e.g., 100000)
  borsh.u64("tradeFeeDenominator"),
  
  // Protocol Trade Fee Numerator (u64, 8 bytes, numerator for protocol fee, e.g., 20000)
  borsh.u64("protocolTradeFeeNumerator"),
  
  // Protocol Trade Fee Denominator (u64, 8 bytes, denominator for protocol fee, e.g., 100000)
  borsh.u64("protocolTradeFeeDenominator"),
  
  // Curve Type (u8, 1 byte, indicates constant product or stable curve; 0 for constantProduct)
  borsh.u8("curveType"),
  
  // Status (u8, 1 byte, pool status, e.g., enabled/disabled)
  borsh.u8("status"),
  
  // Padding or Reserved (optional, to align or reserve space; adjust based on buffer size)
  borsh.array(borsh.u8(), 32, "padding"), // Adjust size as needed
]);

export async function fetchMeteoraPoolAccountsFromToken(mint: PublicKey): Promise<PoolData | undefined> {
    //console.log("Getting meteora pool accounts for token: " + mint.toString())
    let accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
        new PublicKey(METEORA_POOLS_PROGRAM),
        {
        filters: [
            {
                memcmp: {
                    offset: meteoraMarketSchema.offsetOf("tokenAMint"),
                    bytes: mint.toBase58(),
                    encoding: "base58"
                },
            },
            {
                memcmp: {
                    offset: meteoraMarketSchema.offsetOf("tokenBMint"),
                    bytes: NATIVE_MINT.toBase58(),
                    encoding: "base58"
                }
            }
        ],
        }
    ));

    if(!accounts?.length){
        accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
            new PublicKey(METEORA_POOLS_PROGRAM),
            {
            filters: [
                {
                    memcmp: {
                        offset: meteoraMarketSchema.offsetOf("tokenBMint"),
                        bytes: mint.toBase58(),
                        encoding: "base58"
                    },
                },
                {
                    memcmp: {
                        offset: meteoraMarketSchema.offsetOf("tokenAMint"),
                        bytes: NATIVE_MINT.toBase58(),
                        encoding: "base58"
                    },
                },
            ],
            }
        ))
    }

    if(accounts.length && accounts[0].account.data){
        const data = meteoraMarketSchema.decode(accounts[0].account.data)
        return {
            pool: "meteora",
            quoteVault: data.aVault,
            baseVault: data.bVault,
            quoteLpVault: data.aVaultLp,
            baseLpVault: data.bVaultLp,
            baseMint: data.tokenBMint,
            quoteMint: data.tokenAMint,
            pubKey: accounts[0].pubkey
        }    
    }
    return undefined

}
