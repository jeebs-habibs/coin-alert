import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TrackedToken = {
  mintAddress: string;
  symbol: string;
  tokensOwned: number;
  isNotificationsOn: boolean;
};

type TokenMetadata = {
  image: string;
  price: number;
  marketCap: number;
  name: string;
};

type Props = {
  trackedTokens: TrackedToken[];
  selectedMetric: 'totalEquity' | 'marketCap' | 'price';
};

export default function TrackedTokenSection({ trackedTokens, selectedMetric }: Props) {
  const [metadataMap, setMetadataMap] = useState<Record<string, TokenMetadata>>({});
  const [loading, setLoading] = useState(true);

  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      try {
        const responses = await Promise.all(
          trackedTokens.map(token =>
            fetch(`https://your-api.com/api/token-metadata?mint=${token.mintAddress}`)
          )
        );
        const results = await Promise.all(responses.map(res => res.json()));
        const metadataByMint: Record<string, TokenMetadata> = {};
        trackedTokens.forEach((token, i) => {
          metadataByMint[token.mintAddress] = results[i];
        });
        setMetadataMap(metadataByMint);
      } catch (err) {
        console.error('Error fetching metadata:', err);
      } finally {
        setLoading(false);
      }
    };

    if (trackedTokens.length > 0) {
      fetchMetadata();
    }
  }, [trackedTokens]);

  const toggleNotifications = async (mintAddress: string, currentStatus: boolean) => {
    if (!user) return;
    const tokenRef = doc(db, 'users', user.uid, 'trackedTokens', mintAddress);
    await updateDoc(tokenRef, {
      isNotificationsOn: !currentStatus,
    });
  };

  const renderItem = ({ item }: { item: TrackedToken }) => {
    const metadata = metadataMap[item.mintAddress];
    if (!metadata) return null;

    const totalValue = item.tokensOwned * metadata.price;
    const displayValue =
      selectedMetric === 'totalEquity'
        ? `$${totalValue.toFixed(2)}`
        : selectedMetric === 'marketCap'
        ? `$${metadata.marketCap.toLocaleString()}`
        : `$${metadata.price.toFixed(2)}`;

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Image source={{ uri: metadata.image }} style={styles.logo} />
          <View style={styles.info}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.tokensOwned}>{item.tokensOwned} owned</Text>
            <Text style={styles.metric}>{displayValue}</Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleNotifications(item.mintAddress, item.isNotificationsOn)}
          >
            <Ionicons
              name={item.isNotificationsOn ? 'notifications' : 'notifications-off'}
              size={24}
              color={item.isNotificationsOn ? 'green' : 'gray'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#888" style={{ marginTop: 20 }} />;
  }

  return (
    <FlatList
      data={trackedTokens}
      keyExtractor={(item) => item.mintAddress}
      renderItem={renderItem}
      contentContainerStyle={{ paddingBottom: 100 }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
    borderRadius: 25,
  },
  info: {
    flex: 1,
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tokensOwned: {
    color: '#666',
  },
  metric: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '500',
  },
});
