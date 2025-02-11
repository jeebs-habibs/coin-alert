import { web3 } from "@coral-xyz/anchor";
import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { ParsedInstruction, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse, Token, TokenData } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMintTokenAccount, getWrappedSolAccount } from "./transactionUtils";
import { wrap } from "module";
import chalk from "chalk";

const RAYDIUM_SWAP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")

interface RaydiumTransferInfo {
    amount: string;
    authority: string;
    destination: string;
    source: string;
}

interface ParsedRaydiumTransfer {
    info: RaydiumTransferInfo;
    type: string;
}

interface RaydiumPoolData {
    quoteVault: web3.PublicKey;
    baseVault: web3.PublicKey;
    baseMint: web3.PublicKey;
    quoteMint: web3.PublicKey;
    pubKey: web3.PublicKey;
}


const LAMPORTS_IN_SOL = 1000000000
const MILLION = 1000000

function getRelevantRaydiumInnerInstructions(transaction: ParsedTransactionWithMeta | null, tokenData: TokenData, mint: string): number | null{
    let tokenAmount = 0
    let solAmount = 0
    // console.log("Base mint: " + tokenData.baseMint)
    // console.log("Base vault: " + tokenData.baseVault)
    // console.log("Quote vault: " + tokenData.quoteVault)
    // console.log("Quote mint: " + tokenData.quoteMint)

    // const wrappedSolAccount = getWrappedSolAccount(transaction)
    // if(wrappedSolAccount == null){
    //     console.error("Error: Unable to find WSOL account")
    // }
    // const tokenAccount = getMintTokenAccount(transaction, mint)
    // if(tokenAccount == null){
    //     console.error("Error: Unable to find account for mint: " + mint)
    // }
    for (const innerInstruction of transaction?.meta?.innerInstructions || []) {
        for(const instruction of innerInstruction.instructions) {
            if(instruction.programId.equals(TOKEN_PROGRAM_ID)){
                const parsedIx = instruction as ParsedInstruction
                const parsedRaydiumTransfer: ParsedRaydiumTransfer = parsedIx.parsed
                // console.log("parsedRaydiumTransfer.info.source: " + parsedRaydiumTransfer.info.source)
                // console.log("parsedRaydiumTransfer.info.destination: " + parsedRaydiumTransfer.info.destination)

                if(tokenData.baseMint && tokenData.baseVault && tokenData.quoteMint && tokenData.quoteVault){
                    if(parsedRaydiumTransfer.info.source == tokenData.baseVault || parsedRaydiumTransfer.info.destination == tokenData.baseVault){
                        if(tokenData.baseMint == NATIVE_MINT.toString()){
                            solAmount = parseInt(parsedRaydiumTransfer.info.amount)/LAMPORTS_IN_SOL
                            // console.log("Setting sol amount to: " + solAmount)
                        } else {
                            tokenAmount = parseInt(parsedRaydiumTransfer.info.amount)/MILLION
                            // console.log("Setting token amount to: " + tokenAmount)
                        }
                    }
                    
                    if(parsedRaydiumTransfer.info.source == tokenData.quoteVault || parsedRaydiumTransfer.info.destination == tokenData.quoteVault){
                        if(tokenData.quoteMint == NATIVE_MINT.toString()){
                            solAmount = parseInt(parsedRaydiumTransfer.info.amount)/LAMPORTS_IN_SOL
                            // console.log("Setting sol amount to: " + solAmount)
                        } else {
                            tokenAmount = parseInt(parsedRaydiumTransfer.info.amount)/MILLION
                            // console.log("Setting token amount to: " + tokenAmount)
                        }
                    }
                    
              
                } else {
                    console.error("Do not have any data on pools, doing nothing here for raydium")
                }
                
                if(solAmount != 0 && tokenAmount != 0){
                    return solAmount/tokenAmount
                }
                
                
                // // console.log("poolAccount: " + poolAccount.toString())
                // if((parsedRaydiumTransfer.info.source == wrappedSolAccount && (parsedRaydiumTransfer.info.destination == baseVault || parsedRaydiumTransfer.info.destination == quoteVault))    
                //     || (parsedRaydiumTransfer.info.destination == wrappedSolAccount && (parsedRaydiumTransfer.info.source == baseVault || parsedRaydiumTransfer.info.source == quoteVault))){  
                //     console.log("Setting sol amount to: " + solAmount)

                // } else if((parsedRaydiumTransfer.info.source == tokenAccount && (parsedRaydiumTransfer.info.destination == baseVault || parsedRaydiumTransfer.info.destination == quoteVault)) 
                //     || (parsedRaydiumTransfer.info.destination == tokenAccount && (parsedRaydiumTransfer.info.source == baseVault || parsedRaydiumTransfer.info.source == quoteVault))) {
                //     tokenAmount = parseInt(parsedRaydiumTransfer.info.amount)/MILLION
                //     console.log("Setting token amount to: " + tokenAmount)
                // }

            }

        }
    }
    return null
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

// } else {

//     return 

//     const timeBeforeGetSignatures = new Date().getTime()
//     const result = await blockchainTaskQueue.addTask(() => connection.getSignaturesForAddress(new PublicKey(finalTokenData.marketPoolId!), {limit: 1}, "confirmed")) 
//     const timeAfterGetSignatures = new Date().getTime()
//     const timeTakenToGetSigs = timeAfterGetSignatures - timeBeforeGetSignatures

//     const signature: string = result[0].signature
//     console.log("Raydium signature for token: " + token)
//     console.log("Got signature: " + signature + " in " + timeTakenToGetSigs + " ms")

//     const transaction = await blockchainTaskQueue.addTask(() => connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })) 
//     console.log("Got transactions for token: " + token)
    
//     if(transaction == null){
//         console.error("ERROR: TRANSACTION IS NULL FOR TOKEN: " + token)
//     }
//     if(transaction?.meta?.err){
//         console.error("ERROR: " + transaction?.meta?.err.toString())
//     }
//     //console.log(JSON.stringify(transaction))
    
//     const previouslyParsedSigs = tokenFromFirestore?.prices?.map((sig) => sig.signatures || []) || []
//     if(!containsList(previouslyParsedSigs, transaction?.transaction.signatures || [])){
//         console.log("Looking at transaction: " + transaction?.transaction.signatures.join(",") + " for token: " + token)
//         const price = getRelevantRaydiumInnerInstructions(transaction, finalTokenData, token)
//         if(price != null){
//             console.log(chalk.green("Got price of " + price + " from Raydium transaction."))
//             return {
//                 price: {price, timestamp: transaction?.blockTime || new Date().getTime(), signatures: transaction?.transaction.signatures}, 
//                 tokenData: {...finalTokenData, pool: "raydium"}
//             }
//         } else {
//             console.error("No price found for raydium instructions")
//         }
//     } else {
//         console.log("Skipping transaction because it already has been parsed")
//     }
 
    
//     return undefined
}

async function fetchTransactionsWithRetries(signatures: string[], retries = 3): Promise<any | null> {
    return blockchainTaskQueue.addTask(async () => {
      console.log(`🔄 Fetching transactions. Retries left: ${retries}`);
  
      try {
        const transactions = await connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 });
  
        if (!transactions || transactions.some(tx => tx === null)) {
          throw new Error("Received null transactions");
        }
  
        console.log(`✅ Successfully fetched transactions.`);
        return transactions; // ✅ Success: Return transactions
      } catch (error) {
        console.error(`❌ Error fetching transactions:`, error);
  
        if (retries > 0) {
          console.warn(`⚠️ Retrying in queue (${retries} retries left)...`);
          return fetchTransactionsWithRetries(signatures, retries - 1);
        }
  
        console.error(`❌ Failed after 3 attempts.`);
        return null; // ❌ Final failure
      }
    }, `Fetching transactions for ${signatures.length} signatures`);
  }
