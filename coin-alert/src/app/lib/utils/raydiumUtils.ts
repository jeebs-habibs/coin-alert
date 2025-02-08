import { web3 } from "@coral-xyz/anchor";
import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { Connection, ParsedInstruction, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { GetPriceResponse, Token, TokenData } from "../firestoreInterfaces";

const RAYDIUM_SWAP_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8")
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112"

interface InitializeAccountIxData {
    type: string;
    info: InitializeAccountInfo;
}

interface InitializeAccountInfo {
    account: string;
    mint: string;
    owner: string;
    rentSysvar: string;
}

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

const connection = new Connection("https://frequent-bitter-dream.solana-mainnet.quiknode.pro/32c1136a100703f5645e948f6a0ed5a0b9435361");

function getRelevantRaydiumInnerInstructions(transaction: ParsedTransactionWithMeta | null, baseVault: string, quoteVault: string){
    let relevantIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = []
    transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
        ii.instructions.forEach((iii) => {
            if(iii.programId.equals(TOKEN_PROGRAM)){
                const parsedIx = iii as ParsedInstruction
                const parsedRaydiumTransfer: ParsedRaydiumTransfer = parsedIx.parsed
                // console.log("parsedRaydiumTransfer.info.source: " + parsedRaydiumTransfer.info.source)
                // console.log("parsedRaydiumTransfer.info.destination: " + parsedRaydiumTransfer.info.destination)
                // console.log("poolAccount: " + poolAccount.toString())
                if(parsedRaydiumTransfer.info.source == baseVault || parsedRaydiumTransfer.info.destination == baseVault
                     || parsedRaydiumTransfer.info.source == quoteVault || parsedRaydiumTransfer.info.destination == quoteVault ){
                    // console.log("YAHTZEE")
                    relevantIxs.push(iii)
                }
            }

        })
    })
    return relevantIxs
}

function getWrappedSolAccount(transaction: ParsedTransactionWithMeta | null): string | null{
    const instructions = transaction?.transaction.message.instructions || []
    for (const ix of instructions){
        if(ix.programId.equals(TOKEN_PROGRAM)){
            const parsedIx = ix as ParsedInstruction
            const parsedIxData: InitializeAccountIxData = parsedIx?.parsed
            if(parsedIxData?.info?.mint == WSOL_ADDRESS){
                return parsedIxData.info.account
            }
        }
    }
    return null
}

  // Define a function to fetch and decode OpenBook accounts
async function fetchPoolAccountsFromToken(mint: PublicKey): Promise<RaydiumPoolData[]> {
    let accounts = await connection.getProgramAccounts(
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
    );

    if(!accounts?.length){
        accounts = await connection.getProgramAccounts(
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
        );
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
    const result = await connection.getSignaturesForAddress(new PublicKey(finalTokenData?.marketPoolId), {limit: 1})
    const timeAfterGetSignatures = new Date().getTime()
    const timeTakenToGetSigs = timeAfterGetSignatures - timeBeforeGetSignatures
    console.log("Got sigs in " + timeTakenToGetSigs + " ms")

    const signatures = result.map((sig) => sig.signature)

    const transactions = await connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 });
    console.log("Got transactions")

    for (const transaction of transactions){
        //console.log(JSON.stringify(transaction))
        const previouslyParsedSigs = tokenFromFirestore?.prices?.map((sig) => sig.signatures || []) || []
        if(!containsList(previouslyParsedSigs, transaction?.transaction.signatures || [])){
            console.log("Looking at transaction: " + transaction?.transaction.signatures.join(","))
            const transactionRaydiumIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = getRelevantRaydiumInnerInstructions(transaction, finalTokenData?.baseVault, finalTokenData?.quoteVault)
            const wrappedSolAccount = getWrappedSolAccount(transaction)
            if(transactionRaydiumIxs?.length){
                console.log("Found a raydium transaction")
                let amountInSol = 0
                let tokenAmount = 0
                
                const raydiumIx1Parsed = transactionRaydiumIxs[0] as ParsedInstruction
                // console.log("Raydium ix 1: " + JSON.stringify(raydiumIx1Parsed))
                const raydiumIx2Parsed = transactionRaydiumIxs[1] as ParsedInstruction
                // console.log("Raydium ix 2: " + JSON.stringify(raydiumIx2Parsed))
                const parsedIx1Data: ParsedRaydiumTransfer = raydiumIx1Parsed.parsed
                const parsedIx2Data: ParsedRaydiumTransfer = raydiumIx2Parsed.parsed
    
                if(parsedIx1Data.info.source == wrappedSolAccount){
                    amountInSol = parseInt(parsedIx1Data.info.amount)/LAMPORTS_IN_SOL
                    tokenAmount = parseInt(parsedIx2Data.info.amount)/MILLION
                } else {
                    amountInSol = parseInt(parsedIx2Data.info.amount)/LAMPORTS_IN_SOL
                    tokenAmount = parseInt(parsedIx1Data.info.amount)/MILLION
                }
                const price = tokenAmount != 0 ? amountInSol/tokenAmount: 0  
                console.log("Returning price from raydium function")
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
 
    }
    return undefined
}