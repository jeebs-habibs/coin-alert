import * as borsh from "@coral-xyz/borsh";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { NATIVE_MINT } from "@solana/spl-token";
import { web3 } from "@coral-xyz/anchor";
import { parse } from "path";
import { getToken } from "next-auth/jwt";

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
const PUMP_SWAP_PROGRAM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA")

const pumpSwapSchema = borsh.struct([
    borsh.array(borsh.u8(), 8, "discriminator"), // 8 bytes (f19a6d0411b16dbc)
    borsh.u8("pool_bump"),         // 1 byte (255)
    borsh.u16("index"),            // 2 bytes (0)
    borsh.publicKey("creator"),    // 32 bytes
    borsh.publicKey("base_mint"),  // 32 bytes
    borsh.publicKey("quote_mint"), // 32 bytes
    borsh.publicKey("lp_mint"),    // 32 bytes
    borsh.publicKey("pool_base_token_account"), // 32 bytes
    borsh.publicKey("pool_quote_token_account"), // 32 bytes
    borsh.u64("lp_supply"),        // 8 bytes
]);

interface PumpPoolData{
    quoteVault: web3.PublicKey;
    baseVault: web3.PublicKey;
    baseMint: web3.PublicKey;
    quoteMint: web3.PublicKey;
    pubKey: web3.PublicKey;
}

async function getTokenAccountBalance(accountPubkey: PublicKey): Promise<number | null> {
    const account = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(accountPubkey))
    return account.value.uiAmount

}
  

// Define a function to fetch and decode OpenBook accounts
async function fetchPumpSwapAMM(mint: PublicKey): Promise<PumpPoolData | undefined>{
    let accounts = await blockchainTaskQueue.addTask(() => connection.getProgramAccounts(
        new PublicKey(PUMP_SWAP_PROGRAM),
        {
        filters: [
            {
                memcmp: {
                    offset: pumpSwapSchema.offsetOf("quote_mint") as number,
                    bytes: mint.toBase58(),
                    encoding: "base58"
                },
            },
            {
                memcmp: {
                    offset: pumpSwapSchema.offsetOf("base_mint") as number,
                    bytes: NATIVE_MINT.toBase58(),
                    encoding: "base58"
                }
            }
        ],
        }
    ));

    if(!accounts?.length){
        accounts = await blockchainTaskQueue.addTask(() => connection.getProgramAccounts(
            new PublicKey(PUMP_SWAP_PROGRAM),
            {
            filters: [
                {
                    memcmp: {
                        offset: pumpSwapSchema.offsetOf("base_mint") as number,
                        bytes: mint.toBase58(),
                        encoding: "base58"
                    },
                },
                {
                    memcmp: {
                        offset: pumpSwapSchema.offsetOf("quote_mint") as number,
                        bytes: NATIVE_MINT.toBase58(),
                        encoding: "base58"
                    },
                },
            ],
            }
        )) 
    }
    console.log("found " + accounts.length + " pump swap pool accounts for token: " + mint.toString())
    console.log("Account pubkey: " + accounts.at(0)?.pubkey)
    // console.log("Raw data: " + accounts.at(0)?.account.data)
    const firstAccount = accounts.at(0)
    if(firstAccount == undefined || firstAccount == null){
        return undefined
    }
    const data = firstAccount.account.data
    const pubKey = firstAccount.pubkey


    if(data){
      console.log(data.slice(0, 10).toString('hex'));

      console.log("Buffer length: " + data.length)
      const parsedData = pumpSwapSchema.decode(data)
      console.log(JSON.stringify(parsedData))
      return {
        quoteVault: new PublicKey(parsedData.pool_quote_token_account),
        baseVault: new PublicKey(parsedData.pool_base_token_account),
        baseMint: new PublicKey(parsedData.base_mint),
        quoteMint: new PublicKey(parsedData.quote_mint),
        pubKey: pubKey
      }
    }
    return undefined

    
    // return accounts.map((account) => {
    //     const data = pumpSwapSchema.decode(account.account.data)
    //     return {
    //         quoteVault: data.quoteVault,
    //         baseVault: data.baseVault,
    //         baseMint: data.baseMint,
    //         quoteMint: data.quoteMint,
    //         pubKey: account.pubkey
    //     }
    // });
}

