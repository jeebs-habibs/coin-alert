"use client";

import { PublicKey } from "@solana/web3.js";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import { useEffect, useState } from "react";
import { db, messaging } from "../lib/firebase/firebase";
import { updateWallets } from "../lib/firestore";
import { useAuth } from "../providers/auth-provider";


export default function Dashboard() {
  const [wallets, setWallets] = useState<string[]>([]);
  const [newWallet, setNewWallet] = useState<string>("");
  const {user, loading, userData} = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/new-firebase-messaging-sw.js', {type: "module"})
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
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

      if(user){
        const userDocRef = doc(db, "users", user.uid);

        await updateDoc(userDocRef, {
          tokens: arrayUnion(token), // Adds the token only if it doesn’t already exist
        });
  
        console.log("✅ FCM token saved to Firestore!");
      }


    } catch (error) {
      console.error("❌ Error saving FCM token to Firestore:", error);
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
            await saveTokenToFirestore(fcmToken)
          }
        } catch (error) {
          console.error("Error getting FCM token:", error);
        }
      }
    };

    requestPermissionAndSaveToken();
  });

  if (loading) return <p>Loading...</p>;

  if (!user) {
    return <p>You must be signed in to view this page.</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Sending notis every 10 secs</p>
      <p className="mb-6">Manage your wallets below:</p>
      <p className="red-text">{error}</p>
      <div className="w-full max-w-md">
        <div className="mb-4">
          <input
            type="text"
            value={newWallet}
            onChange={(e) => setNewWallet(e.target.value)}
            placeholder="Enter new wallet address"
            className="w-full px-4 py-2 border rounded-md mb-2"
          />
          <button
            onClick={handleAddWallet}
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600"
          >
            Add Wallet
          </button>
        </div>

        <ul className="list-disc list-inside">
          {wallets.map((wallet) => (
            <li key={wallet} className="flex justify-between items-center">
              <span>{wallet}</span>
              <button
                onClick={() => handleRemoveWallet(wallet)}
                className="text-red-500 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
