// import { arrayUnion, doc, updateDoc } from "firebase/firestore";
// import {db, messaging} from "../src/app/lib/firebase/firebase"
// import { getToken, onMessage } from "firebase/messaging";
// import { useAuth } from "@/app/providers/auth-provider";

// // Handle background notifications
// // if(messaging){
// //   messaging.onBackgroundMessage((payload) => {
// //     console.log("📩 Background notification received:", payload);
  
// //     const notificationTitle = payload.notification.title;
// //     const notificationOptions = {
// //       body: payload.notification.body,
// //     };
  
// //     self.registration.showNotification(notificationTitle, notificationOptions);
// //   });
// // }

// const {user, loading, userData} = useAuth();


// // This function is called when the service worker is first installed
// self.addEventListener('install', (event) => {
//   console.log('Service worker installed');
//   // Optionally cache static assets here
// });

// self.addEventListener('activate', (event) => {
//     console.log('Service worker activated');
// });

// // This function is called when a push message is received
// if(messaging != null){
//   onMessage(messaging, (payload) => {
//     console.log('Message received: ', payload);
  
//     const notificationTitle = payload.notification?.title || 'New Notification';
//     const notificationBody = payload.notification?.body || 'You have a new message';
//     const notificationOptions = {
//       body: notificationBody,
//       icon: 'siren.png', // Path to your notification icon
//       vibrate: [200, 100, 200],
//       // Add other notification options as needed
//     };
  
//     // Display the notification
//     event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
//   });
// }


// // Request permission to receive notifications on the client-side.
// // Note: It will not always prompt the user for permissions, it might only be shown if the user has not yet allowed permissions
// self.addEventListener('push', (event) => {
//     console.log('Push notification received.');

//     // Handle the push event to display the notification; using the payload from the server.
//     const notificationTitle = 'New notification!';
//     const notificationOptions = {
//         body: 'You received a push notification',
//     };
//     event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));
// });


// // Handle background messages from FCM.
// self.addEventListener('message', (event) => {
//     console.log('Background message received:', event.data);
// });


// // getToken to get the subscription token and send it to the server for storage.
// if(messaging != null){
//   getToken(messaging, { vapidKey: process.env.VAPID_KEY }) // Replace with your vapid key
//   .then(async (currentToken) => {
//     if (currentToken && user) {
//       console.log('FCM token:', currentToken);
//       const userDocRef = doc(db, "users", user.uid);

//       await updateDoc(userDocRef, {
//         tokens: arrayUnion(currentToken), // Adds the token only if it doesn’t already exist
//       });
//       // Send the token to your server, storing it against the user's data.
//       // e.g., fetch('/api/save-fcm-token', {
//       //     method: 'POST',
//       //     headers: { 'Content-Type': 'application/json' },
//       //     body: JSON.stringify({ token: currentToken }),
//       //   });
//     } else {
//       console.log('No registration token available. Request permission to generate one.');
//     }
//   })
//   .catch((err) => {
//     console.error('An error occurred while retrieving token. ', err);
//   });

// }
