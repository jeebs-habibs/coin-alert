import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { PublicKey } from "@solana/web3.js";
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
// import { MONTHLY_SUBSCRIPTION_COST_SOL } from '../../shared/constants/subscription';

const MONTHLY_SUBSCRIPTION_COST_SOL = .25

interface Props {
  visible: boolean;
  setSubscriptionModal: (visible: boolean) => void
}

const isValidSolanaAddress = (address: string): boolean => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
};

export default function SubscriptionModal({ visible, setSubscriptionModal }: Props) {
  const { authedUser, sirenUser } = useUser();
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const styles = getStyles(theme);
  const [walletAddress, setWalletAddress] = useState('');
  const [months, setMonths] = useState('12');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const totalSOL = (parseInt(months) || 0) * MONTHLY_SUBSCRIPTION_COST_SOL;

  const handleVerify = async () => {
    if (!authedUser) return;
    try {
      setVerifying(true);
      setError('');
      const trimmed = walletAddress.trim();
      const userJwt = await authedUser.getIdToken();
      const url = `https://www.sirennotify.com/api/updateSubscriptionForWallet?sourceWallet=${encodeURIComponent(
        trimmed
      )}&userId=${encodeURIComponent(authedUser.uid)}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${userJwt}`,
        },
      });

      if(!response.ok){
        setError('Could not verify wallet. Please ensure the SOL was sent and try again.');
        return
      }
    
      // success, refresh or handle accordingly
      // e.g., call some refetch logic
      const res: Wallet = await response.json();
      console.log('API response:', res);

      const subscriptionEndDateForWallet = res?.subscriptionEndTimesampMs
        ? new Date(res.subscriptionEndTimesampMs)
        : undefined;
      if(subscriptionEndDateForWallet){
        setSubscriptionModal(false)
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

  const isVerifyButtonDisabled = (!isValidSolanaAddress(walletAddress) || verifying || sirenUser?.userWallets?.map((wallet) => wallet.pubkey).includes(walletAddress))

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {}} // disables Android back button
      hardwareAccelerated
      presentationStyle="overFullScreen"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Activate Your Subscription</Text>

          <Text style={styles.step}>Step 1: Send Payment</Text>
          <Text style={styles.label}>Enter months you want to subscribe:</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={months}
            onChangeText={setMonths}
          />
          <Text style={styles.summary}>
            You need to send: <Text style={{ fontWeight: 'bold' }}>{totalSOL} SOL</Text>
          </Text>

          <Text style={styles.step}>Step 2: Enter Wallet Address</Text>
          <Text style={styles.label}>Enter your wallet address used to send payment:</Text>
          <TextInput
            style={styles.input}
            value={walletAddress}
            onChangeText={setWalletAddress}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.verifyButton,
              isVerifyButtonDisabled && styles.verifyButtonDisabled
            ]}
            onPress={handleVerify}
            disabled={verifying || !isValidSolanaAddress(walletAddress)}
            >
            {verifying ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={isVerifyButtonDisabled ? styles.verifyTextDisabled : styles.verifyText}>Verify</Text>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
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
    borderRadius: 12,
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
  step: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    color: theme.colors.text,
  },
  label: {
    marginTop: 6,
    color: theme.colors.text,
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
  summary: {
    marginBottom: 10,
    color: theme.colors.text,
  },
  verifyButton: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  verifyButtonDisabled: {
    backgroundColor: theme.colors.muted, // or '#aaa' for a disabled look
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
  }
});