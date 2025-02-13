"use client";

import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase/firebase";

interface AuthContextType {
  user: User | null;
  userData: { wallets?: string[]; tokens?: string[] } | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ wallets?: string[]; tokens?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);

      if (authUser) {
        const userDocRef = doc(db, "users", authUser.uid);

        try {
          // 🔹 Fetch user data immediately on first load
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data() as { wallets?: string[]; tokens?: string[] });
          }

          // 🔹 Listen for real-time changes
          const unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as { wallets?: string[]; tokens?: string[] });
            }
          });

          setLoading(false); // ✅ Ensure loading state is set to false
          return unsubscribeFirestore; // Cleanup Firestore listener
        } catch (error) {
          console.error("❌ Error fetching user data:", error);
          setLoading(false); // ✅ Prevent infinite loading
        }
      } else {
        setUserData(null);
        setLoading(false); // ✅ Make sure loading stops when user is null
      }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
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
