import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { theme } from '../constants/theme';
import { ThemeProvider } from 'react-native-elements';

// Firebase
import { auth } from '@/lib/firebase'; // adjust this import to your setup
import { onAuthStateChanged, User } from 'firebase/auth';

import OnboardingScreen from '../components/OnboardingScreen';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  // Listen for auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, []);

  if (user === undefined) {
    // Still checking auth state
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    // Not signed in
    return (
      <ThemeProvider theme={theme}>
        <OnboardingScreen onComplete={() => setUser(auth.currentUser)} />
      </ThemeProvider>
    );
  }

  // Signed in
  return (
    <ThemeProvider theme={theme}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.colors.primary,
          headerShown: useClientOnlyValue(false, true),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="home" color={color} />,
            headerRight: () => (
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <FontAwesome
                      name="bell"
                      size={25}
                      color={theme.colors.text}
                      style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
            ),
          }}
        />
        <Tabs.Screen
          name="two"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }: { color: string }) => <TabBarIcon name="user" color={color} />,
          }}
        />
      </Tabs>
    </ThemeProvider>
  );
}
