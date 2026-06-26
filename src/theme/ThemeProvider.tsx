/**
 * ThemeProvider — exposes the brand-kit tokens via React context.
 *
 * Dark mode is the default (constitution / brand kit). Light is secondary and
 * will be selectable from Settings later. Components read tokens through
 * useTheme() so a future light/dark switch is a one-line change here, not a
 * sweep across every component.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  darkColors,
  lightColors,
  type ColorTokens,
  fidelity,
  fonts,
  type as typeScale,
  spacing,
  radius,
  shadow,
  motion,
} from './tokens';

export type ColorScheme = 'dark' | 'light';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  fidelity: typeof fidelity;
  fonts: typeof fonts;
  type: typeof typeScale;
  spacing: typeof spacing;
  radius: typeof radius;
  shadow: typeof shadow;
  motion: typeof motion;
};

type ThemeContextValue = Theme & {
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialScheme = 'dark',
}: {
  children: React.ReactNode;
  initialScheme?: ColorScheme;
}) {
  const [scheme, setScheme] = useState<ColorScheme>(initialScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      fidelity,
      fonts,
      type: typeScale,
      spacing,
      radius,
      shadow,
      motion,
      setScheme,
      toggleScheme: () => setScheme((s) => (s === 'dark' ? 'light' : 'dark')),
    }),
    [scheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
