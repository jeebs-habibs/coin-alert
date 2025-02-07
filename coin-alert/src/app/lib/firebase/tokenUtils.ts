import { db } from "../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Token } from "../firestoreInterfaces";
import { tokenConverter } from "../firestoreInterfaces";

// 🔹 Fetch a Token from Firestore
export async function getToken(tokenId: string): Promise<Token | undefined> {
  try {
    const tokenDocRef = doc(db, "uniqueTokens", tokenId).withConverter(tokenConverter);
    const tokenSnapshot = await getDoc(tokenDocRef);

    if (tokenSnapshot.exists()) {
      return tokenSnapshot.data(); // ✅ Typed as Token
    }
    
    return undefined;
  } catch (error) {
    console.error(`❌ Error fetching token ${tokenId}:`, error);
    return undefined;
  }
}
