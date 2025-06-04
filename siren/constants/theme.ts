// siren/constants/theme.ts

import { ColorSchemeName } from "react-native";

export interface ThemeColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  danger: string;
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface BorderRadius {
  sm: number;
  md: number;
  lg: number;
}

export interface Fonts {
  regular: string;
  bold: string;
}

export interface Theme {
  colors: ThemeColors;
  spacing: Spacing;
  borderRadius: BorderRadius;
  fonts: Fonts;
}

export const lightColors: ThemeColors = {
  primary: '#28b696',
  accent: '#ff3b30',
  background: '#FAF8F6',
  text: '#222',
  muted: '#828282',
  card: '#f2f6ff',
  border: "#e4e4e4",
  danger: "#ff3b30"
};

export const darkColors: ThemeColors = {
  primary: '#28b696',
  accent: '#ff3b30',
  background: '#121212',
  text: '#f5f5f5',
  muted: '#828282',
  card: '#1e1e1e',
  border: "#e4e4e4",
  danger: "#ff3b30"
};

export const spacing: Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius: BorderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
};

export const fonts: Fonts = {
  regular: 'System',
  bold: 'System',
};

export const lightTheme: Theme = {
  colors: lightColors,
  spacing,
  borderRadius,
  fonts,
};

export const darkTheme: Theme = {
  colors: darkColors,
  spacing,
  borderRadius,
  fonts,
};

// Default export to maintain current usage
export const theme: Theme = lightTheme;

export function getTheme(theme: ColorSchemeName): Theme {
  return theme === "light" ? lightTheme : darkTheme;
}
