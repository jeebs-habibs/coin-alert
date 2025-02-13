import { collection, doc, FirestoreDataConverter, getDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface SirenUser {
    uid: string;           // Firestore User ID (same as Firebase Auth UID)
    email?: string;
    wallets: string[];     // List of wallet addresses
    tokens?: string[];     // Optional FCM tokens for notifications
}

const userConverter: FirestoreDataConverter<SirenUser> = {
    toFirestore(user: SirenUser) {
      return {
        uid: user.uid,
        email: user.email,
        wallets: user.wallets,
        tokens: user.tokens || [],
      };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        uid: snapshot.id,
        email: data?.email,
        wallets: data.wallets,
        tokens: data.tokens || [],
      };
    },
  };
// 🔹 Fetch a User From Firestore
export async function getUser(uid: string): Promise<SirenUser | null> {
  try {
    const userDocRef = doc(db, "users", uid).withConverter(userConverter);
    const userSnapshot = await getDoc(userDocRef);

    if (userSnapshot.exists()) {
      return userSnapshot.data(); // ✅ Typed as User
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Error fetching user ${uid}:`, error);
    return null;
  }
}

// 🔹 Fetch All Users from Firestore
export async function getAllUsers(): Promise<SirenUser[]> {
    try {
      const usersCollectionRef = collection(db, "users").withConverter(userConverter);
      const usersSnapshot = await getDocs(usersCollectionRef);
  
      // ✅ Convert Firestore Documents into User Objects
      const users: SirenUser[] = usersSnapshot.docs.map((doc) => doc.data());
  
      console.log(`✅ Fetched ${users.length} users from Firestore`);
      return users;
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      return []; // Return an empty array if there's an error
    }
  }