/**
 * tokens.ts — the brand kit as TypeScript. Single source of visual truth.
 * Design of record: planning/design-system/ (light-only, no dark mode).
 * Translated from planning/design-system/tokens/{colors,typography}.css —
 * the Session 10 rebrand swap (planning/rework/brand-integration.md Pass 4).
 *
 * "A mirror, not a coach." Descriptive, never prescriptive. Color earns its
 * way in — it only names the element you're in (Earth/Sky/Water/Body) or
 * flags a real alert. Everything else lives on one monochrome ramp: wet
 * basalt, mossy cliff, glacial mist — the Columbia River Gorge.
 * Four font registers: display (headlines), caps (structural labels), body
 * (prose), numbers (every value the user might compare — Space Grotesk with
 * tabular figures, same face as display per the artifact's own type scale).
 */

// ─── Color palette ──────────────────────────────────────────────────────────
// Direct translation of colors.css's basalt→spray monochrome ramp. Named
// steps kept private — consumers bind to the semantic roles below, never a
// ramp step directly.
const gray900 = '#0F1618'; // Basalt    — dark volcanic rock
const gray700 = '#3B484A'; // Slate     — gorge cliff face, damp
const gray500 = '#889796'; // Glacial   — silty river water
const gray400 = '#B4BEBC'; // Ash       — overcast mist

const elementEarth = '#8A7049'; // volcanic ochre — climbing, trail running, hiking, bouldering
const elementSky = '#5E84A6'; // hazy lifted blue — paragliding, wingfoiling, airborne
const elementWater = '#4C8E85'; // glacial silt teal — kayaking, surfing, swimming, SUP
const elementBody = '#C15A39'; // inner fire / rust ember — gym, yoga, PT, breathwork
const negative = '#B00020'; // the artifact's one true alert color

export const lightColors = {
  // Ground & structure
  bg: '#DFE4E1',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  border: '#CFD6D2',
  borderStrong: gray400,
  // Text — the monochrome ramp.
  text: gray900,
  textSecondary: gray700,
  textMuted: gray500,
  // Semantic accents. Dylan's call (2026-07-11, Session 10): neutral buttons,
  // monochrome throughout — the four elements are the only saturated colors
  // anywhere in the app. `accent` deliberately equals `text` (the ramp's
  // darkest, most assertive neutral): CTAs, the active tab, the fidelity-bar
  // fill, and the GPS trace all read as ink, not a hue. The artifact defines
  // no hex for caution/positive/modeled/neutral/trendLine either — collapsed
  // onto the ramp (caution reuses the one true alert red rather than
  // inventing an undeclared amber). See dev-log for the full flag.
  accent: gray900,
  caution: negative,
  modeled: gray500,
  trendLine: gray700,
  positive: gray700,
  negative,
  neutral: gray700,
  // Dimension colors — shipped for real (were placeholders through Pass 2-3).
  element: {
    earth: elementEarth,
    sky: elementSky,
    water: elementWater,
    body: elementBody,
  },
  // Multi-series chart order — the artifact defines no chartSeries; the four
  // element hues are the system's only remaining saturated palette, reused
  // here (order follows the design system's macro-breakdown reference: rust,
  // teal, ochre, then sky).
  chartSeries: [elementBody, elementWater, elementEarth, elementSky] as [
    string,
    string,
    string,
    string,
  ],
};

// Dark mode is DEFERRED, not dead (Dylan's call 2026-07-12: get light fully
// sorted first). darkColors is a placeholder — light's values under the same
// type — until that pass gives it real values; kept now so ThemeProvider's
// ColorScheme union and toggle machinery don't need rebuilding later.
export const darkColors: typeof lightColors = lightColors;

export type ColorTokens = typeof lightColors;

// ─── Fidelity (capture confidence) ──────────────────────────────────────────
// Encoded by opacity AND stroke/dot style together — never opacity alone.
export const fidelity = {
  high: 1.0, // weighed, barcode-scanned
  mid: 0.7, // text entry, recipe estimate
  low: 0.45, // photo guess, AI estimate
};

