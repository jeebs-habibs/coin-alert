import { web3 } from "@coral-xyz/anchor";
import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse, Token, TokenData } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { LAMPORTS_IN_SOL, MILLION } from "./solanaConstants";

const RAYDIUM_SWAP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")

interface RaydiumPoolData {
    quoteVault: web3.PublicKey;
    baseVault: web3.PublicKey;
    baseMint: web3.PublicKey;
    quoteMint: web3.PublicKey;
    pubKey: web3.PublicKey;
}

// Define a function to fetch and decode OpenBook accounts
async function fetchPoolAccountsFromToken(mint: PublicKey): Promise<RaydiumPoolData[]> {
    let accounts = await blockchainTaskQueue.addTask(() => connection.getProgramAccounts(
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
        accounts = await blockchainTaskQueue.addTask(() => connection.getProgramAccounts(
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

    console.log("found " + accounts.length + " pool accounts for token: " + mint.toString())

    
    return accounts.map((account) => {
        const data = LIQUIDITY_STATE_LAYOUT_V4.decode(account.account.data)
        return {
            quoteVault: data.quoteVault,
            baseVault: data.baseVault,
            baseMint: data.baseMint,
            quoteMint: data.quoteMint,
            pubKey: account.pubkey
        }
    });
}

function containsList(nestedLists: string[][], targetList: string[]): boolean {
    const targetSet = new Set(targetList);
  
    return nestedLists.some((list) => {
      return list.length === targetList.length && new Set(list).size === targetSet.size && [...targetSet].every((item) => new Set(list).has(item));
    });
}


export async function getTokenPriceRaydium(token: string, tokenFromFirestore: Token | undefined): Promise<GetPriceResponse | undefined> {
    console.log("In raydium function")
    let finalTokenData: TokenData = tokenFromFirestore?.tokenData || {}
    if(!finalTokenData?.baseVault || !finalTokenData?.quoteVault || !finalTokenData?.marketPoolId || !finalTokenData?.baseMint || !finalTokenData?.quoteMint){
        const timeBeforeFetchPoolAccounts = new Date().getTime()
        const poolAccounts = await fetchPoolAccountsFromToken(new PublicKey(token))
        const timeAfterFetchPoolAccounts = new Date().getTime()
        const timeTakenToFetchPoolAccounts = timeAfterFetchPoolAccounts - timeBeforeFetchPoolAccounts
        console.log("got raydium pool accounts in " + timeTakenToFetchPoolAccounts + " ms")
        finalTokenData = {
            ...finalTokenData, 
            baseVault: poolAccounts[0]?.baseVault?.toString(),
            baseMint: poolAccounts[0]?.baseMint?.toString(),
            quoteVault: poolAccounts[0]?.quoteVault?.toString(),
            quoteMint: poolAccounts[0]?.quoteMint?.toString(),
            marketPoolId: poolAccounts[0]?.pubKey?.toString(),

        }
    }


    if(!finalTokenData?.baseVault || !finalTokenData?.quoteVault || !finalTokenData?.marketPoolId){
        console.log("ERROR: No Raydium pool found for token: " + token)
        return undefined
    }

    const tokenVault = finalTokenData?.baseMint == token ? finalTokenData.baseVault : finalTokenData.quoteVault
    const solVault = finalTokenData?.baseMint == NATIVE_MINT.toString() ? finalTokenData.baseVault : finalTokenData.quoteVault

    const tokenVaultAmount = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(new PublicKey(tokenVault))) 
    const solVaultAmount = await blockchainTaskQueue.addTask(() => connection.getTokenAccountBalance(new PublicKey(solVault)))
    const convertedTokenAmount = parseFloat(tokenVaultAmount.value.amount)/MILLION
    const convertedSolAmount = parseFloat(solVaultAmount.value.amount)/LAMPORTS_IN_SOL

    console.log("Token Vault: " + convertedTokenAmount)
    console.log("Sol vault amount: " + convertedSolAmount)

    const price = convertedTokenAmount == 0 ? 0 : convertedSolAmount/convertedTokenAmount
    if(price){
        return {
            price: {price, timestamp: new Date().getTime()}, 
            tokenData: {...finalTokenData, pool: "raydium"}
        }
    } else {
        console.error("No Raydium price data found for token: " + token)
    }
}