class BondingCurveData {
    virtualTokenReserves: bigint;
    virtualSolReserves: bigint;
    realTokenReserves: bigint;
    realSolReserves: bigint;
    tokenTotalSupply: bigint;
    complete: boolean;

    constructor(fields: {
        virtualTokenReserves: bigint;
        virtualSolReserves: bigint;
        realTokenReserves: bigint;
        realSolReserves: bigint;
        tokenTotalSupply: bigint;
        complete: boolean;
    }) {
        this.virtualTokenReserves = fields.virtualTokenReserves;
        this.virtualSolReserves = fields.virtualSolReserves;
        this.realTokenReserves = fields.realTokenReserves;
        this.realSolReserves = fields.realSolReserves;
        this.tokenTotalSupply = fields.tokenTotalSupply;
        this.complete = fields.complete;
    }
}

// Define the Borsh schema (use `borsh.u64()`)
const dataSchema = borsh.struct([
    borsh.u64("discriminator"),
    borsh.u64("virtualTokenReserves"),
    borsh.u64("virtualSolReserves"),
    borsh.u64("realTokenReserves"),
    borsh.u64("realSolReserves"),
    borsh.u64("tokenTotalSupply"),
    borsh.bool("complete")
]);

// Function to decode the buffer
const decodeBuffer = (buffer: Buffer): BondingCurveData => {
    const decoded = dataSchema.decode(buffer);

    // Convert numeric fields to BigInt
    return new BondingCurveData({
        virtualTokenReserves: BigInt(decoded.virtualTokenReserves.toString()),
        virtualSolReserves: BigInt(decoded.virtualSolReserves.toString()),
        realTokenReserves: BigInt(decoded.realTokenReserves.toString()),
        realSolReserves: BigInt(decoded.realSolReserves.toString()),
        tokenTotalSupply: BigInt(decoded.tokenTotalSupply.toString()),
        complete: decoded.complete
    });
};
  

async function getBondingCurveAddress(token: string){
    const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(token).toBytes()], PUMP_FUN_PROGRAM);
    return bondingCurve
}

export async function getTokenPricePump(token: string): Promise<GetPriceResponse | undefined>{
    
    const pumpSwap = await fetchPumpSwapAMM(new PublicKey(token))
    //console.log("Pump swap pool " + JSON.stringify(pumpSwap))
    if(pumpSwap){
        const baseBalance = await getTokenAccountBalance(pumpSwap.baseVault)
        const quoteBalance = await getTokenAccountBalance(pumpSwap.quoteVault)
        if(baseBalance == null || quoteBalance == null){
            return undefined
        }
        var price = 0
        if(quoteBalance != 0 && baseBalance != 0){
            price = pumpSwap.baseMint.toString() == token ? (quoteBalance/baseBalance) : (baseBalance/quoteBalance)
        }
        const returnVal: GetPriceResponse = {
            price: {
                price: price, 
                timestamp: new Date().getTime()
            }, 
            tokenData: { pool: "pump-swap"}
        }
        console.log("Got price: " + JSON.stringify(returnVal) + " for token: " + token)
        return returnVal
    }
    const bondingCurveAccount = await getBondingCurveAddress(token)

    const accountInfo = await connection.getParsedAccountInfo(bondingCurveAccount)

    const accountData = accountInfo.value?.data as Buffer;
    if (accountData) {
        const parsedData = decodeBuffer(accountData);
    
        // console.log({
        //     virtualTokenReserves: parsedData.virtualTokenReserves.toString(),
        //     virtualSolReserves: parsedData.virtualSolReserves.toString(),
        //     realTokenReserves: parsedData.realTokenReserves.toString(),
        //     realSolReserves: parsedData.realSolReserves.toString(),
        //     tokenTotalSupply: parsedData.tokenTotalSupply.toString(),
        //     complete: parsedData.complete
        // });

        const virtualSolReserves: number = Number(parsedData.virtualSolReserves.valueOf())
        const virtualTokenReserves: number = Number(parsedData.virtualTokenReserves.valueOf())

        const price: number = virtualTokenReserves == 0 ? 0 : virtualSolReserves/virtualTokenReserves
        return {
            price: {
                price: price, 
                timestamp: new Date().getTime()
            }, 
            tokenData: { pool: "pump"}
        }
    }
}