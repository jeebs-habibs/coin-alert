import { web3 } from "@coral-xyz/anchor";
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';
import * as borsh from "@coral-xyz/borsh";
import { sha256 } from '@noble/hashes/sha256';
import { Connection, ParsedTransactionWithMeta, PartiallyDecodedInstruction, PublicKey } from "@solana/web3.js";
import { GetPriceResponse } from "../firestoreInterfaces";

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
const MILLION = 1000000
const LAMPORTS_IN_SOL = 1000000000


function getRelevantPumpInnerInstructions(transaction: ParsedTransactionWithMeta | null){
    let relevantIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = []
    transaction?.meta?.innerInstructions?.forEach((ii: web3.ParsedInnerInstruction) => {
        //console.log("--Inner instruction idx: "+ ii.index)
        ii.instructions.forEach((iii) => {
            //console.log('----Inner inner instruction program id: ' + iii.programId)            
            if(iii.programId.equals(PUMP_FUN_PROGRAM)){
                //console.log("Found a Pump trade instruction with programId: " + iii.programId)
                relevantIxs.push(iii)
            }
        })
    })
    return relevantIxs
  }
  

async function getBondingCurveAddress(token: string){
    const [bondingCurve] = PublicKey.findProgramAddressSync([Buffer.from("bonding-curve"), new PublicKey(token).toBytes()], PUMP_FUN_PROGRAM);
    return bondingCurve
}

export async function getTokenPricePump(token: string, connection: Connection): Promise<GetPriceResponse | undefined>{
    console.log("In pump function")
    const bondingCurveAccount = await getBondingCurveAddress(token)
    console.log("Got bonding curve account: " + bondingCurveAccount.toString())
    const signatures = await connection.getSignaturesForAddress(bondingCurveAccount, {limit: 1})
    const signatureList = signatures.map((a) => a.signature)

    const transactions = await connection.getParsedTransactions(signatureList, { maxSupportedTransactionVersion: 0 });

    for (const transaction of transactions){
        console.log("Reviewing pump transaction: " + transaction?.transaction.signatures.join(","))
        const transactionPumpIxs: (web3.ParsedInstruction | web3.PartiallyDecodedInstruction)[] = getRelevantPumpInnerInstructions(transaction)

        const buyDiscrimator = Buffer.from(sha256('global:buy').slice(0, 8));
        const sellDiscriminator = Buffer.from(sha256('global:sell').slice(0, 8));
        const pumpFunBuySellxs = transactionPumpIxs?.filter(ix =>  {
            const discriminator =  bs58.decode((ix as PartiallyDecodedInstruction).data).subarray(0, 8);
            return discriminator.equals(buyDiscrimator) || discriminator.equals(sellDiscriminator)
        })
        //console.log("Number of buySellIxs: " + pumpFunBuySellxs?.length)
        const tradeSchema = borsh.struct([
            borsh.u64("discriminator"),
            borsh.u64("amount"),
            borsh.u64("solAmount")
        ])

        for (let ix of pumpFunBuySellxs!) {
            ix = ix as PartiallyDecodedInstruction;
            //console.log("Pump fun ix data: " + ix.data)
            const ixDataArray = bs58.decode(ix.data);
            const ixData = tradeSchema.decode(ixDataArray);
            const tokenAmount: number = ixData.amount/MILLION;

            const bondingCurve = ix.accounts[3];
            const index = transaction?.transaction.message.accountKeys.findIndex((ix) => ix.pubkey.equals(bondingCurve))
            const preBalances = transaction?.meta?.preBalances || [];
            const postBalances = transaction?.meta?.postBalances || [];
            const solAmount = Math.abs(preBalances[index!] - postBalances[index!]) / LAMPORTS_IN_SOL;
            const price = tokenAmount != 0 ? solAmount/tokenAmount : 0
            console.log("returning price from pump function")
            return {price: {price, timestamp: transaction?.blockTime || new Date().getTime(), signatures: transaction?.transaction.signatures || []}, tokenData: { pool: "pump"}}
        }
    }
    return undefined
}