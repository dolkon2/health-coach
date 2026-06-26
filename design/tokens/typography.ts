export const typography = {
  fontFamily: {
    display: 'BarlowCondensed',
    body: 'Inter',
    data: 'JetBrainsMono',
  },

  // Display — section headers, hero stats. Always uppercase, tracked.
  display: {
    xl: { fontSize: 40, fontWeight: '700' as const, lineHeight: 40, letterSpacing: 40 * 0.04 },
    lg: { fontSize: 28, fontWeight: '700' as const, lineHeight: 30.8, letterSpacing: 28 * 0.04 },
    md: { fontSize: 20, fontWeight: '600' as const, lineHeight: 24, letterSpacing: 20 * 0.04 },
  },

  // Body — all UI, prose, labels
  body: {
    base: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22.5 },
    sm: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19.5 },
  },

  label: {
    base: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14.3, letterSpacing: 11 * 0.06 },
  },

  // Data — numbers in charts, stats, tables. Tabular figures.
  data: {
    lg: { fontSize: 24, fontWeight: '500' as const, lineHeight: 28.8, letterSpacing: -0.24 },
    base: { fontSize: 14, fontWeight: '400' as const, lineHeight: 19.6, letterSpacing: -0.14 },
    sm: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16.8, letterSpacing: -0.12 },
  },
};
