// app/(tabs)/settings.tsx
import { useCustomTheme } from '@/context/ThemeContext';
import React from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-elements';

export default function SettingsScreen() {
  const { isDark, toggleTheme } = useCustomTheme();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text h4>Settings</Text>

      <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ marginRight: 10 }}>Dark Mode</Text>
        <Switch value={isDark} onValueChange={toggleTheme} />
      </View>
    </View>
  );
}
