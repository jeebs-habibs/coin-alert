import LineChart, { DataPoint } from '@/components/Chart';
import EditScreenInfo from '@/components/EditScreenInfo';
import { Text } from '@/components/Themed';
import TrackedTokenSection from '@/components/TrackedTokens';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { auth } from '../../lib/firebase';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme ?? 'light');

  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const { firebaseUser,  } = useUser();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  const styles = getStyles(theme);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!authenticated) {
    return <OnboardingScreen onComplete={() => setAuthenticated(true)} />;
  }

  const sampleData: DataPoint[] = [
    { timestamp: 1684000000, value: 300 },
    { timestamp: 1684003600, value: 280 },
    { timestamp: 1684007200, value: 320 },
    { timestamp: 1684010800, value: 310 },
    { timestamp: 1684014400, value: 350 },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Good morning {firebaseUser?.displayName}</Text>
      <View style={styles.separator} />

      <LineChart data={sampleData} />
      <TrackedTokenSection/>

      <EditScreenInfo path="app/(tabs)/index.tsx" />
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.lg,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    separator: {
      marginVertical: theme.spacing.md,
      height: 1,
      width: '80%',
      backgroundColor: theme.colors.muted,
    },
  });
