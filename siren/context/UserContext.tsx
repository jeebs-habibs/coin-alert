import { auth, db } from '@/lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SirenUser } from '../../shared/types/user';

type UserContextType = {
  authedUser: User | null;
  sirenUser: SirenUser | null;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  authedUser: null,
  sirenUser: null,
  loading: true,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [authedUser, setAuthedUser] = useState<User | null>(null);
  const [sirenUser, setSirenUser] = useState<SirenUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthedUser(user);

      if (user) {
        const userRef = doc(db, 'users', user.uid);

        const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as SirenUser;
            setSirenUser(data);
          } else {
            setSirenUser(null);
          }
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setSirenUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <UserContext.Provider value={{ authedUser, sirenUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
