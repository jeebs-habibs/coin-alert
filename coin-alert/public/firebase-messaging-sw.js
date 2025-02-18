// import {firebase} from "firebase"
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBhXEAWxOXuRgkFAQdkkN7WYI4j7iyZCPE",
  authDomain: "auth.sirennotify.com",
  projectId: "coinalert-1872e",
  storageBucket: "coinalert-1872e.firebasestorage.app",
  messagingSenderId: "738018911031",
  appId: "1:738018911031:web:a5ea56051bd5a2423630b2",
  measurementId: "G-L5X3EPT8GM"
});

const messaging = firebase.messaging();



self.addEventListener('install', (event) => {
  console.log('Service worker installed');
  // Optionally cache static assets here
});

self.addEventListener('activate', (event) => {
    console.log('Service worker activated');
});




// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  try{
    console.log("📩 Background notification received:", payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: "Background notificiation",
      icon: payload?.notification?.icon || "sirenLogo.png"
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  } catch (e) {
    console.error(e)
    throw e
  }
});


  // console.log("About to get token")
  // getToken(messaging, { vapidKey: process.env.VAPID_KEY }) // Replace with your vapid key
  // .then(async (currentToken) => {
  //   if (currentToken && user) {
  //     console.log('FCM token:', currentToken);
  //     const userDocRef = doc(db, "users", user.uid);

  //     await updateDoc(userDocRef, {
  //       tokens: arrayUnion(currentToken), // Adds the token only if it doesn’t already exist
  //     });
  //     // Send the token to your server, storing it against the user's data.
  //     // e.g., fetch('/api/save-fcm-token', {
  //     //     method: 'POST',
  //     //     headers: { 'Content-Type': 'application/json' },
  //     //     body: JSON.stringify({ token: currentToken }),
  //     //   });
  //   } else {
  //     console.log('No registration token available. Request permission to generate one.');
  //   }
  // })
  // .catch((err) => {
  //   console.error('An error occurred while retrieving token. ', err);
  // });

  messaging.onMessage((payload) => {
    try{
      console.log("📩 Foreground notification received:", payload);
  
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: "Foreground noti",
        icon: payload?.notification?.icon || "sirenLogo.png"
      };
      self.registration.showNotification(notificationTitle, notificationOptions);
    } catch (e) {
      console.error(e)
      throw e
    }
  });
  



/*
 * Overrides push notification data, to avoid having 'notification' key and firebase blocking
 * the message handler from being called
 */
// self.addEventListener("push", (event) => {
//   console.log("Service Worker received a push event.");

//   if (!event.data) {
//     console.warn("⚠️ Push event has no data.");
//     return;
//   }

//   try {
//     const pushData = event.data.json(); // ✅ Properly parse JSON payload
//     console.log("📩 Parsed Push Data:", pushData);

//     // 🔹 Extract notification content
//     const notificationTitle = pushData.notification?.title || "New Notification";
//     const notificationOptions = {
//       body: pushData.notification?.body || "You have a new message.",
//       icon: pushData.notification?.icon || "/sirenLogo.png",
//       badge: pushData.notification?.badge || "/sirenLogo.png",
//     };

//     // 🔹 Show Notification
//     event.waitUntil(self.registration.showNotification(notificationTitle, notificationOptions));

//   } catch (error) {
//     console.error("❌ Error parsing push event data:", error);
//   }
// });


self.addEventListener('notificationclick', (event) => {
  // console.log('[firebase-messaging-sw.js] notificationclick ', event);

  // click_action described at https://github.com/BrunoS3D/firebase-messaging-sw.js#click-action
  if (event.notification.data && event.notification.data.click_action) {
    self.clients.openWindow(event.notification.data.click_action);
  } else {
    self.clients.openWindow(event.currentTarget.origin);
  }
  
  // close notification after click
  event.notification.close();
});