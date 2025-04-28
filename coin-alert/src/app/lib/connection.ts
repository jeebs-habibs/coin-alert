import { Connection } from "@solana/web3.js";

if(!process.env.RPC_ENDPOINT?.length){
    throw new Error("ERROR: Cannot conncet to QuickNode RPC node.")
}

if(!process.env.HELIUS_ENDPOINT?.length){
    throw new Error("ERROR: Cannot conncet to Helius RPC node.")
}

export const connection = new Connection(process.env.RPC_ENDPOINT)
export const heliusConnection = new Connection(process.env.RPC_ENDPOINT)

// export const umi = createUmi(process.env.RPC_ENDPOINT)

