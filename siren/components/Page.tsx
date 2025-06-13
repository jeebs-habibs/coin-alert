import { getTheme } from '@/constants/theme';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type PageProps = {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
};

export default function Page({ children, style }: PageProps) {
  const scheme = useColorScheme();
  const theme = getTheme(scheme);
  const { height } = useWindowDimensions();

  return (

    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          { padding: theme.spacing.sm },
          style,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
  },
});
