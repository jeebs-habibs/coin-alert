// siren/constants/theme.ts

export const lightColors = {
  primary: '#1b7982',
  accent: '#ff3b30',
  background: '#deddce',
  text: '#222',
  muted: '#aaa',
  card: '#f2f6ff',
};

export const darkColors = {
  primary: '#1b7982',
  accent: '#ff3b30',
  background: '#121212',
  text: '#f5f5f5',
  muted: '#777',
  card: '#1e1e1e',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 8,
  md: 16,
  lg: 24,
};

export const fonts = {
  regular: 'System',
  bold: 'System',
};

export const lightTheme = {
  colors: lightColors,
  spacing,
  borderRadius,
  fonts,
};

export const darkTheme = {
  colors: darkColors,
  spacing,
  borderRadius,
  fonts,
};

// Default export to maintain current usage
export const theme = lightTheme;
