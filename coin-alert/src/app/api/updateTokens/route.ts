import { NextResponse } from "next/server";
import { updateUniqueTokens } from "../../lib/updateUniqueTokens";
import chalk from "chalk";
import { connection } from "@/app/lib/connection";
import { PublicKey } from "@solana/web3.js";

export async function GET() {
  try {
    const apiStartTime = new Date().getTime()
    await updateUniqueTokens();
  //   const result = await connection.getSignaturesForAddress(new PublicKey("B6GNKnaVeDrahttqvKyf58GUQYsqyQif6LdxaxHpynnv"), {limit: 1})
  //   connection.getParsedTransactions(result.map((a) => a.signature), { maxSupportedTransactionVersion: 0 }).then((val) =>{
  //     for (const transaction of val){
  //         if(transaction == null){ 
  //             console.log("transaction is null")
  //         } else {
  //             console.log(JSON.stringify(transaction))
  //         }
          
  //     }
  // })
  
    const apiEndTime = new Date().getTime()
    const timeTaken = apiEndTime - apiStartTime
    console.log(chalk.green("Updated unique tokens with prices in " + timeTaken / 1000 + " seconds."))
    return NextResponse.json({ message: "✅ Unique tokens updated successfully." });
  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return NextResponse.json({ error: "Failed to update unique tokens" }, { status: 500 });
  }
}
