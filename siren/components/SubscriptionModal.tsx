import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { PublicKey } from "@solana/web3.js";
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { Wallet } from '../../shared/types/user';

const MONTHLY_SUBSCRIPTION_COST_SOL = 0.25;
const SIREN_VAULT_WALLET = '5t8EQimJUKZ9qY9nw5qUg3nkQcPKqK3vmqxZm1vQY6u1';

interface Props {
  visible: boolean;
  setSubscriptionModal: (visible: boolean) => void;
  isSirenUserWalletAddressLoading: boolean;
}

const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

export default function SubscriptionModal({ visible, setSubscriptionModal, isSirenUserWalletAddressLoading }: Props) {
  const { authedUser, sirenUser } = useUser();
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const styles = getStyles(theme);

  const [walletAddress, setWalletAddress] = useState('');
  const [months, setMonths] = useState('12');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const totalSOL = (parseInt(months) || 0) * MONTHLY_SUBSCRIPTION_COST_SOL;

  const handleCopy = async () => {
    if(sirenUser?.userSirenWallet){
      await Clipboard.setStringAsync(sirenUser.userSirenWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

  };

  const handleVerify = async () => {
    if (!authedUser || !sirenUser?.userSirenWallet) return;
    try {
      setVerifying(true);
      setError('');
      const trimmed = walletAddress.trim();
      const userJwt = await authedUser.getIdToken();
      const url = `https://www.sirennotify.com/api/updateSubscriptionForWallet?sourceWallet=${encodeURIComponent(
        trimmed
      )}&destinationWallet=${encodeURIComponent(sirenUser.userSirenWallet)}&userId=${encodeURIComponent(authedUser.uid)}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      });

      if (!response.ok) {
        setError('Could not verify wallet. Please ensure the SOL was sent and try again.');
        return;
      }

      const res: Wallet = await response.json();
      const subscriptionEndDateForWallet = res?.subscriptionEndTimesampMs
        ? new Date(res.subscriptionEndTimesampMs)
        : undefined;

      if (subscriptionEndDateForWallet) {
        setSubscriptionModal(false);
      } else {
        setError('Could not verify wallet. Please ensure the SOL was sent and try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const isVerifyButtonDisabled =
    !isValidSolanaAddress(walletAddress) ||
    verifying ||
    sirenUser?.userWallets?.map((wallet) => wallet.pubkey).includes(walletAddress);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {}}
      hardwareAccelerated
      presentationStyle="overFullScreen"
    >
      {
        isSirenUserWalletAddressLoading ?       <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View> : 
      <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.title}>Activate Your Subscription</Text>

        <Text style={styles.header}>PAY</Text>
        <Text style={styles.label}>Send the following amount:</Text>
        <View style={styles.monthRow}>
          <Text style={[styles.step, styles.bold]}>{totalSOL} SOL</Text>
          <Text style={styles.step}> for </Text>
          <TextInput
            style={styles.monthInput}
            keyboardType="numeric"
            value={months}
            onChangeText={setMonths}
          />
          <Text style={styles.step}> month(s)</Text>
        </View>

        <Text style={styles.label}>To this wallet address:</Text>
        <View style={styles.copyRow}>
          <Text style={styles.wallet}>{sirenUser?.userSirenWallet}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
            <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.verifyButton
          ]}
          onPress={handleVerify}
        >
          {verifying ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              style={
                styles.verifyText
              }
            >
              Verify
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
      }
      
    </Modal>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: {
      width: '90%',
      backgroundColor: theme.colors.background,
      padding: 20,
      borderRadius: theme.borderRadius.xl,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    header: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginTop: 20,
      marginBottom: 8,
    },
    step: {
      fontSize: 16,
      color: theme.colors.text,
    },
    bold: {
      fontWeight: 'bold',
    },
    label: {
      marginTop: 6,
      color: theme.colors.text,
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.muted,
      padding: 8,
      borderRadius: 8,
      marginTop: 4,
      marginBottom: 12,
      color: theme.colors.text,
    },
    monthInput: {
      borderWidth: 1,
      borderColor: theme.colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      minWidth: 50,
      textAlign: 'center',
      color: theme.colors.text,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    wallet: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
    },
    copyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    copyButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    copyButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    verifyButton: {
      backgroundColor: theme.colors.primary,
      padding: 12,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      marginTop: 8,
    },
    verifyButtonDisabled: {
      backgroundColor: theme.colors.muted,
    },
    verifyText: {
      color: 'white',
      fontWeight: 'bold',
    },
    verifyTextDisabled: {
      color: '#d1d1d1',
      fontWeight: 'bold',
    },
    error: {
      color: theme.colors.danger,
      marginTop: 8,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
  });
