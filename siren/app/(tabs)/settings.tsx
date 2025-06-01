import Page from '@/components/Page';
import { getTheme } from '@/constants/theme';
import { getAuth, signOut } from 'firebase/auth';
import React from 'react';
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { Text } from 'react-native-elements';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'You have been signed out.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out.');
    }
  };

  const styles = getStyles(theme);

  return (
    <Page>

    
    <View style={styles.container}>
      <Text h4 style={styles.headingText}>Settings</Text>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
    </Page>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
    },
    headingText: {
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    settingRow: {
      marginTop: theme.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    signOutButton: {
      marginTop: theme.spacing.xl,
      backgroundColor: theme.colors.accent,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
    },
    signOutText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
