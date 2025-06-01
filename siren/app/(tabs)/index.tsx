import LineChart, { DataPoint } from '@/components/Chart';
import Page from '@/components/Page';
import SingleSelectModal from '@/components/SingleSelectModal';
import TrackedTokenSection from '@/components/TrackedTokens';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import OnboardingScreen from '../../components/OnboardingScreen';
import { auth } from '../../lib/firebase';

export default function HomeScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme ?? 'light');

  const [checking, setChecking] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); // false = USD, true = SOL
  const [authenticated, setAuthenticated] = useState(false);
  const { authedUser, sirenUser } = useUser();

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
      <View style={styles.centered}>
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
      <Page>
      <View style={styles.header}>
        <Text style={styles.title}>{authedUser?.displayName}'s Port</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>


        <SingleSelectModal
        options={['USD', 'SOL']}
        selected={selectedCurrency}
        onSelect={setSelectedCurrency}
        title="Select Currency"
        getOptionLabel={(option) => option}
      />

      <LineChart data={sampleData} />
      <View style={styles.separator} />

      <TrackedTokenSection trackedTokens={sirenUser?.trackedTokens || []} currency={selectedCurrency} />

      </Page>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    currencyToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#ddd',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    toggleCircle: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: 'white',
      marginHorizontal: 6,
    },
    toggleCircleActive: {
      backgroundColor: 'black',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    separator: {
      marginVertical: theme.spacing.md,
      height: 1,
      width: '100%',
      backgroundColor: theme.colors.muted,
    },
  });
