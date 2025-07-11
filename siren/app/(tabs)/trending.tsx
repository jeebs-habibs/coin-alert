import Page from '@/components/Page';
import { Text, View } from '@/components/Themed';
import { getTheme } from '@/constants/theme';
import { StyleSheet, useColorScheme } from 'react-native';

export default function TrendingScreen() {
  const scheme = useColorScheme();
  const theme = getTheme(scheme ?? 'light');
  const styles = getStyles(theme);

  return (
    <Page>
    <View style={styles.container}>
      <Text style={styles.title}>Trending</Text>
      <Text style={styles.description}>Soon new pairs will be disiplayed here. Siren Pro users will get notifications on migrated tokens</Text>
    </View>
    </Page>
  );
}

const getStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    description: {
      color: theme.colors.text,
      justifyContent: "center",
      alignSelf: "center",
      textAlign: "center",
      margin: 5
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    separator: {
      marginVertical: theme.spacing.lg,
      height: 1,
      width: '80%',
      backgroundColor: theme.colors.muted,
    },
  });
