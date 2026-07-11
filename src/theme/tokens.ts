/**
 * tokens.ts — the brand kit as TypeScript. Single source of visual truth.
 * Design of record: planning/design-system/ (light-only, no dark mode at launch).
 * This file still ships the placeholder desert palette pending the Gorge rebrand
 * swap PR — see planning/rework/brand-integration.md.
 *
 * "Trail map meets tide chart." Warm earth tones, never neon. Dense but calm.
 * Three font registers: display (identity), body (utility), data (honesty).
 */

// ─── Color palettes ─────────────────────────────────────────────────────────

// Proper-noun desert palette — private. Semantic keys below point at these so
// consumers never bind to a hue name directly (planning/rework/brand-integration.md
// Pass 1). The Gorge rebrand swap replaces these values wholesale.
const darkPalette = {
  sandstone: '#C4A87A',
  olive: '#7B8C68',
  clay: '#B07858',
  slate: '#7A8896',
};

const lightPalette = {
  sandstone: '#A68A5B',
  olive: '#5E7048',
  clay: '#9A6344',
  slate: '#62717E',
};

export const darkColors = {
  // Ground & structure
  bg: '#181614',
  surface: '#221F1C',
  surfaceRaised: '#2C2825',
  border: '#38332E',
  borderStrong: '#4A443D',
  // Text — three weights of warm off-white. No pure white (too cold).
  text: '#E6E1DB',
  textSecondary: '#9B9590',
  textMuted: '#6B6560',
  // Semantic accents — earth, not traffic lights
  accent: darkPalette.sandstone, // primary accent: CTAs, active tab, fidelity-bar fill, GPS trace
  caution: darkPalette.clay, // warnings, fidelity-low
  modeled: darkPalette.slate, // tier-3 demotion, secondary charts
  trendLine: '#A3B490',
  positive: darkPalette.olive,
  negative: '#B86B5A',
  neutral: '#9B9590',
  // Dimension colors — declared-throwaway placeholders drawn from the existing
  // palette (planning/rework/brand-integration.md Pass 2). Replaced wholesale by
  // the Gorge rebrand swap PR; never reference these as final values.
  element: {
    earth: darkPalette.clay,
    sky: darkPalette.slate,
    water: darkPalette.olive,
    body: darkPalette.sandstone,
  },
  // Multi-series chart order — de-proper-nouned; same visual order as before.
  chartSeries: ['#A3B490', darkPalette.sandstone, darkPalette.clay, darkPalette.slate] as [
    string,
    string,
    string,
    string,
  ],
};

export const lightColors: typeof darkColors = {
  bg: '#F2EDE7',
  surface: '#FAFAF7',
  surfaceRaised: '#FFFFFF',
  border: '#DDD7CF',
  borderStrong: '#C4BDB4',
  text: '#1A1816',
  textSecondary: '#6B6560',
  textMuted: '#9B9590',
  accent: lightPalette.sandstone,
  caution: lightPalette.clay,
  modeled: lightPalette.slate,
  trendLine: '#6B7F5A',
  positive: lightPalette.olive,
  negative: '#A85545',
  neutral: '#6B6560',
  element: {
    earth: lightPalette.clay,
    sky: lightPalette.slate,
    water: lightPalette.olive,
    body: lightPalette.sandstone,
  },
  chartSeries: ['#6B7F5A', lightPalette.sandstone, lightPalette.clay, lightPalette.slate],
};

export type ColorTokens = typeof darkColors;

// ─── Fidelity (capture confidence) ──────────────────────────────────────────
// Encoded by opacity AND stroke/dot style together — never opacity alone.
export const fidelity = {
  high: 1.0, // weighed, barcode-scanned
  mid: 0.7, // text entry, recipe estimate
  low: 0.45, // photo guess, AI estimate
};

// ─── Fonts ──────────────────────────────────────────────────────────────────
// Keys match the @expo-google-fonts export names registered via useFonts.
export const fonts = {
  display: {
    semibold: 'BarlowCondensed_600SemiBold',
    bold: 'BarlowCondensed_700Bold',
  },
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
  },
  data: {
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
  },
};

// ─── Type scale ─────────────────────────────────────────────────────────────
// Ready-to-spread RN TextStyles. Display & label are always uppercase.
// letterSpacing/lineHeight are in points (px), converted from the em values in
// the brand kit. Display = labels/headers; data = values. Keep them distinct.
export const type = {
  displayXl: {
    fontFamily: fonts.display.bold,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  displayLg: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    lineHeight: 30.8,
    letterSpacing: 1.12,
    textTransform: 'uppercase' as const,
  },
  displayMd: {
    fontFamily: fonts.display.semibold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    lineHeight: 22.5,
  },
  bodySm: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    lineHeight: 19.5,
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: 11,
    lineHeight: 14.3,
    letterSpacing: 0.66,
    textTransform: 'uppercase' as const,
  },
  dataLg: {
    fontFamily: fonts.data.medium,
    fontSize: 24,
    lineHeight: 28.8,
    letterSpacing: -0.24,
  },
  data: {
    fontFamily: fonts.data.regular,
    fontSize: 14,
    lineHeight: 19.6,
    letterSpacing: -0.14,
  },
  dataSm: {
    fontFamily: fonts.data.regular,
    fontSize: 12,
    lineHeight: 16.8,
    letterSpacing: -0.12,
  },
};

export type TypeVariant = keyof typeof type;

// ─── Spacing (4px base ledger) ──────────────────────────────────────────────
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
};

// ─── Radius (minimal — a tool, not a toy) ───────────────────────────────────
// No radius on chart containers or data panels — hard edges signal raw data.
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

// ─── Elevation (separation by surface step, not shadow) ─────────────────────
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
};

// ─── Motion ─────────────────────────────────────────────────────────────────
export const motion = {
  durationFast: 120, // hover, press feedback
  durationBase: 200, // panel transitions, tab switches
  durationSlow: 350, // modal enter/exit, chart line drawing
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
};
