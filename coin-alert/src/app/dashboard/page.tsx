"use client";

import { PublicKey } from "@solana/web3.js";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import { db, messaging } from "../lib/firebase/firebase";
import { updateWallets } from "../lib/firestore";
import { useAuth } from "../providers/auth-provider";
import  styles from "../page.module.css"
import { FaTrash } from "react-icons/fa";
import { getUser, SirenUser } from "../lib/firebase/userUtils";



export default function Dashboard() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");
  const [sirenUser, setSirenUser] = useState<SirenUser | null>(null)
  const [isUserDataLoaded, setIsUserDataLoaded] = useState<boolean>(false)
  const {user, loading} = useAuth();
  const [error, setError] = useState("");
  // const [notificationError, setNotificationError] = useState("")

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
      console.log("In use effect")
      console.log("isUserDataLoaded" + isUserDataLoaded)
      if(user == null){
        console.error("USER IS NULL")
      } else {
        console.log("USER IS NOT NULL")
      }
      if(!isUserDataLoaded && user != null){
        getUser(user.uid)
        .then((data) => {
          console.log("Got user data")
          console.log(JSON.stringify(data))
          setSirenUser(data)
          if(data?.wallets){
            setWallets([...wallets, ...data.wallets])
          }
        })
        .catch((err) => {
          console.error("Error getting user data: " + err)
          setError(err.message)
      })
        .finally(() => {
          setIsUserDataLoaded(true)
          console.log("hit finally")
      });
      }


  
    }); // Runs when userId changes

  const handleAddWallet = async () => {
    if (!newWallet || !isValidSolanaAddress(newWallet) || wallets.includes(newWallet)) {
      setError("Error saving Solana wallet address")
      console.error("Error saving Solana wallet address")
      return;
    }

    const updatedWallets = [...wallets, newWallet];
    setWallets(updatedWallets);
    setNewWallet("");

    if (user) {
      await updateWallets(user.uid, updatedWallets);
    }
  };

  const handleRemoveWallet = async (wallet: string) => {
    const updatedWallets = wallets.filter((w) => w !== wallet);
    setWallets(updatedWallets);

    if (user) {
      await updateWallets(user.uid, updatedWallets);
    }
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

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return <h1>You must be signed in to view this page.</h1>;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
      <h1>Dashboard</h1>
      <h2>Wallet addresses</h2>
      <p className="red-text">{error}</p>
      <div className="w-full max-w-md">
        <div className="mb-4">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Enter new wallet address"
            className="textInput"
          />
          <button
            onClick={handleAddWallet}
            className="buttonSmall"
          >
            Add Wallet
          </button>
        </div>

        <div>
          {wallets.map((wallet) => (
            <div key={wallet} className="flex justify-between items-center">
              <span className="m-2">{wallet}</span>
              <button className="removeButton" onClick={() => handleRemoveWallet(wallet)}>
              <FaTrash  />
              </button>
              
            </div>
          ))}
        </div>
        {/* <p>FCM Token {fcmToken}</p>
        <button onClick={() => console.log("User wants notis lfg")}>Allow notifications</button> */}
        {/* <p>{notificationError}</p> */}
      </div>
      </main>
      
    </div>
  );
}
