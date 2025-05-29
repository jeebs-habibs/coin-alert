import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import OnboardingScreen from '../../components/OnboardingScreen';
import EditScreenInfo from '@/components/EditScreenInfo';
import { Text } from '@/components/Themed';

export default function TabOneScreen() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!authenticated) {
    return <OnboardingScreen onComplete={() => setAuthenticated(true)} />;
  }

  // Main app content here
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to the main app!</Text>
      <View style={styles.separator}/>
      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
