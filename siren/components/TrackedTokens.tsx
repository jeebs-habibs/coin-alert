import { EnrichedToken } from '@/app/(tabs)';
import { useUser } from '@/context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { doc, getFirestore, updateDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { TrackedToken } from '../../shared/types/user';
import Page from './Page';
import SingleSelectModal from './SingleSelectModal';

type Props = {
  trackedTokens: TrackedToken[];
  currency: string;
  solPrice: number;
  loading: boolean;
};

export function formatNumber(num: number): string {
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  
  if (absNum >= 1_000_000_000) {
      return `${sign}${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
      return `${sign}${(num / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 1_000) {
      return `${sign}${(num / 1_000).toFixed(1)}K`;
  }
  return `${sign}${num.toFixed(1)}`;
}

// Format a price with concise notation for large numbers and subscript for small numbers
export const formatPriceWithSubscript = (value: number, currency: "SOL" | "USD" = "USD"): string => {
  if (isNaN(value)) return "N/A";

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : "SOL ";

  // Handle large numbers (>= 1000)
  if (absValue >= 1000) {
    let formattedValue: string;
    let suffix: string;

    if (absValue >= 1_000_000_000) {
      // Billions (B)
      formattedValue = (absValue / 1_000_000_000).toFixed(1).replace(/\.0$/, ""); // e.g., 1.2, not 1.0
      suffix = "B";
    } else if (absValue >= 1_000_000) {
      // Millions (M)
      formattedValue = (absValue / 1_000_000).toFixed(1).replace(/\.0$/, "");
      suffix = "M";
    } else {
      // Thousands (k)
      formattedValue = (absValue / 1_000).toFixed(1).replace(/\.0$/, "");
      suffix = "k";
    }

    return `${sign}${symbol}${formattedValue}${suffix}`;
  }

  // Handle numbers between 1 and 1000
  if (absValue >= 1) {
    // Round to 2 decimals
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "SOL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Handle small numbers (< 1)
  // Convert to string to count leading zeros
  const strValue = absValue.toFixed(10).replace(/\.?0+$/, ""); // Remove trailing zeros
  const decimalIndex = strValue.indexOf(".");
  const digits = strValue.replace(".", "").replace(/^0+/, "");
  const leadingZeros = strValue.slice(decimalIndex + 1).match(/^0+/)?.[0]?.length || 0;

  if (leadingZeros < 2) {
    // Small numbers with few zeros: round to 4 decimals
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "SOL",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  }

  // Subscript notation for many leading zeros (e.g., 0.00000363 -> 0.0₃363)
  const subscriptDigits = "₀₁₂₃₄₅₆₇₈₉";
  const subscriptZeroCount = leadingZeros
    .toString()
    .split("")
    .map((d) => subscriptDigits[Number(d)])
    .join("");
  const significantDigits = digits.slice(0, 3); // Show 3 significant digits

  return `${sign}${symbol}0.0${subscriptZeroCount}${significantDigits}`;
};

export default function TrackedTokenSection({ trackedTokens, currency, solPrice, loading }: Props) {
  const { authedUser } = useUser();

  const [selectedMetric, setSelectedMetric] = useState<string>('Total Value');

  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;



  const toggleNotifications = async (mint: string, currentStatus: boolean) => {
    if (!user) return;
    const tokenRef = doc(db, 'users', user.uid, 'trackedTokens', mint);
    await updateDoc(tokenRef, {
      isNotificationsOn: !currentStatus,
    });
  };


  const renderItem = ({ item }: { item: EnrichedToken }) => {
    if (item.price == null) return null;

    const getDisplayValue = () => {
      const { price, marketCapSol, tokensOwned } = item;
      const value = selectedMetric === 'Market Cap'
        ? marketCapSol || 0
        : selectedMetric === 'Total Value'
        ? tokensOwned * (price || 0)
        : (price || 0);
    
      const isPrice = selectedMetric === 'Price';
    
      if (currency === 'SOL') {
        return `${isPrice ? formatPriceWithSubscript(value) : formatNumber(value)} SOL`;
      }
    
      const converted = value * solPrice;
      return `${isPrice ? formatPriceWithSubscript(converted) : "$" + formatNumber(converted)}`;
    };
    
    const displayValue = getDisplayValue();
    

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
            <Text style={styles.tokensOwned}>{formatNumber(item.tokensOwned)} owned</Text>
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

  if (!loading && trackedTokens.length === 0) {
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
      <View style={styles.headerRow}>
  <Text style={styles.header}>Tracked Tokens</Text>
  <View style={styles.selectWrapper}>
    <SingleSelectModal
      options={['Total Value', 'Price', 'Market Cap']}
      selected={selectedMetric}
      onSelect={setSelectedMetric}
      title="Select Metric"
      getOptionLabel={(option) => option}
    />
  </View>
</View>

      <FlatList
        data={trackedTokens}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  
  selectWrapper: {
    marginLeft: 12,
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
