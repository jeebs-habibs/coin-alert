import { NextRequest, NextResponse } from "next/server";
import { updateUniqueTokens } from "../../lib/updateUniqueTokens";

export async function GET(request: NextRequest) {
  // DISABLED FOR TESTING
  console.log(request)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', {
      status: 401,
    });
  }
  
  try {
    const timeBeforeUpdate = Date.now()
    const tokenUpdateResp = await updateUniqueTokens();
    const timeAfterUpdate = Date.now()

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
  
    console.log("✅ Unique tokens updated successfully in " + ((timeAfterUpdate - timeBeforeUpdate) / 1000) + " seconds.")
    return NextResponse.json({ message: "✅ Unique tokens updated successfully in " + ((timeAfterUpdate - timeBeforeUpdate) / 1000) + " seconds." + tokenUpdateResp });
  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return NextResponse.json({ error: "Failed to update unique tokens" }, { status: 500 });
  }
}
