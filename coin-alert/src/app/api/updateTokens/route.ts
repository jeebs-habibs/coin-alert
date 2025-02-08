import { NextResponse } from "next/server";
import { updateUniqueTokens } from "../../lib/updateUniqueTokens";
import chalk from "chalk";

export async function GET() {
  try {
    const apiStartTime = new Date().getTime()
    await updateUniqueTokens();
    const apiEndTime = new Date().getTime()
    const timeTaken = apiEndTime - apiStartTime
    console.log(chalk.green("Updated unique tokens with prices in " + timeTaken / 1000 + " seconds."))
    return NextResponse.json({ message: "✅ Unique tokens updated successfully." });
  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return NextResponse.json({ error: "Failed to update unique tokens" }, { status: 500 });
  }
}
