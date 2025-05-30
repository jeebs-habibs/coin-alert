import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
  screenOptions={{
    tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
    headerShown: false,
    tabBarShowLabel: false, // <-- Hides the text labels under icons
  }}
>
  <Tabs.Screen
    name="index"
    options={{
      tabBarIcon: ({ color }) => <TabBarIcon name="line-chart" color={color} />,
    }}
  />
  <Tabs.Screen
    name="trending"
    options={{
      tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
    }}
  />
  <Tabs.Screen
    name="settings"
    options={{
      tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
    }}
  />
</Tabs>

  
  );
}
