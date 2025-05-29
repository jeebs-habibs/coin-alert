// firebaseConfig.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: 'auth.sirennotify.com',
  projectId: 'coinalert-1872e',
  storageBucket: 'coinalert-1872e.appspot.com',
  messagingSenderId: '738018911031',
  appId: '1:738018911031:web:a5ea56051bd5a2423630b2',
  measurementId: 'G-L5X3EPT8GM',
};

// Initialize Firebase App safely (avoid duplicate-app error)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with React Native persistence
const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

// Firebase messaging is not supported in Expo
const messaging = null;

export { app, auth, db, messaging };
