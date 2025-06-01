"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { SirenUser } from "../../../../shared/types/user";
import { auth, db } from "../lib/firebase/firebase";

interface AuthContextType {
  user: User | null;
  userData: SirenUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<SirenUser| null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
  
      if (authUser != null) {
        const userDocRef = doc(db, "users", authUser.uid);
  
        try {
          // Fetch user data
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data() as SirenUser);
          } else {
            // Create a new user document if it doesn't exist
            const newUserData: SirenUser = {
              uid: authUser.uid,
              email: authUser.email || "",
              wallets: [],
              alarmPreset: "center",
              isNotificationsOn: true
              // Add other default fields as needed
            };
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
          }
  
          // Listen for real-time changes
          const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as SirenUser);
            }
          });
  
          setLoading(false);
          return unsubscribeFirestore;
        } catch (error) {
          console.error("❌ Error fetching or creating user data:", error);
          setLoading(false);
        }
      } else {
        setUserData(null);
        setLoading(false);
      }
    });
  
    return () => unsubscribeAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}