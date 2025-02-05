import { web3 } from "@coral-xyz/anchor";
import {
    LIQUIDITY_STATE_LAYOUT_V4
} from "@raydium-io/raydium-sdk";

import { Connection, ParsedInstruction, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";

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


const LAMPORTS_IN_SOL = 1000000000
const MILLION = 1000000

const connection = new Connection("https://frequent-bitter-dream.solana-mainnet.quiknode.pro/32c1136a100703f5645e948f6a0ed5a0b9435361");

function getRelevantRaydiumInnerInstructions(transaction: ParsedTransactionWithMeta | null){
    let relevantIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = []
    // TODO: Update this to only pick out the two transfer instructions. Since Jup instructions are structured different than photon ones
    transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
        ii.instructions.forEach((iii) => {
            if(transaction?.transaction?.message?.instructions[ii.index].programId.equals(RAYDIUM_SWAP_PROGRAM) || iii.programId.equals(RAYDIUM_SWAP_PROGRAM)){
                relevantIxs.push(iii)
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
async function fetchPoolAccountsFromToken(quoteMint: PublicKey) {
    const accounts = await connection.getProgramAccounts(
        new PublicKey(RAYDIUM_SWAP_PROGRAM),
        {
        filters: [
            {
            memcmp: {
                offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
                bytes: quoteMint.toBase58(),
                encoding: "base58"
            },
            },
        ],
        }
    );

    return accounts.map((account) => {
        return {
            data: LIQUIDITY_STATE_LAYOUT_V4.decode(account.account.data), 
            pubKey: account.pubkey
        }
    });
}


export async function getTokenPriceRaydium(token: string) {
    console.log("In raydium function")
    const poolAccounts = await fetchPoolAccountsFromToken(new PublicKey(token))
    console.log("got pool accounts")
    
    if(!poolAccounts?.length){
        console.log("ERROR: No Raydium pool found for token: " + token)
        return undefined
    }

    const result = await connection.getSignaturesForAddress(poolAccounts[0].pubKey, {limit: 1})
    console.log("Got sigs")

    const signatures = result.map((sig) => sig.signature)

    const transactions = await connection.getParsedTransactions(signatures, { maxSupportedTransactionVersion: 0 });
    console.log("Got transactions")

    for (const transaction of transactions){
        console.log("Looking at transaction: " + transaction?.transaction.signatures.join(","))
        const transactionRaydiumIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = getRelevantRaydiumInnerInstructions(transaction)
        const wrappedSolAccount = getWrappedSolAccount(transaction)
        if(transactionRaydiumIxs?.length){
            console.log("Found a raydium transaction")
            let amountInSol = 0
            let tokenAmount = 0
            
            const raydiumIx1Parsed = transactionRaydiumIxs[0] as ParsedInstruction
            console.log("Raydium ix 1: " + JSON.stringify(raydiumIx1Parsed))
            const raydiumIx2Parsed = transactionRaydiumIxs[1] as ParsedInstruction
            console.log("Raydium ix 2: " + JSON.stringify(raydiumIx2Parsed))
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
            return price
        }
    }
    return undefined
}