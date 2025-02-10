import { NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { ParsedInstruction, ParsedTransactionWithMeta, TokenBalance } from "@solana/web3.js"

interface InitializeAccountInfo {
    account: string;
    mint: string;
    owner: string;
    rentSysvar: string;
}

interface InitializeAccountIxData {
    type: string;
    info: InitializeAccountInfo;
}


/*

    Couple issues here. First sometimes the WSOL account is created in the transactions and sometimes it is passed in.
    Instead of trying to find WSOL and token accounts from transaction, make a function that takes in the mint in the instruction and figures out if its a token or WSOL account. We can make another call here if needed.

*/

export function getWrappedSolAccount(transaction: ParsedTransactionWithMeta | null, wallet?: string): string | null{

    const postTokenBalances = transaction?.meta?.postTokenBalances

    if(postTokenBalances){
        const solAccountIdx = postTokenBalances.find((val) => val.mint == NATIVE_MINT.toString())?.accountIndex
        if(solAccountIdx){
            const solAccount = transaction.transaction.message.accountKeys[solAccountIdx].pubkey
            return solAccount.toString()
        }
    }

    const instructions = transaction?.transaction.message.instructions || []
    for (const ix of instructions){
        if(ix.programId.equals(TOKEN_PROGRAM_ID)){
            const parsedIx = ix as ParsedInstruction
            const parsedIxData: InitializeAccountIxData = parsedIx?.parsed
            if(parsedIxData?.info?.mint == NATIVE_MINT.toString()){
                return parsedIxData.info.account
            }
        }
    }
    return null
}

export function getMintTokenAccount(transaction: ParsedTransactionWithMeta | null, mint: string): string | null {
    const postTokenBalances = transaction?.meta?.postTokenBalances

    if(postTokenBalances){
        const tokenAccountIdx = postTokenBalances.find((val) => val.mint = mint.toString())?.accountIndex || 0
        const tokenAccount = transaction.transaction.message.accountKeys[tokenAccountIdx].pubkey
        return tokenAccount.toString()
    }

    return null
}