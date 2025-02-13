// firebase-messaging-sw.js

import { initializeApp } from "firebase/app";
import { getMessaging, onMessage } from "firebase/messaging";


firebase.initializeApp({
  apiKey: "AIzaSyBhXEAWxOXuRgkFAQdkkN7WYI4j7iyZCPE",
  authDomain: "coinalert-1872e.firebaseapp.com",
  projectId: "coinalert-1872e",
  storageBucket: "coinalert-1872e.firebasestorage.app",
  messagingSenderId: "738018911031",
  appId: "1:738018911031:web:a5ea56051bd5a2423630b2",
  measurementId: "G-L5X3EPT8GM"
});


initializeApp(firebaseConfig);
const messaging = getMessaging();


//This is for handling messages when the app is in the foreground.
onMessage(messaging, (payload) => {
  console.log('Message received. ', payload);
  // Customize notification here.
  const notificationTitle = payload.notification?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new message!',
    icon: '/siren.png' //replace with your icon path
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


//This is for handling messages when the app is in the background.
messaging.onBackgroundMessage((payload) => {
  console.log('[new-firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here.
  const notificationTitle = payload.notification?.title || 'Background Message';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a background message!',
    icon: '/siren.png' //replace with your icon path
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


//Optional: Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();

  // This looks to see if the URL was supplied in the data payload of the notification.
  const notificationUrl = event.notification.data?.url;

  //If there is a URL, open the tab.  Otherwise, open your app's home page.
  event.waitUntil(
    clients.openWindow(notificationUrl || '/')
  );
});
