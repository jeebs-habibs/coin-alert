import { EnrichedToken } from '@/app/(tabs)';
import { getTheme } from '@/constants/theme';
import { useUser } from '@/context/UserContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { Button } from 'react-native-elements';
import Page from './Page';
import SingleSelectModal from './SingleSelectModal';

type Props = {
  trackedTokens: EnrichedToken[];
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

export default function TrackedTokenSection({
  trackedTokens,
  currency,
  solPrice,
  loading,
}: Props) {
  const { authedUser, sirenUser } = useUser();
  const [selectedMetric, setSelectedMetric] = useState<string>('Total Value');
  const [hideDisabled, setHideDisabled] = useState(false);
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const styles = getStyles(theme)


  const toggleNotifications = async (
    mint: string,
    currentStatus: boolean
  ): Promise<void> => {
    if (!authedUser) return;
  
    try {
      const userRef = doc(db, 'users', authedUser.uid);
  
      // Create a new trackedTokens array with the updated token
      const updatedTokens = (sirenUser?.trackedTokens || []).map((token) =>
        token.mint === mint
          ? { ...token, isNotificationsOn: !currentStatus }
          : token
      );
  
      await updateDoc(userRef, {
        trackedTokens: updatedTokens,
      });
    } catch (error) {
      console.error("Failed to toggle notifications:", error);
    }
  };
  

  const sortedTokens = useMemo(() => {
    return [...trackedTokens]
      .filter((token) => (hideDisabled ? token.isNotificationsOn : true))
      .sort((a, b) => {
        // Sort by notification status first
        const aOn = a.isNotificationsOn ? 0 : 1;
        const bOn = b.isNotificationsOn ? 0 : 1;
        if (aOn !== bOn) return aOn - bOn;
  
        // Then sort by total value (tokensOwned * price)
        const aValue = (a.tokensOwned || 0) * (a.price || 0);
        const bValue = (b.tokensOwned || 0) * (b.price || 0);
        return bValue - aValue; // descending
      })
      .slice(0, 30);
  }, [trackedTokens, hideDisabled]);

  const renderItem = ({ item }: { item: EnrichedToken }) => {
    if (item.price == null) return null;

    const getDisplayValue = () => {
      const { price, marketCapSol, tokensOwned } = item;
      const value =
        selectedMetric === 'Market Cap'
          ? marketCapSol || 0
          : selectedMetric === 'Total Value'
          ? tokensOwned * (price || 0)
          : price || 0;

      const isPrice = selectedMetric === 'Price';

      if (currency === 'SOL') {
        return `${isPrice ? formatPriceWithSubscript(value) : formatNumber(value)} SOL`;
      }

      const converted = value * solPrice;
      return `${isPrice ? formatPriceWithSubscript(converted) : '$' + formatNumber(converted)}`;
    };

    const displayValue = getDisplayValue();
  

    return (
      <TouchableOpacity
        style={[
          styles.card,
          !item.isNotificationsOn && { opacity: 0.4, backgroundColor: '#f0f0f0' },
        ]}
        onPress={() => toggleNotifications(item.mint, item.isNotificationsOn)}
      >
        <View style={styles.cardContent}>
          <Image source={{ uri: item.image }} style={styles.logo} />
          <View style={styles.info}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.tokensOwned}>{formatNumber(item.tokensOwned)} owned</Text>
          </View>
          <View style={styles.metricContainer}>
            <Text style={styles.metric}>{displayValue}</Text>
          </View>
        </View>
      </TouchableOpacity>
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
      <View style={{ flex: 1 }}>
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

        {/* Toggle Hide Disabled */}
          <Button 
          type="clear" 
          title={hideDisabled ? "Show disabled" : "Hide Disabled"} 
          onPress={() => setHideDisabled(!hideDisabled)}
          titleStyle={styles.hideDisabledTitle}
          buttonStyle={styles.hideDisabledButton}
          />

        <FlatList
          data={sortedTokens}
          keyExtractor={(item) => item.mint}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          scrollEnabled={false} // ← critical
        />
      </View>
    </Page>
  );
}

// ...Keep your formatNumber and formatPriceWithSubscript helpers unchanged...
const getStyles = (theme: ReturnType<typeof getTheme>) => StyleSheet.create({
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  hideDisabledTitle: {
    color: "#888",
    textDecorationLine: 'underline',
    fontSize: 15,
    fontWeight: '400',
  },
  hideDisabledButton: {
    alignSelf: "flex-start"
  },
  hideDisabled: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: '500',
  },
  picker: {
    width: 180,
    height: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logo: {
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: '#eee',
    marginRight: 12,
  },
  info: {
    justifyContent: 'center',
    flex: 1,
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
