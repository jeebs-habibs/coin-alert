import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Token } from '../../shared/types/token';
import { TrackedToken } from '../../shared/types/user';
import Page from './Page';
import SingleSelectModal from './SingleSelectModal';

type Props = {
  trackedTokens: TrackedToken[];
  currency: string
};

interface EnrichedToken {
  mint: string;
  tokensOwned: number;
  isNotificationsOn: boolean;
  symbol?: string;
  image?: string;
  price?: number;
  marketCap?: number;
}

export default function TrackedTokenSection({ trackedTokens, currency }: Props) {
  const [enrichedTokens, setEnrichedTokens] = useState<EnrichedToken[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedMetric, setSelectedMetric] = useState<string>('Total Value');

  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userJwt = await user?.getIdToken();
        const results = await Promise.all(
          trackedTokens.map((token) =>
            fetch(`https://www.sirennotify.com/api/getToken?mint=${token.mint}`, {
              headers: {
                Authorization: `Bearer ${userJwt}`,
              },
            }).then((res) => res.json())
          )
        );

        const enriched: EnrichedToken[] = trackedTokens.map((tracked, i) => {
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
            marketCap: priceData?.marketCapSol,
          };
        });

        setEnrichedTokens(enriched);
      } catch (err) {
        console.error('Error fetching token data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (trackedTokens.length > 0) {
      fetchData();
    }
  }, [trackedTokens, user]);

  const toggleNotifications = async (mint: string, currentStatus: boolean) => {
    if (!user) return;
    const tokenRef = doc(db, 'users', user.uid, 'trackedTokens', mint);
    await updateDoc(tokenRef, {
      isNotificationsOn: !currentStatus,
    });
  };


  const renderItem = ({ item }: { item: EnrichedToken }) => {
    if (item.price == null) return null;

    const totalValue = item.tokensOwned * item.price;
    const displayValue = currency == "SOL"
      ? selectedMetric === 'Market Cap'
        ? `${(item.marketCap ?? 0).toLocaleString()} SOL`
        : selectedMetric === 'Total Value'
        ? `${totalValue.toFixed(2)} SOL`
        : `${item.price.toFixed(4)} SOL`
      : selectedMetric === 'Market Cap'
      ? `$${((item.marketCap ?? 0) * 20).toLocaleString()}` // example conversion rate SOL->USD; replace 20 with actual rate
      : selectedMetric === 'Total Value'
      ? `$${(totalValue * 20).toFixed(2)}`
      : `$${(item.price * 20).toFixed(4)}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: item.image }} style={styles.logo} />
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => toggleNotifications(item.mint, item.isNotificationsOn)}
            >
              <Ionicons
                name={item.isNotificationsOn ? 'notifications' : 'notifications-off'}
                size={18}
                color={item.isNotificationsOn ? 'green' : 'gray'}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.info}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.tokensOwned}>{item.tokensOwned.toFixed(2)} owned</Text>
          </View>
          <View style={styles.metricContainer}>
            <Text style={styles.metric}>{displayValue}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#888" style={{ marginTop: 20 }} />;
  }

  if (!loading && enrichedTokens.length === 0) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: 'red' }}>No tokens to display</Text>
      </View>
    );
  }

  return (
    <Page>
    <View style={{ flex: 1, paddingHorizontal: 12 }}>
      {/* Header */}
      <Text style={styles.header}>Tracked Tokens</Text>
      <SingleSelectModal
        options={['Total Value', 'Price', "Market Cap"]}
        selected={selectedMetric}
        onSelect={setSelectedMetric}
        title="Select Currency"
        getOptionLabel={(option) => option}
      />

      <FlatList
        data={enrichedTokens}
        keyExtractor={(item) => item.mint}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 22,
    fontWeight: '700',
    marginVertical: 12,
    color: 'black',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  picker: {
    width: 180,
    height: 40,
  },
  card: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  notificationButton: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: 'white',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  info: {
    justifyContent: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
  },
  tokensOwned: {
    marginTop: 2,
    fontSize: 14,
    color: 'black',
  },
  metricContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 90,
  },
  metric: {
    fontSize: 16,
    fontWeight: '600',
    color: 'black',
  },
});
