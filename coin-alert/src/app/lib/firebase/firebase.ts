// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBhXEAWxOXuRgkFAQdkkN7WYI4j7iyZCPE",
  authDomain: "coinalert-1872e.firebaseapp.com",
  projectId: "coinalert-1872e",
  storageBucket: "coinalert-1872e.firebasestorage.app",
  messagingSenderId: "738018911031",
  appId: "1:738018911031:web:a5ea56051bd5a2423630b2",
  measurementId: "G-L5X3EPT8GM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app)
