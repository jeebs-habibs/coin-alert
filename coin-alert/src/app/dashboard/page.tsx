"use client";

import { getToken, onMessage } from "firebase/messaging";
import { useEffect } from "react";
import { messaging } from "../lib/firebase/firebase";


export default function Dashboard() {

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
    const saveFCMToken = async () => {
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
            // Save the token to Firestore or your database
          //   await fetch("/api/save-fcm-token", {
          //     method: "POST",
          //     body: JSON.stringify({ token: fcmToken }),
          //     headers: {
          //       "Content-Type": "application/json",
          //     },
          //   });
          }
        } catch (error) {
          console.error("Error getting FCM token:", error);
        }
      }
    };

    saveFCMToken();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Notifications will be sent every 10 seconds. Check your device!</p>
    </div>
  );
}
