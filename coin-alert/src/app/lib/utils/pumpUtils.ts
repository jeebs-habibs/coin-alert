import * as borsh from "@coral-xyz/borsh";
import { PublicKey } from "@solana/web3.js";
import { connection } from "../connection";
import { GetPriceResponse } from "../firebase/tokenUtils";

const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P")

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
    console.log("In pump function")
    const bondingCurveAccount = await getBondingCurveAddress(token)
    console.log("Got bonding curve account: " + bondingCurveAccount.toString())

    const accountInfo = await connection.getParsedAccountInfo(bondingCurveAccount)

    const accountData = accountInfo.value?.data as Buffer;
    if (accountData) {
        const parsedData = decodeBuffer(accountData);
    
        console.log({
            virtualTokenReserves: parsedData.virtualTokenReserves.toString(),
            virtualSolReserves: parsedData.virtualSolReserves.toString(),
            realTokenReserves: parsedData.realTokenReserves.toString(),
            realSolReserves: parsedData.realSolReserves.toString(),
            tokenTotalSupply: parsedData.tokenTotalSupply.toString(),
            complete: parsedData.complete
        });

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