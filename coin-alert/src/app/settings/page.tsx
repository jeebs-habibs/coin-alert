"use client";

import { PublicKey } from "@solana/web3.js";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaMinus, FaPlus } from "react-icons/fa";
import { SirenUser } from "../../../../shared/types/user";
import { areStringListsEqual, shortenString } from "../../../../shared/types/utils/displayStringUtils";
import { Button } from "../components/Button";
import ToggleSwitch from "../components/ToggleSwitch";
import TripleToggleSwitch, { TogglePosition } from "../components/TripleToggle";
import { convertAlarmConfigToString, NOISIER_ALARM_CONFIGS, QUIETER_ALARM_CONFIGS, STANDARD_ALARM_CONFIGS } from "../lib/constants/alarmConstants";
import { signOut } from "../lib/firebase/auth";
import { db, messaging } from "../lib/firebase/firebase";
import { useAuth } from "../providers/auth-provider";
import styles from "../settings/page.module.css";

async function unRegisterMultipleWorkers(){
  if ('serviceWorker' in navigator && !(await navigator.serviceWorker.getRegistration())?.active) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then((registration) => {
            console.log('Service Worker registered:', registration);
            //alert("Service worker registered")
        })
        .catch((error) => {
            console.error('Service Worker registration failed:', error);
            //alert("Service worker registration failed")
        });

  } else {
    console.log("No service worker or serice worker registered already")
    //alert("ERROR: Failed to register service worker")
  }

}

async function updateUserData(uid: string, newData: Partial<SirenUser>) {
  try {
    const userDocRef = doc(db, "users", uid)
    // 🔹 Fetch the current user document
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists) {
      console.warn(`⚠️ User ${uid} does not exist. Creating a new user document...`);
      const newUser: SirenUser = {
        uid,
        email: newData.email || "unknown@example.com",
        tokens: newData.tokens || [],
        wallets: newData.wallets || [],
        alarmPreset: newData.alarmPreset || "center",
        isNotificationsOn: newData.isNotificationsOn ?? true,
        recentNotifications: newData.recentNotifications || {},
      };
      await setDoc(userDocRef, newUser);
      console.log(`✅ Created new user document for ${uid}.`);
      return;
    }

    // 🔹 Merge new data with existing user data
    await updateDoc(userDocRef, newData);
    console.log(`✅ Successfully updated user ${uid} in Firestore.`);
  } catch (error) {
    throw Error(`❌ Error updating user ${uid}:` + error)
  }
}

