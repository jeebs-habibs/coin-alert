// context/UserContext.tsx

import { auth, db } from '@/lib/firebase';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';

type UserContextType = {
  firebaseUser: FirebaseUser | null;
  userDoc: any | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  firebaseUser: null,
  userDoc: null,
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userDoc, setUserDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        const userRef = doc(db, 'users', user.uid);

        // Listen to Firestore user doc in real-time
        const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          setUserDoc(docSnap.exists() ? docSnap.data() : null);
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setUserDoc(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <UserContext.Provider value={{ firebaseUser, userDoc, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
