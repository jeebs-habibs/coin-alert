import { ThemeProvider, useCustomTheme } from '@/context/ThemeContext';
import { UserProvider } from '@/context/UserContext';
import { auth, messaging } from '@/lib/firebase';
import { Stack } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import OnboardingScreen from '../components/OnboardingScreen';

export default function RootLayoutWrapper() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = messaging.onMessage(async remoteMessage => {
      console.log("📩 Foreground notification received:", remoteMessage);
  
      // Show native alert or custom in-app UI
      Alert.alert(
        remoteMessage.notification?.title || 'Notification',
        remoteMessage.notification?.body || 'You received a new message'
      );
    });
  
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <InnerApp user={user} setUser={setUser}/>
    </ThemeProvider>
  );
}

function InnerApp({ user, setUser }: { user: User | null; setUser: (u: User | null) => void }) {
  const { theme } = useCustomTheme();

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <OnboardingScreen />
      </View>
    );
  }

  return (

      <UserProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </UserProvider>


  );
}
