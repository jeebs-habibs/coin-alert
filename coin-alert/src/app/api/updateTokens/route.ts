import { NextResponse } from "next/server";
import { updateUniqueTokens } from "../../lib/updateUniqueTokens";

export async function GET(req: Request) {
  const apiKey = req.headers.get("Authorization");

  if (apiKey !== process.env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
  }
  
  try {
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
  
    return NextResponse.json({ message: "✅ Unique tokens updated successfully." });
  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return NextResponse.json({ error: "Failed to update unique tokens" }, { status: 500 });
  }
}
