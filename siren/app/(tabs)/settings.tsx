// SettingsScreen.tsx

import Page from '@/components/Page';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { convertAlarmConfigToString, NOISIER_ALARM_CONFIGS, QUIETER_ALARM_CONFIGS, STANDARD_ALARM_CONFIGS } from '@/lib/constants/alarmPresets';
import { auth, db } from '@/lib/firebase';
import * as Clipboard from 'expo-clipboard';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { Button, Text } from 'react-native-elements';
import { AlarmPreset, SirenUser } from '../../../shared/types/user';

const labels = {
  left: {
    title: "Quieter",
    value: "left",
    desc: "You will be notified on larger price swings",
    alarmInfo: convertAlarmConfigToString(QUIETER_ALARM_CONFIGS)
  },
  right: {
    title: "Noisier",
    value: "right",
    desc: "You will be notified on smaller price swings",
    alarmInfo: convertAlarmConfigToString(NOISIER_ALARM_CONFIGS),
  },
  center: {
    title: "Standard",
    value: "center",
    desc: "Standard alarm sensitivity",
    alarmInfo: convertAlarmConfigToString(STANDARD_ALARM_CONFIGS),
  },
};

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const { sirenUser, authedUser } = useUser();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPreset, setNotificationPreset] = useState<AlarmPreset>('center');
  const [isAlarmDescriptionVisible, setIsAlarmDescriptionVisible] = useState<boolean>(false);
  const [wallets, setWallets] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [copied, setCopied] = useState<boolean>(false)
  const [isAddingWallet, setIsAddingWallet] = useState(false);

  useEffect(() => {
    if (sirenUser) {
      setNotificationsEnabled(sirenUser.isNotificationsOn ?? true);
      setNotificationPreset(sirenUser.alarmPreset ?? 'center');
      setWallets(sirenUser.userWallets ?? []);
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

  const handleCopy = async () => {
    if(sirenUser?.userSirenWallet){
      await Clipboard.setStringAsync(sirenUser.userSirenWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  async function handleAddWallet() {
    const trimmed = newWallet.trim();
    if (!trimmed) return;
    const updated = [...wallets, trimmed];
    setWallets(updated);
    updateUserSetting('userWallets', updated);
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
    updateUserSetting('userWallets', updated);
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
          <Text style={styles.sectionTitle}>Notifications             
            <Switch
                style={styles.switch}
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: '#767577', true: theme.colors.primary }}
                thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
              />
            </Text>
          <Text style={styles.notificationLabel}>{labels[notificationPreset].desc}</Text>

          <Button
            title={isAlarmDescriptionVisible ? "Hide rules" : "Show rules"}
            type="clear"
            onPress={() => setIsAlarmDescriptionVisible(!isAlarmDescriptionVisible)}
            titleStyle={{
              color: '#888',
              textDecorationLine: 'underline',
              fontSize: 15,
            }}
            buttonStyle={{ paddingHorizontal: 0 }}
          />

          {isAlarmDescriptionVisible && (
            <View style={styles.alarmRuleContainer}>
              {labels[notificationPreset].alarmInfo.map((alarmRule) => (
                <Text key={alarmRule} style={styles.alarmRule}>
                  {alarmRule}
                </Text>
              ))}
            </View>
          )}

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
              </View>
            </View>
          )}
        </View>

        <View style={styles.separator} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracked Wallets</Text>
          <Text style={styles.trackedWalletsDescription}>You will receieve notifications for price changes on active tokens in the following wallets.</Text>
          {wallets.map((wallet, index) => (
            <View style={styles.walletsContainer} key={index}>
              <View style={styles.walletRow}>
                <Text style={styles.walletText}>{formatWalletAddress(wallet)}</Text>
                <Button
                  title="Remove"
                  type="clear"
                  onPress={() => handleConfirmRemoveWallet(wallet)}
                  buttonStyle={{ borderColor: theme.colors.danger }}
                  titleStyle={{ color: theme.colors.danger, fontSize: 14 }}
                />
              </View>
            </View>
          ))}
          <Button
            buttonStyle={styles.addWalletButton}
            titleStyle={styles.addWalletTitle}
            title="Add Wallet"
            onPress={() => setModalVisible(true)}
          />
        </View>

        <View style={styles.separator} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.email}>
            <Text style={{ fontWeight: 'bold', color: theme.colors.text }}>Email:</Text> <Text style={{color: theme.colors.text}}>{authedUser?.email}</Text>
          </Text>
          {
            sirenUser?.userSirenWallet ? 
            <View>
              <Text style={styles.subscriptionText}>To extend subscription, send .25 SOL for each month of access to address: {sirenUser.userSirenWallet}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
            </View> 
            : 
            <></>
          }

          <Text style={styles.subscribedUntil}>
                {sirenUser?.subscriptionEndTimesampMs
                  ? `Subscribed until: ${new Date(sirenUser.subscriptionEndTimesampMs).toLocaleDateString()}`
                  : `Free trial ends: ${new Date((sirenUser?.createdAtTimestampMs || 0) + (1000 * 60 * 60 * 24 * 7)).toLocaleDateString()}`}
              </Text>          
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
              editable={!isAddingWallet}
            />
            {isAddingWallet ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 10 }} />
            ) : (
              <Button title="Add" onPress={handleAddWallet} buttonStyle={styles.addWalletButton} titleStyle={styles.addWalletTitle} />
            )}
            <Button
              title="Cancel"
              type="clear"
              onPress={() => setModalVisible(false)}
              disabled={isAddingWallet}
              titleStyle={styles.cancelTitle}
            />
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
    },
    notificationLabel: {
      color: theme.colors.text
    },
    switch: {
      padding: theme.spacing.sm
    },
    email: {
      marginBottom: theme.spacing.md
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    trackedWalletsDescription: {
      color: theme.colors.text
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
    subscriptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    presetContainer: {
      marginTop: theme.spacing.sm,
    },
    alarmRuleContainer: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: '#ccc',
      padding: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    copyButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      minWidth: 50,
      maxWidth: 70
    },
    copyButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    alarmRule: {
      marginVertical: theme.spacing.xs,
      color: theme.colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    cancelTitle: {
      color: "#878787",
      textDecorationLine: "underline",
      fontSize: 16
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
    walletsContainer: {
      borderWidth: 1,
      padding: theme.spacing.sm,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      marginVertical: theme.spacing.sm
    },
    subscribedUntil: {
      marginVertical: theme.spacing.md,
      color: theme.colors.text
    },
    presetButton: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm
    },
    presetText: {
      color: theme.colors.primary,
    },
    selectedPresetButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm
    },
    selectedPresetText: {
      color: '#fff',
    },
    addWalletButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadius.sm
    },
    addWalletTitle: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    walletRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
