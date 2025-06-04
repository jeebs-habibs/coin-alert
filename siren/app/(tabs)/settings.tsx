import Page from '@/components/Page';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-elements';
import { AlarmPreset, SirenUser } from '../../../shared/types/user';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const { sirenUser } = useUser();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPreset, setNotificationPreset] = useState<AlarmPreset>('center');
  const [wallets, setWallets] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWallet, setNewWallet] = useState('');

  useEffect(() => {
    if (sirenUser) {
      setNotificationsEnabled(sirenUser.isNotificationsOn ?? true);
      setNotificationPreset(sirenUser.alarmPreset ?? 'center');
      setWallets(sirenUser.wallets ?? []);
    }
  }, [sirenUser]);

  const updateUserSetting = async <K extends keyof SirenUser>(key: K, value: SirenUser[K]) => {
    if (!sirenUser) return;
    const ref = doc(db, 'users', sirenUser.uid);
    try {
      await updateDoc(ref, { [key]: value });
    } catch (err: any) {
      console.error('Error', `Failed to update key in firebase: ${err.message}`);
    }
  };

  const handleToggleNotifications = (value: boolean) => {
    setNotificationsEnabled(value);
    updateUserSetting('isNotificationsOn', value);
  };

  const handleChangePreset = (preset: AlarmPreset) => {
    setNotificationPreset(preset);
    updateUserSetting('alarmPreset', preset);
  };

  const handleAddWallet = () => {
    const trimmed = newWallet.trim();
    if (!trimmed) return;
    const updated = [...wallets, trimmed];
    setWallets(updated);
    updateUserSetting('wallets', updated);
    setNewWallet('');
    setModalVisible(false);
  };

  const handleConfirmRemoveWallet = (wallet: string) => {
    Alert.alert(
      'Remove Wallet',
      `Are you sure you want to remove ${formatWalletAddress(wallet)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => handleRemoveWallet(wallet),
        },
      ]
    );
  };

  const handleRemoveWallet = (wallet: string) => {
    const updated = wallets.filter((w) => w !== wallet);
    setWallets(updated);
    updateUserSetting('wallets', updated);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'You have been signed out.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign out.');
    }
  };

  const formatWalletAddress = (addr: string) =>
    addr.length <= 8 ? addr : `${addr.slice(0, 3)}...${addr.slice(-3)}`;

  const styles = getStyles(theme);

  return (
    <Page>
      <View style={styles.container}>
        <Text style={styles.headingText}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#767577', true: theme.colors.primary }}
              thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.presetContainer}>
              <View style={styles.presetButtons}>
                {(['left', 'center', 'right'] as AlarmPreset[]).map((option) => (
                  <Button
                    key={option}
                    title={option === 'left' ? 'Quiet' : option === 'center' ? 'Standard' : 'Loud'}
                    type={notificationPreset === option ? 'solid' : 'outline'}
                    onPress={() => handleChangePreset(option)}
                    containerStyle={styles.button}
                    buttonStyle={
                      notificationPreset === option
                        ? styles.selectedPresetButton
                        : styles.presetButton
                    }
                    titleStyle={
                      notificationPreset === option
                        ? styles.selectedPresetText
                        : styles.presetText
                    }
                  />
                ))}
                <Button
                  title="Customize"
                  type="clear"
                  onPress={() => Alert.alert('Custom Settings', 'Coming soon...')}
                  containerStyle={styles.button}
                  buttonStyle={styles.presetButton}
                  titleStyle={styles.customizeText}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.separator} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solana Wallets</Text>
          {wallets.map((wallet, index) => (
            <View key={index} style={styles.walletRow}>
              <Text style={styles.walletText}>{formatWalletAddress(wallet)}</Text>
              <Button
                title="Remove"
                type="clear"
                onPress={() => handleConfirmRemoveWallet(wallet)}
                buttonStyle={{ borderColor: theme.colors.danger }}
                titleStyle={{ color: theme.colors.danger }}
              />
            </View>
          ))}
          <Button buttonStyle={styles.addWalletButton} title="Add Wallet" onPress={() => setModalVisible(true)} />
        </View>

        <View style={styles.separator} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add Wallet</Text>
            <TextInput
              placeholder="Enter wallet address"
              placeholderTextColor="#999"
              value={newWallet}
              onChangeText={setNewWallet}
              style={styles.input}
            />
            <Button title="Add" onPress={handleAddWallet} buttonStyle={styles.addWalletButton} />
            <Button title="Cancel" type="clear" onPress={() => setModalVisible(false)} />
          </View>
        </View>
      </Modal>
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
      fontSize: 30,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xl,
    },
    section: {
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border ?? '#ccc',
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.background,

      // Drop shadow for iOS
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,

      // Drop shadow for Android
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    settingText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    presetContainer: {
      marginTop: theme.spacing.sm,
    },
    presetButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: theme.spacing.sm,
    },
    button: {
      marginRight: 8,
      marginBottom: 8,
    },
    presetButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary
    },
    presetText: {
      color: theme.colors.primary,
    },
    customizeText: {
      color: theme.colors.muted,
    },
    selectedPresetButton: {
      backgroundColor: theme.colors.primary,
    },
    selectedPresetText: {
      color: '#fff',
    },
    addWalletButton: {
      backgroundColor: theme.colors.primary,
    },
    walletRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    walletText: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    separator: {
      height: 1,
      marginVertical: theme.spacing.lg,
    },
    signOutButton: {
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
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
      width: '85%',
      padding: 20,
      backgroundColor: '#fff',
      borderRadius: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 6,
      padding: 10,
      marginBottom: 12,
      color: theme.colors.text,
    },
  });
