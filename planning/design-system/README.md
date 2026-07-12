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
- `tokens/typography.css` — 4 families / 3 registers (Space Grotesk numbers — resolved
  2026-07-12, was Space Mono at snapshot time — · Space Grotesk headlines · Archivo caps
  labels · DM Sans body) + the full shipped type scale
- `tokens/spacing.css` — 4px ledger
- `tokens/radius-shadow.css` — 3-step radius, hairline-border-first elevation
- `tokens/motion.css` — easings + 120/200/350ms durations

These are CSS-flavored reference values; the swap PR (brand-integration.md Pass 4)
translated them into `src/theme/tokens.ts` (Session 10, 2026-07-11 — see
`dev-log/rework-session-10-rebrand-swap.md`). If the claude.ai project changes, re-snapshot
via the DesignSync tool rather than hand-editing here.

## `ui_kits/mobile-app/` — Phase 4 mockup snapshot (2026-07-12)

`index.html` + `HealthCoachApp.jsx`: a bespoke, self-contained React mockup (NOT wired to
the `components/` library) of all five shipped-brand tabs — Home / Training / Map /
Nutrition / Social — with a light/dark toggle (the toggle is a mockup convenience; the app
itself is light-only per the locked decision above). Open with any static server or the
`_ds_bundle.js` design-system harness.

**What this snapshot resolves vs. leaves open** (dashed "OPEN ·" badges in the mockup mark
Dylan's own unresolved spots — read them as source of truth over any inference):
- **Resolved-looking:** Training's top `Templates | Routes` segmented switch (matches
  Nutrition's Intake/Trend `ChipSelect` pattern) — built into `app/(tabs)/training.tsx` this
  session; see `planning/rework/tabs/training-tab.md` ⚑1 for the flag this raises against
  the spec's older "no mode toggle" framing. Map's Record-mode chrome (mode switch chip,
  sport-arm chips, session-detail card) reads as settled styling, already close to what's
  shipped.
- **Still open in the mockup itself** (do not treat as resolved just because this snapshot
  landed): Map's **Explore layout** ("OPEN · EXPLORE LAYOUT" — Dylan has not designed this
  yet, despite Phase 4 item 27/M5 being framed as "gated on Dylan's in-flight design"),
  Home's benchmarks module order, Training's routes-list layout + logbook location,
  Nutrition's trend-chart layout + hit/missed/unknowable wording, Social's groups-list
  layout.
- **Terrain palette:** `MapScreen`'s hand-drawn `TerrainMap` SVG (sage/moss greens, not the
  app's monochrome Ground ramp) is the visual reference for the real MapTiler style now
  wired in via `.env.local`'s `EXPO_PUBLIC_MAP_STYLE_ID` (style `019f3285-…`, swapped
  2026-07-12) — confirmed rendering on the pinned MapLibre v10.4.2 in sim. The mockup's SVG
  terrain is illustrative only, not something to port pixel-for-pixel; the 3D terrain
  exaggeration Dylan wants needs the SDK/MapLibre v11 upgrade (master-plan.md Phase 4 item
  26) — v10 renders the style's base colors fine but flat.
