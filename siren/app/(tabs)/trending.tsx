import Page from '@/components/Page';
import { formatNumber } from '@/components/TrackedTokens';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import React, { JSX, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { TokenPriceWithMetadata, TrendingTokensResponse } from '../../../shared/types/token';
import OnboardingScreen from '../../components/OnboardingScreen';

// Interface for rendering token items
interface TokenItemProps {
  item: TokenPriceWithMetadata;
  currency: string;
  solPrice?: number;
}

export default function TrendingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme ?? 'light');
  const styles = getStyles(theme);
  const { authedUser } = useUser();
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [tokensLoading, setTokensLoading] = useState<boolean>(true);
  const [trendingTokens, setTrendingTokens] = useState<TrendingTokensResponse['data']>({ winners: [], losers: [] });
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [solPrice, setSolPrice] = useState<number | undefined>(undefined);

  console.log(JSON.stringify(trendingTokens))

  // Check authentication status
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user);
      setChecking(false);
    });
    return () => unsub();
  }, []);

  // Fetch SOL price
  useEffect(() => {
    async function fetchSOLPrice() {
      if (authedUser) {
        try {
          const userJwt = await authedUser.getIdToken();
          const response = await fetch('https://www.sirennotify.com/api/getCryptoPrice?symbol=SOL', {
            headers: { Authorization: `Bearer ${userJwt}` },
          });
          const data = await response.json();
          if (response.ok && data?.priceUsd) {
            setSolPrice(data.priceUsd);
          } else {
            console.warn('Failed to load SOL price', data);
          }
        } catch (error) {
          console.error('Error fetching SOL price:', error);
        }
      }
    }
    fetchSOLPrice();
  }, [authedUser]);

  // Fetch trending tokens
  useEffect(() => {
    async function fetchTrendingTokens() {
      if (!authedUser) {
        setTokensLoading(false);
        return;
      }
      setTokensLoading(true);
      try {
        const userJwt = await authedUser.getIdToken();
        const response = await fetch('https://www.sirennotify.com/api/getTrendingTokens?topN=5', {
          headers: {
            Authorization: `Bearer ${userJwt}`
          },
        });
        console.log(response)
        const data: TrendingTokensResponse = await response.json();
        if (response.ok && data.data) {
          setTrendingTokens(data.data);
        } else {
          console.warn('Failed to load trending tokens', data);
        }
      } catch (error) {
        console.error('Error fetching trending tokens:', error);
      } finally {
        setTokensLoading(false);
      }
    }
    fetchTrendingTokens();
  }, [authedUser]);

  // Render individual token item
  const renderTokenItem = ({ item, currency, solPrice }: TokenItemProps): JSX.Element => {
    const price = currency === 'USD' && solPrice ? item.currentPrice * solPrice : item.currentPrice;
    const marketCap = item.marketCapSol && currency === 'USD' && solPrice ? item.marketCapSol * solPrice : item.marketCapSol;
    return (
      <View style={styles.tokenItem}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.tokenImage} />
        ) : (
          <View style={[styles.tokenImage, styles.tokenImagePlaceholder]} />
        )}
        <View style={styles.tokenInfo}>
          <Text style={styles.tokenSymbol}>{item.symbol || 'Unknown'}</Text>
          <Text style={styles.tokenName}>{item.name || item.mint.slice(0, 6)}</Text>
        </View>
        <View style={styles.tokenMetrics}>
          {marketCap && (
            <Text style={styles.tokenPrice}>
              MC: {currency === 'USD' ? '$' : ''}{formatNumber(marketCap)}{currency === 'SOL' ? ' SOL' : ''}
            </Text>
          )}          
          <Text style={[styles.tokenChange, { color: item.percentChange >= 0 ? theme.colors.primary : theme.colors.danger }]}>
            {item.percentChange >= 0 ? '+' : ''}{formatNumber(item.percentChange)}%
          </Text>
  
          {item.pool && <Text style={styles.tokenPool}>Pool: {item.pool}</Text>}
        </View>
      </View>
    );
  };

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

  return (
    <Page>
      <View style={styles.header}>
        <Text style={styles.title}>Trending</Text>
      </View>
      {tokensLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Biggest Winners</Text>
          {trendingTokens && trendingTokens.winners.length > 0 ? (
            trendingTokens?.winners.map((item) => (
              <View key={`winner-${item.mint}`}>
                {renderTokenItem({ item, currency: selectedCurrency, solPrice })}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No winners available</Text>
          )}
          <View style={styles.separator} />
          <Text style={styles.sectionTitle}>Biggest Losers</Text>
          {trendingTokens && trendingTokens.losers.length > 0 ? (
            trendingTokens.losers.map((item) => (
              <View key={`loser-${item.mint}`}>
                {renderTokenItem({ item, currency: selectedCurrency, solPrice })}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No losers available</Text>
          )}
        </>
      )}
    </Page>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
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
      marginTop: theme.spacing.md,
    },
    title: {
      fontSize: 30,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: theme.spacing.xl,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
    },
    portRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
      marginVertical: theme.spacing.md,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      paddingHorizontal: theme.spacing.sm,
      marginVertical: theme.spacing.sm,
    },
    tokenItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.md,
      marginVertical: theme.spacing.xs,
      marginHorizontal: theme.spacing.sm,
    },
    tokenImage: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: theme.spacing.sm,
    },
    tokenImagePlaceholder: {
      backgroundColor: theme.colors.muted,
    },
    tokenInfo: {
      flex: 1,
      flexDirection: 'column',
    },
    tokenSymbol: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    tokenName: {
      fontSize: 14,
      color: theme.colors.muted,
    },
    tokenMetrics: {
      flex: 1,
      alignItems: 'flex-end',
    },
    tokenPrice: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    tokenChange: {
      fontSize: 14,
      fontWeight: '600',
    },
    tokenMarketCap: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    tokenPool: {
      fontSize: 12,
      color: theme.colors.muted,
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.muted,
      textAlign: 'center',
      padding: theme.spacing.md,
    },
    separator: {
      marginVertical: theme.spacing.sm,
      height: 1,
      width: '100%',
      backgroundColor: theme.colors.muted,
    },
  });