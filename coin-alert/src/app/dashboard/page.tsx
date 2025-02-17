"use client";

import { PublicKey } from "@solana/web3.js";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import { Button } from "../components/Button";
import TripleToggleSwitch, { TogglePosition } from "../components/TripleToggle";
import { db, messaging } from "../lib/firebase/firebase";
import { updateUserData } from "../lib/firebase/userUtils";
import { areStringListsEqual, shortenString } from "../lib/utils/solanaUtils";
import styles from "../page.module.css";
import { useAuth } from "../providers/auth-provider";


export default function Dashboard() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");
  const [newAlarmPreset, setNewAlarmPreset] = useState<TogglePosition | undefined>("center")
  const {user, userData, loading} = useAuth();
  const [error, setError] = useState("");
  // const [notificationError, setNotificationError] = useState("")
  console.log(error)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/firebase-messaging-sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
     
    } else {
      console.error("No service worker")
    }
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
      if(messaging){
        try {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            console.log("Notification permission denied.");
            return;
          } else {
            console.log("Notifications are allowed")
          }
  
          const fcmToken = await getToken(messaging, {
            vapidKey: process.env.VAPID_KEY,
          });
  
          if (fcmToken) {
            console.log("FCM Token:", fcmToken);
            // setNotificationError("SUCCESS" + fcmToken)
            await saveTokenToFirestore(fcmToken)
          }
        } catch (error) {
          const e = "Error getting FCM token:" + error
          console.error(e);
          // setNotificationError(e)

        }
      }
    };

    requestPermissionAndSaveToken();
  });

  function saveChanges(){
    // this function will save new changes to database
    if(user != null && user.uid){
      updateUserData(user.uid, {...userData, wallets: wallets, alarmPreset: newAlarmPreset})
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
    return (!areStringListsEqual(userData.wallets, wallets) || newAlarmPreset != userData.alarmPreset)  
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
      <h1>Dashboard</h1>
      <TripleToggleSwitch labels={labels} onChange={(e: TogglePosition | undefined) => setNewAlarmPreset(e)} activePosition={newAlarmPreset}/>
      <h2>Wallet addresses</h2>
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
        <Button variant="grey" disabled={!didUserDataChange()} onClick={() => 
          {
            if(userData){
              setWallets(userData.wallets)
              setNewAlarmPreset(userData.alarmPreset)
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
