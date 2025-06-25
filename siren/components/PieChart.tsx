import { getTheme } from '@/constants/theme';
import React from 'react';
import { Dimensions, Text, useColorScheme, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

interface EnrichedToken {
  mint: string;
  tokensOwned: number;
  isNotificationsOn: boolean;
  symbol?: string;
  image?: string;
  price?: number; // price in USD
  marketCapSol?: number;
}

interface Props {
  tokens: EnrichedToken[];
}

const screenWidth = Dimensions.get('window').width;

const PieChartComponent: React.FC<Props> = ({ tokens }) => {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  // Step 1: Compute total value for each token
  const enrichedTokensWithValue = tokens
    .map((token) => ({
      ...token,
      value: ((token.tokensOwned ?? 0) * (token.price ?? 0)),
    }))
    .filter((t) => t.value > 0);

  // Step 2: Sort by value and get top 10
  const topTokens = enrichedTokensWithValue
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Step 3: Format for pie chart
  const pieData = topTokens.map((token, index) => ({
    name: token.symbol || token.mint.slice(0, 4),
    value: Math.round(token.value * 100) / 100,
    color: getColor(index),
    legendFontColor: '#7F7F7F',
    legendFontSize: 12,
  }));

  if (pieData.length === 0) {
    return (
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{color: theme.colors.text}}>No holdings to display</Text>
      </View>
    );
  }

  return (
    <PieChart
      data={pieData}
      width={screenWidth - 32}
      height={220}
      chartConfig={{
        color: () => `rgba(0, 0, 0, 1)`,
        labelColor: () => '#333',
      }}
      accessor="value"
      backgroundColor="transparent"
      paddingLeft="15"
      absolute
    />
  );
};

function getColor(index: number) {
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
    '#9966FF', '#F67019', '#00A36C', '#845EC2',
    '#FFC75F', '#0081CF'
  ];
  return colors[index % colors.length];
}

export default PieChartComponent;
