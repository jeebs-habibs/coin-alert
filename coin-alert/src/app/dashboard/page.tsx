"use client";

import { PublicKey } from "@solana/web3.js";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import { Button } from "../components/Button";
import ToggleSwitch from "../components/ToggleSwitch";
import TripleToggleSwitch, { TogglePosition } from "../components/TripleToggle";
import { db, messaging } from "../lib/firebase/firebase";
import { updateUserData } from "../lib/firebase/userUtils";
import { areStringListsEqual, shortenString } from "../lib/utils/solanaUtils";
import styles from "../page.module.css";
import { useAuth } from "../providers/auth-provider";

async function unRegisterMultipleWorkers(){
  const workers = await navigator.serviceWorker.getRegistrations()
  if(workers.length > 1){
    for (const worker of workers){
      await worker.unregister()
    }
  } 
  if(workers.length == 0 || (workers.length == 1 && !workers[0].active)){
    if ('serviceWorker' in navigator) {
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
      console.error("No service worker")
      //alert("ERROR: Failed to register service worker")
    }
  }

}

export default function Dashboard() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");
  const [isNotificationsOn, setIsNotificationsOn] = useState<boolean>(true)
  const [newAlarmPreset, setNewAlarmPreset] = useState<TogglePosition | undefined>("center")
  const {user, userData, loading} = useAuth();
  const [error, setError] = useState("");
  // const [notificationError, setNotificationError] = useState("")
  console.log(error)

  useEffect(() => {
    unRegisterMultipleWorkers()
}, []);

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
      console.error("Error saving Solana wallet address")
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
        console.error("User is not authenticated. Cannot save token.");
        return;
      }

      if(user != null){
        console.log("Updating FCM tokens for User: " + user.uid)
        const userDocRef = doc(db, "users", user.uid);

        await updateDoc(userDocRef, {
          tokens: arrayUnion(token), // Adds the token only if it doesn’t already exist
        });
  
        console.log("✅ FCM token saved to Firestore!");
      } else {
        console.error("Cannot save FCM token since user is null")
      }


    } catch (error) {
      const e = "❌ Error saving FCM token to Firestore:" +error
      console.error(e);
      // setNotificationError(e)
    }
  };

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("📩 Foreground notification received:", payload);

      // Manually display the notification
      if(payload.notification?.title && payload.notification.body){
        new Notification(payload.notification.title, {
          body: payload.notification.body,
        });
      }
    });

    return () => unsubscribe();
  }, []);

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
  }, []); // 🔹 Runs only once when the component mounts
  


  function saveChanges(){
    // this function will save new changes to database
    if(user != null && user.uid){
      updateUserData(user.uid, {...userData, wallets: wallets, alarmPreset: newAlarmPreset, isNotificationsOn: isNotificationsOn})
    } else {
      console.error("Error saving data, user is not defined.")
    }

  }

  function didUserDataChange(){
    if(!userData){
      return true
    }
    console.log("userData.wallets" + userData.wallets.join(","))
    console.log("wallets" + wallets.join(","))
    console.log("newAlarmPreset: " + newAlarmPreset)
    console.log("userData.alarmPreset: " + userData.alarmPreset)
    console.log("Did user data change? " + (!areStringListsEqual(userData.wallets, wallets) || newAlarmPreset != userData.alarmPreset))
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
    },
    right: {
      title: "Noisier",
      value: "right",
      desc: "You will be notified on smaller price swings",
    },
    center: {
      title: "Standard",
      value: "center",
      desc: "Standard alarm sensitivity",
    },
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
      <h1>Notification Settings</h1>
      <ToggleSwitch label="Notifications on/off" isOn={isNotificationsOn === undefined ? true : isNotificationsOn} onToggle={(value) => setIsNotificationsOn(value)} />
      <div className={isNotificationsOn == false ? "disabled-div" : ""}>
      <TripleToggleSwitch labels={labels} onChange={(e: TogglePosition | undefined) => setNewAlarmPreset(e)} activePosition={newAlarmPreset}/>
      <h1 style={{margin: "10px"}}>Wallet addresses</h1>
      {/* <p className="red-text">{error}</p> */}
      <div className="w-full max-w-md">
        <div className="mb-4">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Enter new wallet address"
            className="textInput"
          />
          <Button
            disabled={!newWallet.length}
            onClick={handleAddWallet}
          >
            Add Wallet
          </Button>
        </div>

        <div>
          {wallets.map((wallet) => (
            <div key={wallet} className="flex justify-between items-center">
              <span className="m-2">{shortenString(wallet)}</span>
              <Button variant="danger" size="sm" onClick={() => handleRemoveWallet(wallet)}>
              <FaTrash  />
              </Button>
              
            </div>
          ))}
        </div>
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
      </main>
      
    </div>
  );
}
