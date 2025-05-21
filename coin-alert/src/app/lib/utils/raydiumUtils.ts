import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { heliusConnection } from "../connection";
import { heliusPoolQueue } from "../taskQueue";
import { PoolData } from "./solanaUtils";

const RAYDIUM_SWAP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")

// Define a function to fetch and decode OpenBook accounts
export async function fetchRaydiumPoolAccountsFromToken(mint: PublicKey): Promise<PoolData | undefined> {
    //console.log("Getting raydium pool accounts for token: " + mint.toString())
    let accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
        new PublicKey(RAYDIUM_SWAP_PROGRAM),
        {
        filters: [
            {
                memcmp: {
                    offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
                    bytes: mint.toBase58(),
                    encoding: "base58"
                },
            },
            {
                memcmp: {
                    offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
                    bytes: NATIVE_MINT.toBase58(),
                    encoding: "base58"
                }
            }
        ],
        }
    ));

    if(!accounts?.length){
        accounts = await heliusPoolQueue.addTask(() => heliusConnection.getProgramAccounts(
            new PublicKey(RAYDIUM_SWAP_PROGRAM),
            {
            filters: [
                {
                    memcmp: {
                        offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
                        bytes: mint.toBase58(),
                        encoding: "base58"
                    },
                },
                {
                    memcmp: {
                        offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
                        bytes: NATIVE_MINT.toBase58(),
                        encoding: "base58"
                    },
                },
            ],
            }
        )) 
    }

    //console.log("found " + accounts.length + " pool accounts for token: " + mint.toString())
    if(accounts.length && accounts[0].account.data){
        const data = LIQUIDITY_STATE_LAYOUT_V4.decode(accounts[0].account.data)
        return {
            pool: "raydium",
            quoteVault: data.quoteVault,
            baseVault: data.baseVault,
            baseMint: data.baseMint,
            quoteMint: data.quoteMint,
            pubKey: accounts[0].pubkey
        }    
    }
    return undefined

}
