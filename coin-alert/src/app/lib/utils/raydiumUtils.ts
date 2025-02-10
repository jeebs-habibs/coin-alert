import { web3 } from "@coral-xyz/anchor";
import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { ParsedInstruction, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse, Token, TokenData } from "../firebase/tokenUtils";
import { blockchainTaskQueue } from "../taskQueue";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getMintTokenAccount, getWrappedSolAccount } from "./transactionUtils";
import { wrap } from "module";

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

function getRelevantRaydiumInnerInstructions(transaction: ParsedTransactionWithMeta | null, baseVault: string, quoteVault: string, mint: string){
    let tokenAmount = 0
    let solAmount = 0

    const wrappedSolAccount = getWrappedSolAccount(transaction)
    if(wrappedSolAccount == null){
        console.error("Error: Unable to find WSOL account")
    }
    const tokenAccount = getMintTokenAccount(transaction, mint)
    if(tokenAccount == null){
        console.error("Error: Unable to find account for mint: " + mint)
    }
    transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
        ii.instructions.forEach((iii) => {
            if(iii.programId.equals(TOKEN_PROGRAM_ID)){
                const parsedIx = iii as ParsedInstruction
                const parsedRaydiumTransfer: ParsedRaydiumTransfer = parsedIx.parsed
                console.log("parsedRaydiumTransfer.info.source: " + parsedRaydiumTransfer.info.source)
                console.log("parsedRaydiumTransfer.info.destination: " + parsedRaydiumTransfer.info.destination)
                console.log("wrapped sol account: " + wrappedSolAccount)
                // console.log("poolAccount: " + poolAccount.toString())
                if((parsedRaydiumTransfer.info.source == wrappedSolAccount && (parsedRaydiumTransfer.info.destination == baseVault || parsedRaydiumTransfer.info.destination == quoteVault))    
                    || (parsedRaydiumTransfer.info.destination == wrappedSolAccount && (parsedRaydiumTransfer.info.source == baseVault || parsedRaydiumTransfer.info.source == quoteVault))){  
                    solAmount = parseInt(parsedRaydiumTransfer.info.amount)/LAMPORTS_IN_SOL
                    console.log("Setting sol amount to: " + solAmount)

                } else if((parsedRaydiumTransfer.info.source == tokenAccount && (parsedRaydiumTransfer.info.destination == baseVault || parsedRaydiumTransfer.info.destination == quoteVault)) 
                    || (parsedRaydiumTransfer.info.destination == tokenAccount && (parsedRaydiumTransfer.info.source == baseVault || parsedRaydiumTransfer.info.source == quoteVault))) {
                    tokenAmount = parseInt(parsedRaydiumTransfer.info.amount)/MILLION
                    console.log("Setting token amount to: " + tokenAmount)
                }

                if(solAmount != 0 && tokenAmount != 0){
                    return tokenAmount != 0 ? solAmount/tokenAmount: 0  
                }
            }

        })
    })
    return null;
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
    if(!finalTokenData?.baseVault || !finalTokenData?.quoteVault || !finalTokenData?.marketPoolId){
        const timeBeforeFetchPoolAccounts = new Date().getTime()
        const poolAccounts = await fetchPoolAccountsFromToken(new PublicKey(token))
        const timeAfterFetchPoolAccounts = new Date().getTime()
        const timeTakenToFetchPoolAccounts = timeAfterFetchPoolAccounts - timeBeforeFetchPoolAccounts
        console.log("got raydium pool accounts in " + timeTakenToFetchPoolAccounts + " ms")
        finalTokenData = {...finalTokenData, baseVault: poolAccounts[0]?.baseVault?.toString()}
        finalTokenData = {...finalTokenData, quoteVault: poolAccounts[0]?.quoteVault?.toString()}
        finalTokenData = {...finalTokenData, marketPoolId: poolAccounts[0]?.pubKey?.toString()}
    } else {
        console.log("Using Raydium pool data from databse")
    }


    if(!finalTokenData?.baseVault || !finalTokenData?.quoteVault || !finalTokenData?.marketPoolId){
        console.log("ERROR: No Raydium pool found for token: " + token)
        return undefined
    }

    const timeBeforeGetSignatures = new Date().getTime()
    const result = await blockchainTaskQueue.addTask(() => connection.getSignaturesForAddress(new PublicKey(finalTokenData.marketPoolId!), {limit: 1}, "confirmed")) 
    const timeAfterGetSignatures = new Date().getTime()
    const timeTakenToGetSigs = timeAfterGetSignatures - timeBeforeGetSignatures

    const signature: string = result[0].signature
    console.log("Raydium signature for token: " + token)
    console.log("Got signature: " + signature + " in " + timeTakenToGetSigs + " ms")

    const transaction = await blockchainTaskQueue.addTask(() => connection.getParsedTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })) 
    console.log("Got transactions for token: " + token)
    
    if(transaction == null){
        console.error("ERROR: TRANSACTION IS NULL FOR TOKEN: " + token)
    }
    if(transaction?.meta?.err){
        console.error("ERROR: " + transaction?.meta?.err.toString())
    }
    //console.log(JSON.stringify(transaction))
    
    const previouslyParsedSigs = tokenFromFirestore?.prices?.map((sig) => sig.signatures || []) || []
    if(!containsList(previouslyParsedSigs, transaction?.transaction.signatures || [])){
        console.log("Looking at transaction: " + transaction?.transaction.signatures.join(",") + " for token: " + token)
        const price: number | null = getRelevantRaydiumInnerInstructions(transaction, finalTokenData?.baseVault, finalTokenData?.quoteVault, token)

        if(price){
            return {
                price: {price, timestamp: transaction?.blockTime || new Date().getTime(), signatures: transaction?.transaction.signatures}, 
                tokenData: {...finalTokenData, pool: "raydium"}
            }
        } else {
            console.error("No raydium instructions found")
        }
    } else {
        console.log("Skipping transaction because it already has been parsed")
    }
 
    
    return undefined
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
