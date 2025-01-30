import { NextResponse } from "next/server";
import { updateUniqueTokens } from "../../lib/updateUniqueTokens";

export async function GET() {
  try {
    await updateUniqueTokens();
    return NextResponse.json({ message: "✅ Unique tokens updated successfully." });
  } catch (error) {
    console.error("❌ Error updating tokens:", error);
    return NextResponse.json({ error: "Failed to update unique tokens" }, { status: 500 });
  }
}
