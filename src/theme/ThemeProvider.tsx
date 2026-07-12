/**
 * ThemeProvider — exposes the brand-kit tokens via React context.
 *
 * Light is the only shipped scheme (design of record: planning/design-system/,
 * locked 2026-07-11 — dark mode does not ship). darkColors is aliased to
 * lightColors in tokens.ts; the scheme/toggle machinery below stays wired
 * only so a future dark-mode revisit doesn't need to rebuild this contract.
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
  initialScheme = 'light',
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
