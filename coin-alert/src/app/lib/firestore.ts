import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase/firebase";

// Fetch user data
export async function getUserData(userId: string) {
  try {
    const userDoc = doc(db, "users", userId);
    const docSnapshot = await getDoc(userDoc);
    return docSnapshot.exists() ? docSnapshot.data() : null;
  } catch (error) {
    console.error("Error fetching user data:", error);
    return null;
  }
}

// Create or update user data
export async function saveUserData(userId: string, data: { wallets: string[] }) {
  try {
    const userDoc = doc(db, "users", userId);
    await setDoc(userDoc, data, { merge: true }); // Merges with existing data
    console.log("User data saved successfully.");
  } catch (error) {
    console.error("Error saving user data:", error);
  }
}

// Update the wallets list (creates document if it doesn't exist)
export async function updateWallets(userId: string, wallets: string[]) {
  try {
    const userDoc = doc(db, "users", userId);
    const docSnapshot = await getDoc(userDoc);

    if (docSnapshot.exists()) {
      // Document exists, update the wallets
      await updateDoc(userDoc, { wallets });
    } else {
      // Document does not exist, create it
      await setDoc(userDoc, { wallets });
    }
    console.log("Wallets updated successfully.");
  } catch (error) {
    console.error("Error updating wallets:", error);
  }
}
