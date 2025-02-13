importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyBhXEAWxOXuRgkFAQdkkN7WYI4j7iyZCPE",
    authDomain: "coinalert-1872e.firebaseapp.com",
    projectId: "coinalert-1872e",
    storageBucket: "coinalert-1872e.firebasestorage.app",
    messagingSenderId: "738018911031",
    appId: "1:738018911031:web:a5ea56051bd5a2423630b2",
    measurementId: "G-L5X3EPT8GM"
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log("📩 Background notification received:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
