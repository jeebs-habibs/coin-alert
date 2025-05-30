import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type DataPoint = {
  timestamp: number; // UNIX timestamp (seconds or ms)
  value: number; // USD value
};

export type Props = {
  data: DataPoint[];
  width?: number;
  height?: number;
};

export default function LineChart({ data, width = 350, height = 200 }: Props) {
  if (!data || data.length === 0) {
    return <View style={[styles.container, { width, height }]} />;
  }

  // Sort data by timestamp (just in case)
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

  // Extract min/max for scaling
  const minX = sortedData[0].timestamp;
  const maxX = sortedData[sortedData.length - 1].timestamp;
  const values = sortedData.map((d) => d.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);

  // Normalize points to SVG coords
  // X scaled between 0 and width
  // Y scaled between height and 0 (SVG Y is top to bottom)
  const points = sortedData.map(({ timestamp, value }) => {
    const x = ((timestamp - minX) / (maxX - minX)) * width;
    const y = height - ((value - minY) / (maxY - minY)) * height;
    return { x, y };
  });

  // Build path string
  // We'll create a smooth path with quadratic Bezier curves for smoothness
  // But if you want simple linear, just join with L
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;

  for (let i = 1; i < points.length; i++) {
    const midX = ((points[i].x + points[i - 1].x) / 2).toFixed(2);
    const midY = ((points[i].y + points[i - 1].y) / 2).toFixed(2);
    const prevX = points[i - 1].x.toFixed(2);
    const prevY = points[i - 1].y.toFixed(2);
    const currX = points[i].x.toFixed(2);
    const currY = points[i].y.toFixed(2);

    // Quadratic curve to midpoint, then line to current point
    path += `Q ${prevX} ${prevY} ${midX} ${midY} T ${currX} ${currY} `;
  }

  // For fill, close the path down to the bottom
  const fillPath = `${path} L ${points[points.length - 1].x.toFixed(2)} ${height} L 0 ${height} Z`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2={height.toString()}>
            <Stop offset="0%" stopColor="#4c669f" stopOpacity={0.6} />
            <Stop offset="100%" stopColor="#3b5998" stopOpacity={0.1} />
          </LinearGradient>
        </Defs>

        {/* Filled area */}
        <Path d={fillPath} fill="url(#gradient)" />

        {/* Line path */}
        <Path
          d={path}
          fill="none"
          stroke="#3b5998"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    backgroundColor: '#f5f7fa',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
