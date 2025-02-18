import { collection, doc, FirestoreDataConverter, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { AlarmType } from "../constants/alarmConstants";
import { db } from "../firebase/firebase";

interface RecentNotification {
  timestamp: number;
  percentageBreached: number;
  minutes: number;
  percentChange: number;
  alertType: AlarmType;
}

export type AlarmPreset = "left" | "right" | "center"

export interface SirenUser {
    uid: string;           // Firestore User ID (same as Firebase Auth UID)
    email?: string;
    wallets: string[];     // List of wallet addresses
    tokens?: string[];     // Optional FCM tokens for notifications
    alarmPreset: AlarmPreset;   // Either left, center, or right 
    isNotificationsOn: boolean;
    recentNotifications: Map<number, RecentNotification>;
}

const userConverter: FirestoreDataConverter<SirenUser> = {
    toFirestore(user: SirenUser) {
      return {
        uid: user.uid,
        email: user.email,
        wallets: user.wallets,
        tokens: user.tokens || [],
        alarmPreset: user.alarmPreset,
        isNotificationsOn: user.isNotificationsOn,
        recentNotifications: user.recentNotifications
      };
    },
    fromFirestore(snapshot, options) {
      const data = snapshot.data(options);
      return {
        uid: snapshot.id,
        email: data?.email,
        wallets: data.wallets,
        tokens: data.tokens || [],
        alarmPreset: data.alarmPreset,
        isNotificationsOn: data.isNotificationsOn,
        recentNotifications: data.recentNotifications
      };
    },
  };
// 🔹 Fetch a User From Firestore
export async function getUser(uid: string): Promise<SirenUser | null> {
  try {
    console.log("User uid to get from DB: " + uid)
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

// 🔹 Function to Update User Data
export async function updateUserData(uid: string, newData: Partial<SirenUser>) {
  try {
    const userDocRef = doc(db, "users", uid).withConverter(userConverter);

    // 🔹 Fetch the current user document
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists()) {
      console.warn(`⚠️ User ${uid} does not exist. Creating a new user document...`);
      const newUser: SirenUser = {
        uid,
        email: newData.email || "unknown@example.com",
        tokens: newData.tokens || [],
        wallets: newData.wallets || [],
        alarmPreset: newData.alarmPreset || "center",
        isNotificationsOn: newData.isNotificationsOn === undefined ? true : newData.isNotificationsOn,
        recentNotifications: newData.recentNotifications || new Map<number, RecentNotification>()
      };
      await setDoc(userDocRef, newUser);
      console.log(`✅ Created new user document for ${uid}.`);
      return;
    }

    // 🔹 Merge new data with existing user data
    await updateDoc(userDocRef, newData);
    console.log(`✅ Successfully updated user ${uid} in Firestore.`);
  } catch (error) {
    console.error(`❌ Error updating user ${uid}:`, error);
  }
}


/**
 * Updates the recentNotifications map for a given user.
 * @param uid - The user's ID
 * @param minutes - The time interval (key in the map)
 * @param notification - The RecentNotification object to store
 */
export async function updateRecentNotification(uid: string, minutes: number, notification: RecentNotification) {
  try {
    const userDocRef = doc(db, "users", uid).withConverter(userConverter);

    // 🔹 Fetch the current user document using the converter
    const userSnapshot = await getDoc(userDocRef);
    if (!userSnapshot.exists()) {
      console.warn(`⚠️ User ${uid} not found.`);
      return;
    }

    // 🔹 Convert Firestore object to a Map
    const userData = userSnapshot.data() as SirenUser;
    const recentNotifications = new Map<number, RecentNotification>(
      Object.entries(userData.recentNotifications || {}).map(([key, value]) => [Number(key), value])
    );

    // 🔹 Update the recentNotifications map
    recentNotifications.set(minutes, notification);

    // 🔹 Convert back to Firestore-friendly format (Object)
    const updatedRecentNotifications = Object.fromEntries(recentNotifications);

    // 🔹 Update Firestore document
    await updateDoc(userDocRef, { recentNotifications: updatedRecentNotifications });

    console.log(`✅ Updated recentNotifications for user ${uid} at ${minutes} minutes.`);
  } catch (error) {
    console.error(`❌ Error updating recentNotifications for user ${uid}:`, error);
  }
}
