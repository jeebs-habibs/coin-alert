// context/ThemeContext.tsx
import { darkTheme, theme as lightTheme } from '@/constants/theme'; // you'll need to create this
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ThemeType = typeof lightTheme;

const ThemeContext = createContext<{
  theme: ThemeType;
  isDark: boolean;
}>({
  theme: lightTheme,
  isDark: false,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(false);
  const colorScheme = useColorScheme()

  useEffect(() => {
    AsyncStorage.getItem('theme').then((value) => {
      if (value === 'dark') setIsDark(true);
    });
  }, []);


  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useCustomTheme = () => useContext(ThemeContext);
