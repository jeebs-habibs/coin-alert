import * as borsh from "@coral-xyz/borsh";
import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { heliusConnection } from "../connection";
import { heliusPoolQueue } from "../taskQueue";
import { PoolData } from "./solanaUtils";

export const RAYDIUM_CPMM_PROGRAM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";

const raydiumPoolSchema = borsh.struct([
  // Discriminator (8 bytes, program-specific identifier for the account type)
  borsh.array(borsh.u8(), 8, "discriminator"),
  
  // AMM Config (PublicKey, 32 bytes, AMM configuration account)
  borsh.publicKey("ammConfig"),
  
  // Pool Creator (PublicKey, 32 bytes, creator of the pool)
  borsh.publicKey("poolCreator"),
  
  // Token 0 Vault (PublicKey, 32 bytes, token account holding token 0 reserves)
  borsh.publicKey("token0Vault"),
  
  // Token 1 Vault (PublicKey, 32 bytes, token account holding token 1 reserves)
  borsh.publicKey("token1Vault"),
  
  // LP Mint (PublicKey, 32 bytes, mint address of the LP token)
  borsh.publicKey("lpMint"),
  
  // Token 0 Mint (PublicKey, 32 bytes, mint address of token 0)
  borsh.publicKey("token0Mint"),
  
  // Token 1 Mint (PublicKey, 32 bytes, mint address of token 1)
  borsh.publicKey("token1Mint"),
  
  // Token 0 Program (PublicKey, 32 bytes, token program for token 0)
  borsh.publicKey("token0Program"),
  
  // Token 1 Program (PublicKey, 32 bytes, token program for token 1)
  borsh.publicKey("token1Program"),
  
  // Observation Key (PublicKey, 32 bytes, observation account)
  borsh.publicKey("observationKey"),
  
  // Auth Bump (u8, 1 byte, authority bump seed)
  borsh.u8("authBump"),
  
  // Status (u8, 1 byte, pool status)
  borsh.u8("status"),
  
  // LP Mint Decimals (u8, 1 byte, decimals for LP token)
  borsh.u8("lpMintDecimals"),
  
  // Mint 0 Decimals (u8, 1 byte, decimals for token 0)
  borsh.u8("mint0Decimals"),
  
  // Mint 1 Decimals (u8, 1 byte, decimals for token 1)
  borsh.u8("mint1Decimals"),
  
  // LP Supply (u64, 8 bytes, total supply of LP tokens)
  borsh.u64("lpSupply"),
  
  // Protocol Fees Token 0 (u64, 8 bytes, accumulated protocol fees for token 0)
  borsh.u64("protocolFeesToken0"),
  
  // Protocol Fees Token 1 (u64, 8 bytes, accumulated protocol fees for token 1)
  borsh.u64("protocolFeesToken1"),
  
  // Fund Fees Token 0 (u64, 8 bytes, accumulated fund fees for token 0)
  borsh.u64("fundFeesToken0"),
  
  // Fund Fees Token 1 (u64, 8 bytes, accumulated fund fees for token 1)
  borsh.u64("fundFeesToken1"),
  
  // Open Time (u64, 8 bytes, pool open timestamp)
  borsh.u64("openTime"),
  
  // Recent Epoch (u64, 8 bytes, recent epoch for the pool)
  borsh.u64("recentEpoch"),
  
  // Padding (31 x u64, 248 bytes, reserved space)
  borsh.array(borsh.u64(), 31, "padding"),
]);

export async function fetchRaydiumCpmmPoolAccountsFromToken(mint: PublicKey): Promise<PoolData | undefined> {
  let accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
    new PublicKey(RAYDIUM_CPMM_PROGRAM),
    {
      filters: [
        {
          memcmp: {
            offset: raydiumPoolSchema.offsetOf("token0Mint"),
            bytes: mint.toBase58(),
            encoding: "base58"
          },
        },
        {
          memcmp: {
            offset: raydiumPoolSchema.offsetOf("token1Mint"),
            bytes: NATIVE_MINT.toBase58(),
            encoding: "base58"
          }
        }
      ],
    }
  ));

  if (!accounts?.length) {
    accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
      new PublicKey(RAYDIUM_CPMM_PROGRAM),
      {
        filters: [
          {
            memcmp: {
              offset: raydiumPoolSchema.offsetOf("token1Mint"),
              bytes: mint.toBase58(),
              encoding: "base58"
            },
          },
          {
            memcmp: {
              offset: raydiumPoolSchema.offsetOf("token0Mint"),
              bytes: NATIVE_MINT.toBase58(),
              encoding: "base58"
            },
          },
        ],
      }
    ));
  }

  if (accounts.length && accounts[0].account.data) {
    const data = raydiumPoolSchema.decode(accounts[0].account.data);
    return {
      pool: "raydium-cpmm",
      quoteVault: data.token1Vault,
      baseVault: data.token0Vault,
      quoteLpVault: data.lpMint,
      baseLpVault: data.lpMint,
      baseMint: data.token0Mint,
      quoteMint: data.token1Mint,
      pubKey: accounts[0].pubkey
    };
  }
  return undefined;
}