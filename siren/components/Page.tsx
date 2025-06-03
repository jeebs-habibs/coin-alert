import { getTheme } from '@/constants/theme';
import React from 'react';
import { SafeAreaView, StyleSheet, useColorScheme, ViewStyle } from 'react-native';

type PageProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function Page({ children, style }: PageProps) {
    const scheme = useColorScheme()
    const theme = getTheme(scheme);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <SafeAreaView style={[styles.container, { margin: theme.spacing.md }, style]}>
        {children}
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