// ─── Fonts ──────────────────────────────────────────────────────────────────
// Keys match the @expo-google-fonts export names registered via useFonts.
// Four registers: display (Space Grotesk, headlines), caps (Archivo,
// structural labels — buttons, tags, section headers), body (DM Sans,
// prose), numbers (Space Grotesk, tabular-figures — every value the user
// might compare). Numbers shares display's family by design (typography.css:
// "Space Grotesk → numbers, headlines... one calm display face carries
// both") — Dylan's call 2026-07-12, overriding this session's earlier
// Space Mono pick.
export const fonts = {
  display: {
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
  },
  caps: {
    bold: 'Archivo_700Bold',
  },
  body: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
  },
  numbers: {
    regular: 'SpaceGrotesk_500Medium',
    bold: 'SpaceGrotesk_700Bold',
  },
};

// ─── Type scale ─────────────────────────────────────────────────────────────
// Ready-to-spread RN TextStyles, translated from typography.css. Unlike the
// prior Barlow-era scale, display headlines are NOT uppercase in the artifact
// — only the caps register (label/elementTag) is. letterSpacing/lineHeight
// are in points, converted from the em/unitless values in the CSS file.
export const type = {
  displayXl: {
    fontFamily: fonts.display.medium,
    fontSize: 34,
    lineHeight: 37.4,
    letterSpacing: -1.4,
  },
  displayLg: {
    fontFamily: fonts.display.medium,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -1.2,
  },
  displayMd: {
    fontFamily: fonts.display.semibold,
    fontSize: 24,
    lineHeight: 27.6,
    letterSpacing: -1,
  },
  // "Session & list-row titles" (typography.css hc-card-title) — no analog in
  // the old 9-variant scale; added so card/row title work has the right face.
  cardTitle: {
    fontFamily: fonts.display.semibold,
    fontSize: 15,
    lineHeight: 19.5,
    letterSpacing: -0.2,
  },
  label: {
    fontFamily: fonts.caps.bold,
    fontSize: 12,
    lineHeight: 15.6,
    letterSpacing: 1.75,
    textTransform: 'uppercase' as const,
  },
  // "Element identity, in its color" (typography.css hc-element-tag) — the
  // DimensionTag chip's own register, distinct from general caps labels.
  elementTag: {
    fontFamily: fonts.caps.bold,
    fontSize: 11,
    lineHeight: 14.3,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 21.7,
  },
  bodySm: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    lineHeight: 16.8,
  },
  // "The weight readout, primary stat" (typography.css hc-hero-number) — a
  // bigger tier above dataLg; no current call site, reserved for a future
  // hero stat display.
  heroNumber: {
    fontFamily: fonts.numbers.bold,
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: -2,
  },
  // fontVariant: tabular-nums matches typography.css's .hc-data-number exactly
  // (Space Grotesk is proportional; this is what keeps compared numbers
  // aligned). hc-hero-number doesn't set it — a hero stat stands alone.
  dataLg: {
    fontFamily: fonts.numbers.bold,
    fontSize: 24,
    lineHeight: 27.6,
    letterSpacing: -1,
    fontVariant: ['tabular-nums' as const],
  },
  data: {
    fontFamily: fonts.numbers.regular,
    fontSize: 14,
    lineHeight: 16.1,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums' as const],
  },
  dataSm: {
    fontFamily: fonts.numbers.regular,
    fontSize: 12,
    lineHeight: 13.8,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums' as const],
  },
};

export type TypeVariant = keyof typeof type;

// ─── Spacing (4px base ledger) ──────────────────────────────────────────────
// Unchanged by the swap — matches planning/design-system/tokens/spacing.css.
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
// Unchanged by the swap — matches planning/design-system/tokens/radius-shadow.css.
// No radius on chart containers or data panels — hard edges signal raw data.
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
};

// ─── Elevation (separation by surface step, not shadow) ─────────────────────
// Unchanged by the swap — matches planning/design-system/tokens/radius-shadow.css
// (hairline-border-first elevation; shadow is a light touch on top of that).
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
// Unchanged by the swap — matches planning/design-system/tokens/motion.css.
export const motion = {
  durationFast: 120, // hover, press feedback
  durationBase: 200, // panel transitions, tab switches
  durationSlow: 350, // modal enter/exit, chart line drawing
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
};
