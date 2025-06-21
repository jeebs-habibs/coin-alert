import Page from '@/components/Page';
import PieChart from '@/components/PieChart';
import SingleSelectModal from '@/components/SingleSelectModal';
import SubscriptionModal from '@/components/SubscriptionModal';
import TrackedTokenSection, { formatNumber } from '@/components/TrackedTokens';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { auth } from '@/lib/firebase';
import { requestAndStoreFcmToken } from '@/lib/firebaseNotifications';
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
import { Token } from '../../../shared/types/token';
import OnboardingScreen from '../../components/OnboardingScreen';

export interface EnrichedToken {
  mint: string;
  tokensOwned: number;
  isNotificationsOn: boolean;
  symbol?: string;
  image?: string;
  price?: number;
  marketCapSol?: number;
}


/**
 * Calculates the total value of a list of EnrichedTokens.
 * @param tokens - List of enriched tokens.
 * @param currency - 'USD' or 'SOL'
 * @param solPriceUsd - Required if currency is 'SOL' to convert USD to SOL.
 */
export function getTotalValue(
  tokens: EnrichedToken[],
  currency: string = 'SOL',
  solPriceUsd?: number
): number {
  const totalSOL = tokens.reduce((sum, token) => {
    const value = (token.tokensOwned ?? 0) * (token.price ?? 0);
    return sum + value;
  }, 0);

  if (currency === 'USD') {
    if (!solPriceUsd || solPriceUsd <= 0) {
      console.warn("SOL price in USD is required to calculate SOL value.");
      return 0
    }
    return totalSOL * solPriceUsd;
  }

  return totalSOL;
}



export default function HomeScreen() {
  const scheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [enrichedTokens, setEnrichedTokens] = useState<EnrichedToken[]>([]);
  const theme = getTheme(scheme ?? 'light');
  const [solPrice, setSolPrice] = useState<number | undefined>(undefined)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [checking, setChecking] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD"); // false = USD, true = SOL
  const [authenticated, setAuthenticated] = useState(false);
  const { authedUser, sirenUser } = useUser();

  useEffect(() => {
    const setupFcm = async () => {
      if (authedUser && sirenUser) {
        const jwt = await authedUser.getIdToken();
        await requestAndStoreFcmToken(jwt, sirenUser.uid);
      }
    };
  
    setupFcm();
  }, [authedUser, sirenUser]);
  

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (sirenUser && Array.isArray(sirenUser.userWallets) && sirenUser.userWallets.length === 0) {
      setShowSubscriptionModal(true);
    }
  }, [sirenUser]);
  

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userJwt = await authedUser?.getIdToken();
        const results = await Promise.all(
          (sirenUser?.trackedTokens || []).map((token) =>
            fetch(`https://www.sirennotify.com/api/getToken?mint=${token.mint}`, {
              headers: {
                Authorization: `Bearer ${userJwt}`,
              },
            }).then((res) => res.json())
          )
        );

        const enriched: EnrichedToken[] = (sirenUser?.trackedTokens || []).map((tracked, i) => {
          const token: Token = results[i];
          const priceData = token.prices?.[0];
          const metadata = token.tokenData?.tokenMetadata;

          return {
            mint: tracked.mint,
            tokensOwned: tracked.tokensOwned,
            isNotificationsOn: tracked.isNotificationsOn,
            symbol: metadata?.symbol ?? 'Unknown',
            image: metadata?.image ?? '',
            price: priceData?.price,
            marketCapSol: priceData?.marketCapSol,
          };
        });

        setEnrichedTokens(enriched);
      } catch (err) {
        console.error('Error fetching token data:', err);
      } finally {
        setLoading(false);
      }
    };

    if ((sirenUser?.trackedTokens || []).length > 0) {
      fetchData();
    }
  }, [sirenUser?.trackedTokens, authedUser]);

  useEffect(() => {
    async function fetchSOLPrice() {
      if(authedUser != null){
        try {
          const userJwt = await authedUser?.getIdToken()
          const response = await fetch("https://www.sirennotify.com/api/getCryptoPrice?symbol=SOL", {
            headers: {
              Authorization: `Bearer ${userJwt}`,
            },
          });
          const data = await response.json();
          if (response.ok && data?.priceUsd) {
            setSolPrice(data.priceUsd);
          } else {
            console.warn("Failed to load SOL price", data);
          }
        } catch (error) {
          console.error("Error fetching SOL price:", error);
        }
      }
    }
  
    fetchSOLPrice();
  }, [authedUser]);
  


  const styles = getStyles(theme);

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!authenticated) {
    return <OnboardingScreen />;
  }

  const portTotal = selectedCurrency == "USD" ? `$${formatNumber(getTotalValue(enrichedTokens, selectedCurrency, solPrice))}`
  : `${formatNumber(getTotalValue(enrichedTokens, selectedCurrency, solPrice))} SOL`

  return (
      <Page>
      <SubscriptionModal visible={showSubscriptionModal} setSubscriptionModal={setShowSubscriptionModal} />

      <View style={styles.header}>
        <Text style={styles.title}>{authedUser?.displayName}'s Port</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>


      <View style={styles.portRow}>
        <Text style={styles.port}>{portTotal}</Text>
        <SingleSelectModal
          options={['USD', 'SOL']}
          selected={selectedCurrency}
          onSelect={setSelectedCurrency}
          title="Select Currency"
          getOptionLabel={(option) => option}
        />
      </View>

      <PieChart tokens={enrichedTokens}/>
      <View style={styles.separator} />

      <TrackedTokenSection trackedTokens={enrichedTokens} currency={selectedCurrency} solPrice={solPrice || 0} loading={loading}/>

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
    port: {
      fontSize: 30,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    portRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      marginTop: theme.spacing.md,
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
      marginVertical: theme.spacing.sm,
      height: 1,
      width: '100%',
      backgroundColor: theme.colors.muted,
    },
  });
