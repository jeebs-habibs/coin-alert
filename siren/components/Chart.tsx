import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart as Chart } from 'react-native-chart-kit';

export type DataPoint = {
  timestamp: number; // UNIX timestamp
  value: number;     // USD value
};

type Props = {
  data: DataPoint[];
  width?: number;
  height?: number;
};

export default function LineChart({ data, width = Dimensions.get('window').width - 40, height = 200 }: Props) {
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
    value: number;
    visible: boolean;
    index: number;
  }>({
    x: 0,
    y: 0,
    value: 0,
    visible: false,
    index: -1,
  });

  if (!data || data.length === 0) {
    return <View style={styles.emptyContainer}><Text>No data available</Text></View>;
  }

  // Sort data by timestamp and prepare chart data
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((point) => point.value);

  // Calculate tooltip position with bounds checking
  const getTooltipPosition = (x: number, y: number) => {
    const tooltipWidth = 80;
    const tooltipHeight = 40;
    const padding = 10;
    
    // Ensure tooltip stays within chart boundaries
    const adjustedX = Math.max(padding, Math.min(x - tooltipWidth / 2, width - tooltipWidth - padding));
    const adjustedY = y < height / 2 ? y + 10 : y - tooltipHeight - 10;

    return { adjustedX, adjustedY };
  };

  return (
    <View style={styles.container}>
      <Chart
        data={{
          labels: [],
          datasets: [
            {
              data: values,
              strokeWidth: 2,
              color: () => '#10B981',
            },
          ],
        }}
        width={width}
        height={height}
        withDots={true}
        withInnerLines={false}
        withOuterLines={false}
        withShadow={false}
        withVerticalLabels={false}
        withHorizontalLabels={false}
        transparent={true}
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: 'transparent',
          backgroundGradientTo: 'transparent',
          fillShadowGradient: 'transparent',
          fillShadowGradientOpacity: 0,
          decimalPlaces: 2,
          color: () => '#10B981',
          labelColor: () => 'transparent',
          propsForBackgroundLines: {
            stroke: 'transparent',
            strokeWidth: 0,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#fff',
            fill: '#10B981',
          },
          propsForLabels: {
            fontSize: 0,
          },
        }}
        bezier
        style={styles.chart}
        onDataPointClick={({ x, y, value, index }) => {
          const isSamePoint = tooltipPos.index === index;
          const { adjustedX, adjustedY } = getTooltipPosition(x, y);

          setTooltipPos({
            x: adjustedX,
            y: adjustedY,
            value,
            visible: !isSamePoint,
            index,
          });
        }}
        decorator={() => {
          if (!tooltipPos.visible) return null;

          return (
            <View
              style={[
                styles.tooltip,
                {
                  left: tooltipPos.x,
                  top: tooltipPos.y,
                },
              ]}
            >
              <Text style={styles.tooltipText}>
                ${tooltipPos.value.toFixed(2)}
              </Text>
              <View style={styles.tooltipArrow} />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  chart: {
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    position: 'absolute',
    zIndex: 1000,
  },
  tooltipText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -4,
    left: '50%',
    width: 8,
    height: 8,
    backgroundColor: '#10B981',
    transform: [{ rotate: '45deg' }],
    marginLeft: -4,
  },
});