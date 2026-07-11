# Health Coach Design System — token snapshot (design of record)

Snapshot taken 2026-07-11 from the claude.ai/design project **"Health Coach Design System"**
(projectId `3d618119-dc01-4d82-a3e9-f73f1eb05490`, source of truth: `uploads/Health Coach Brand Kit (Light).html` in that project).

**Dylan's locked decisions (2026-07-11):**
- This kit is **fact — the design of record**. Anything older is superseded in full:
  `planning/brand-kit.md` (old dark-primary kit) and `planning/brand-kit-gorge-draft.md`
  (forest/river palette) are both dead when they conflict with these files.
- **Light-only. No dark mode at launch.** The swap PR must flip `ThemeProvider`'s
  `initialScheme` away from dark (and hide/stub the toggle), not just substitute values.

**Contents** — verbatim copies of the design system's token files:
- `tokens/colors.css` — monochrome basalt→spray ramp, light ground, the four element colors
  (Earth `#8A7049` · Sky `#5E84A6` · Water `#4C8E85` · Body `#C15A39`), fidelity opacities
- `tokens/typography.css` — 4 families / 3 registers (Space Mono numbers · Space Grotesk
  headlines · Archivo caps labels · DM Sans body) + the full shipped type scale
- `tokens/spacing.css` — 4px ledger
- `tokens/radius-shadow.css` — 3-step radius, hairline-border-first elevation
- `tokens/motion.css` — easings + 120/200/350ms durations

These are CSS-flavored reference values; the swap PR (brand-integration.md Pass 4)
translates them into `src/theme/tokens.ts`. If the claude.ai project changes, re-snapshot
via the DesignSync tool rather than hand-editing here.