export default function Settings() {
  const {user, userData, loading} = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user == null && !loading) {
      router.push("/");
    }
  }, [user, loading, router]);

  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");
  const [isNotificationsOn, setIsNotificationsOn] = useState<boolean>(true)
  const [newAlarmPreset, setNewAlarmPreset] = useState<TogglePosition | undefined>("center")
  
  const [error, setError] = useState("");
  // const [notificationError, setNotificationError] = useState("")
  console.log(error)

  useEffect(() => {
    unRegisterMultipleWorkers()
  });

    // 🔹 Function to Validate Solana Address
    const isValidSolanaAddress = (address: string): boolean => {
      try {
        new PublicKey(address);
        return true;
      } catch {
        return false;
      }
    };
  
    useEffect(() => {
      if (userData) {
        // Fetch user data
          if (userData?.wallets) {
            setWallets(userData.wallets);
          }
          if(userData?.alarmPreset){
            console.log("Set alarm preset to " + userData.alarmPreset)
            setNewAlarmPreset(userData.alarmPreset)
          }
          if(userData?.isNotificationsOn != undefined){
            setIsNotificationsOn(userData.isNotificationsOn)
          } else {
            setIsNotificationsOn(true)
          }
  
      }
    }, [userData]);

  const handleAddWallet = async () => {
    if (!newWallet || !isValidSolanaAddress(newWallet) || wallets.includes(newWallet)) {
      setError("Error saving Solana wallet address")
      alert("Error saving Solana address. Please verify the address is valid.")
      return;
    }

    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setNewWallet("");
  };

  const handleRemoveWallet = async (wallet: string) => {
    const updatedWallets = wallets.filter((w) => w !== wallet);
    setWallets(updatedWallets);
  };
  
  const saveTokenToFirestore = async (token: string) => {
    try {
      if (!loading && !user) {
        console.log("User is not authenticated. Cannot save token.");
        return;
      }

      if(user != null){
        //console.log("Updating FCM tokens for User: " + user.uid)
        const userDocRef = doc(db, "users", user.uid);

        await updateDoc(userDocRef, {
          tokens: arrayUnion(token), // Adds the token only if it doesn’t already exist
        });
  
        console.log("✅ FCM token saved to Firestore!");
      } else {
        console.log("Cannot save FCM token since user is null")
      }


    } catch (error) {
      const e = "❌ Error saving FCM token to Firestore:" +error
      console.error(e);
      // setNotificationError(e)
    }
  };

  useEffect(() => {
    const requestPermissionAndSaveToken = async () => {
      if (!messaging) return;
  
      try {
        // 🔹 Only ask for permission if it's "default" (not granted or denied)
        if (Notification.permission === "default") {
          console.log("Requesting notification permission...");
          const permission = await Notification.requestPermission();
  
          if (permission !== "granted") {
            console.log("❌ Notification permission denied.");
            return;
          }
          console.log("✅ Notifications are allowed.");
        } else {
          console.log(`🔹 Notifications already ${Notification.permission}, skipping request.`);
        }
  
        // 🔹 Get the FCM token
        const fcmToken = await getToken(messaging, {
          vapidKey: process.env.VAPID_KEY,
        });
  
        if (fcmToken) {
          console.log("📩 FCM Token:", fcmToken);
          saveTokenToFirestore(fcmToken);
        }
      } catch (error) {
        console.error("❌ Error getting FCM token:", error);
      }
    };
  
    requestPermissionAndSaveToken();
  }); // 🔹 Runs only once when the component mounts
  


  function saveChanges(){
    // this function will save new changes to database
    if(user != null && user.uid){
      updateUserData(user.uid, {...userData, uid: user.uid, wallets: wallets, alarmPreset: newAlarmPreset, isNotificationsOn: isNotificationsOn})
    } else {
      console.error("Error saving data, user is not defined.")
    }

  }

  function didUserDataChange(){
    if(!userData){
      return true
    }
    // console.log("userData.wallets" + userData.wallets.join(","))
    // console.log("wallets" + wallets.join(","))
    // console.log("newAlarmPreset: " + newAlarmPreset)
    // console.log("userData.alarmPreset: " + userData.alarmPreset)
    // console.log("Did user data change? " + (!areStringListsEqual(userData.wallets, wallets) || newAlarmPreset != userData.alarmPreset))
    return (!areStringListsEqual(userData.wallets, wallets) || newAlarmPreset != userData.alarmPreset || isNotificationsOn != userData?.isNotificationsOn)  
  }

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return <h1>You must be signed in to view this page.</h1>;
  }

  const labels = {
    left: {
      title: "Quieter",
      value: "left",
      desc: "You will be notified on larger price swings",
      alarmInfo: convertAlarmConfigToString(QUIETER_ALARM_CONFIGS)
    },
    right: {
      title: "Noisier",
      value: "right",
      desc: "You will be notified on smaller price swings",
      alarmInfo: convertAlarmConfigToString(NOISIER_ALARM_CONFIGS),
    },
    center: {
      title: "Standard",
      value: "center",
      desc: "Standard alarm sensitivity",
      alarmInfo: convertAlarmConfigToString(STANDARD_ALARM_CONFIGS),
    },
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.notification}>
          <h2>Notifications</h2>
          <ToggleSwitch isOn={isNotificationsOn === undefined ? true : isNotificationsOn} onToggle={(value) => setIsNotificationsOn(value)} />
        </div>

      <div className={isNotificationsOn == false ? "disabled-div" : ""}>
      <TripleToggleSwitch labels={labels} onChange={(e: TogglePosition | undefined) => setNewAlarmPreset(e)} activePosition={newAlarmPreset}/>
      <hr className={styles.hr} />

      
      {/* <p className="red-text">{error}</p> */}
      <div className={styles.walletAddresses}>
        <h2 style={{margin: "10px"}}>Wallet addresses</h2>
        <div className={styles.existingWallets}>
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Enter new address"
            className={styles.textInput}
          />
          <button
            disabled={!newWallet.length}
            onClick={handleAddWallet}
            className="iconButton"
          >
            <FaPlus size={30} color="#1b7982"/>
          </button>
        </div>

          {wallets.map((wallet) => (
            <div key={wallet} className={styles.existingWallets}>
              <div className={styles.walletDisplay}>{shortenString(wallet)}</div>
              <button className="iconButton" onClick={() => handleRemoveWallet(wallet)}>
                <FaMinus size={30} color="red"/>
              </button>
              
            </div>
          ))}
        
        </div>
        </div>
        <div className="w-full max-w-md">
        <Button variant="grey" disabled={!didUserDataChange()} onClick={() => 
          {
            if(userData){
              setWallets(userData.wallets)
              setNewAlarmPreset(userData.alarmPreset)
              setIsNotificationsOn(userData.isNotificationsOn === undefined ? true : userData.isNotificationsOn)
            }
          }}>
          Reset Changes
        </Button>
        <Button variant="primary" disabled={!didUserDataChange()} onClick={saveChanges}>
          Save Changes
        </Button>
        {/* <p>FCM Token {fcmToken}</p>
        <button onClick={() => console.log("User wants notis lfg")}>Allow notifications</button> */}
        {/* <p>{notificationError}</p> */}
    
      </div>
      <div >
          <Button 
            onClick={() => {
                signOut()
            }}
            variant="danger"
          >
            Sign out
          </Button>
        </div>
      </main>
      
    </div>
  );
}
