/**
 * Design tokens, modelled on shadcn/ui's default "zinc" theme, plus a green
 * accent used for anything "lit up" (done tasks, perfect days, streaks).
 * Follows the system light/dark setting via useColorScheme().
 */
import { useColorScheme } from 'react-native';

const light = {
  background: '#ffffff',
  foreground: '#09090b',
  card: '#ffffff',
  muted: '#f4f4f5',
  mutedForeground: '#71717a',
  border: '#e4e4e7',
  input: '#e4e4e7',
  primary: '#18181b',
  primaryForeground: '#fafafa',
  secondary: '#f4f4f5',
  secondaryForeground: '#18181b',
  destructive: '#ef4444',
  destructiveForeground: '#fafafa',
  lit: '#16a34a',
  litForeground: '#ffffff',
  litSoft: '#dcfce7',
  litMid: '#86efac',
  overlay: 'rgba(0,0,0,0.45)',
};

const dark: typeof light = {
  background: '#09090b',
  foreground: '#fafafa',
  card: '#0f0f12',
  muted: '#27272a',
  mutedForeground: '#a1a1aa',
  border: '#27272a',
  input: '#3f3f46',
  primary: '#fafafa',
  primaryForeground: '#18181b',
  secondary: '#27272a',
  secondaryForeground: '#fafafa',
  destructive: '#dc2626',
  destructiveForeground: '#fafafa',
  lit: '#22c55e',
  litForeground: '#052e16',
  litSoft: '#14532d',
  litMid: '#15803d',
  overlay: 'rgba(0,0,0,0.65)',
};

export type Colors = typeof light;

export const radius = { sm: 8, md: 10, lg: 14, full: 999 };
export const space = (n: number) => n * 4;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
