import { Connection } from "@solana/web3.js";

if(!process.env.RPC_ENDPOINT?.length){
    throw new Error("ERROR: Cannot conncet to RPC node.")
}

export const connection = new Connection(process.env.RPC_ENDPOINT)