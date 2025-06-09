import { RecentNotification, SirenUser } from "../../../../../shared/types/user";
import { adminDB } from "./firebaseAdmin";

// 🔹 Fetch a User From Firestore (Using Admin SDK)
export async function getUser(uid: string): Promise<SirenUser | null> {
  try {
    console.log("Fetching user from Firestore: " + uid);
    const userDocRef = adminDB.collection("users").doc(uid);
    const userSnapshot = await userDocRef.get();

    if (!userSnapshot.exists) {
      return null;
    }

    return userSnapshot.data() as SirenUser;
  } catch (error) {
    console.error(`❌ Error fetching user ${uid}:`, error);
    return null;
  }
}

/**
 * Updates a user document with the specified fields while preserving all other data.
 * @param uid - The user's ID
 * @param updates - A partial SirenUser object with fields to update
 */
export async function updateUser(uid: string, updates: Partial<SirenUser>): Promise<void> {
  try {
    const userDocRef = adminDB.collection("users").doc(uid);

    // Check if the user exists before updating
    const userSnapshot = await userDocRef.get();
    if (!userSnapshot.exists) {
      console.warn(`⚠️ User ${uid} not found.`);
      return;
    }

    // Use Firestore's update method to only update the given fields
    await userDocRef.update(updates);

    console.log(`✅ Successfully updated user ${uid} with fields: ${Object.keys(updates).join(", ")}`);
  } catch (error) {
    throw Error(`❌ Error updating user ${uid}: ` + error);
  }
}


// 🔹 Fetch All Users from Firestore
export async function getAllUsers(): Promise<SirenUser[]> {
  try {
    const usersCollectionRef = adminDB.collection("users");
    const usersSnapshot = await usersCollectionRef.get();

    const users: SirenUser[] = usersSnapshot.docs.map((doc) => {
      //console.log("doc data: " + JSON.stringify(doc.data()))
      return doc.data() as SirenUser}
    );
    console.log(`✅ Fetched ${users.length} users from Firestore`);

    return users;
  } catch (error) {
    throw Error("❌ Error fetching users:" + error);
  }
}

/**
 * Updates the recentNotifications object for a given user.
 * @param uid - The user's ID
 * @param token - The token symbol (e.g., "SOL")
 * @param minutes - The time interval (key in the object)
 * @param notification - The RecentNotification object to store
 */
export async function updateRecentNotification(
  uid: string,
  token: string,
  minutes: number,
  notification: RecentNotification
) {
  try {
    const userDocRef = adminDB.collection("users").doc(uid);

    // 🔹 Fetch the current user document
    const userSnapshot = await userDocRef.get();
    if (!userSnapshot.exists) {
      console.warn(`⚠️ User ${uid} not found.`);
      return;
    }

    // 🔹 Get current user data
    const userData = userSnapshot.data() as SirenUser;
    const recentNotifications = { ...userData.recentNotifications };

    // 🔹 Generate key in format "SOL_5"
    const key = `${token}_${minutes}`;

    // 🔹 Update or insert new notification
    recentNotifications[key] = notification;

    // 🔹 Update Firestore document
    await userDocRef.update({ recentNotifications });

    console.log(`✅ Updated recentNotifications for user ${uid} at ${minutes} minutes for token ${token}.`);
  } catch (error) {
    throw Error(`❌ Error updating recentNotifications for user ${uid}:` + error)
  }
}
