# Rework Session 10 — The rebrand swap PR (light-only)

**Date:** 2026-07-11 · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Commit:** `861c9c4` (1 commit on top of Session 9's `646df1b`)
**Model:** Sonnet 5, per session-playbook.md.

## What shipped

Executed `planning/rework/brand-integration.md` Pass 4-5: the mechanical swap
from the placeholder desert palette to the Gorge kit (design of record:
`planning/design-system/`), light-only.

1. **Fonts** — installed `@expo-google-fonts/space-grotesk`, `archivo`,
   `dm-sans`, `space-mono` (all `^0.4.x`, compatible with the pinned Expo
   SDK 53); removed `barlow-condensed`/`inter`/`jetbrains-mono`. Rewrote
   `fontMap.ts` to the 7 weight files actually needed.
2. **Colors** — `tokens.ts`'s `lightColors` translated byte-for-byte from
   `colors.css`: ground/text ramp, the four element hues (Earth `#8A7049` /
   Sky `#5E84A6` / Water `#4C8E85` / Body `#C15A39`), and the negative alert
   red (`#B00020`). **`darkColors` is now a literal alias of `lightColors`**
   (dark mode retired, not deferred) — kept only so `ColorScheme`/`ThemeProvider`
   stay compilable for a hypothetical future revisit.
3. **Fonts register + type scale** — 4 registers now (display/caps/body/numbers,
   renamed from display/body/data). 12 type variants translated from
   `typography.css`'s 9 classes, plus `elementTag`/`cardTitle`/`heroNumber`
   added to fully represent the artifact (only `elementTag` has a call site
   today — wired into `DimensionTag`). **Display headlines are no longer
   uppercase** — the artifact's own `.hc-display-head` etc. classes aren't
   capitalized; only the caps register (`label`/`elementTag`) is now, a real
   behavior change from the old Barlow-era "display is always uppercase" rule.
4. **Light-only** — `ThemeProvider`'s `initialScheme` default and its one real
   call site (`app/_layout.tsx`) both flipped to `'light'`; the Settings
   theme-toggle section removed; `app.json`'s `userInterfaceStyle` flipped
   dark→light (a native config value — **needs the next dev-client rebuild to
   actually take effect**, unlike the JS-only theme change).
5. **CTA color — Dylan's call, not the kit's own reference implementation:**
   neutral/monochrome buttons and active-states; the four elements are
   reserved for small accent dots/badges only. `accent` deliberately equals
   `text` (gray900, the ramp's darkest step) — this **overrides** the design
   system's own shipped `Button.jsx`/`FidelityIndicator.jsx` reference
   components, which use Body-rust as a universal CTA/confidence-bar color.
   Verified on-sim: monochrome buttons/tab-bar/selected-states read clean;
   element hues show up only as DimensionTag chips, route/session icons, and
   the StimulusLedger chart series.

## Code review (xhigh effort, 10 finder angles → 1-vote verify → sweep)

15 findings reported, 9 fixed, 6 flagged-not-fixed:

- **Fixed — Card's `raised` prop had gone silent (correctness):** the new
  light palette's `surface`/`surfaceRaised` collapsed to the same `#FFFFFF`
  (this is the artifact's own value, not a mistranslation), and `Card.tsx`
  never applied a shadow — so `<Card raised>` (SessionCard, DayMealList,
  GymExerciseEditor, edit-template, log-food) rendered pixel-identical to a
  plain Card. Fixed by lifting raised cards with `theme.shadow.sm`, matching
  the design system's own stated model ("card border + white fill" primary,
  "shadow a light touch on top").
- **Fixed — `ThemeProvider.tsx` still taught the reversed rule (correctness):**
  its header comment ("dark is the default, light is secondary") and
  `initialScheme` default (`'dark'`) both contradicted the new locked reality.
  Independently flagged by 5 of the 10 finder agents — the highest-consensus
  finding of the review.
- **Fixed — stale doc comments** in `Text.tsx` (claimed display is "always
  uppercase"; also missing `elementTag` from the textSecondary-default
  variant list), `SwipeToDelete.tsx` ("muted terracotta, not bright red" —
  negative IS the bright red now), `WeightTrendChart.tsx` ("tier-2, sage" —
  no sage left in the palette), `src/lib/date.ts` ("rendered uppercase"),
  and `planning/screens-features-status.md` (asserted the tokens "are NOT
  yet in tokens.ts" — this diff is exactly that migration).
- **Flagged, not fixed — numbers register font conflict (real, needs
  Dylan's call):** I put `numbers` on Space Mono per Dylan's explicit chat
  instruction ("numbers=Space Mono") and `Text.tsx`'s pre-existing "tabular
  mono" philosophy. But `typography.css`'s own `.hc-hero-number`/
  `.hc-data-number` classes — and its header comment ("Space Grotesk →
  numbers, headlines... one calm display face carries both") — specify
  Space Grotesk for numbers. Two independent review agents caught this as
  a genuine artifact conflict, not a bug either way. **Needs a decision, not
  a silent pick** — see flags below.
- **Flagged, not fixed — non-artifact color slots (caution/positive/
  modeled/neutral/trendLine):** `colors.css` only defines explicit hex for
  ground/text/four-elements/negative. The other semantic slots have no
  artifact value. I collapsed them onto the monochrome ramp (`caution` reuses
  `negative` itself, others reuse `text`/`textSecondary` steps) rather than
  inventing new hues, consistent with Dylan's "monochrome throughout"
  instruction. Concrete ripple: `WeekStrip`'s "food logged today" dot (a
  neutral fact) now renders in the same bold red as real errors, since
  `caution` and `negative` are now the same value.
- **Flagged, not fixed — `ThemeProvider`'s dead scheme-switch machinery
  (altitude):** `toggleScheme`/`setScheme`/the `ColorScheme` union stay fully
  wired even though dark mode is permanently retired, not deferred. Calling
  `toggleScheme()` today is a silent no-op (state flips, no pixel changes)
  rather than a compile error. The deeper fix — collapse `ColorScheme` to a
  literal `'light'` type and strip the toggle API — is a real architecture
  change beyond this session's token-swap scope.
- **Flagged, not fixed (low severity):** `modeled`/`neutral` color keys have
  zero consumers (kept because brand-integration.md's own handshake
  checklist lists them as required `ColorTokens` slots); `cardTitle`/
  `heroNumber` type variants have no call sites yet (added to fully
  represent the artifact's 9 typography classes); a pre-existing (not
  introduced here) missing `palette` dependency in `StimulusLedger`'s
  useMemo, now unreachable since scheme can't change; 5x duplicated inline
  SVG axis-label styling across three chart files (pre-existing pattern,
  only touched by this diff's `fonts.data`→`fonts.numbers` rename);
  `app/log-food.tsx`'s pre-existing hero macro readout wasn't migrated to
  the new numbers register (untouched file, missed-opportunity not a
  regression).

## Verification

- `npx jest`: **125 suites / 1307 tests** green throughout (before and after
  the code-review fixes). `npx tsc --noEmit`: clean, run last both times.
- **Sim smoke (iPhone 17, iOS 26.4):** full relaunch to pick up the new
  font/color bundle cleanly (not just Fast Refresh). Deep-linked and
  screenshotted: Home, Training (already visible pre-relaunch), Nutrition,
  Settings (confirmed theme toggle is gone), Profile (DimensionTag chips —
  BODY/EARTH/WATER/SKY — render in their element hues, borders+caps text),
  the Stimulus Ledger chart (chartSeries renders in the four element hues,
  legible and distinct), and a route detail map trace (MapLibre map-hero +
  monochrome route line). Re-verified Profile after the Card.tsx fix — the
  raised session cards now show a visible shadow lift. No red-screen errors;
  Metro logs show only pre-existing warnings (require-cycles, MapLibre style
  warnings, an unrelated GPS `[recording]` warning) — nothing new.
- **Contrast spot-check (Pass 5 ask):** `accent`/`text` (gray900) on `bg`:
  14.2:1, excellent. Element hues on white `surface`: Earth 4.67:1 (passes
  AA text), Body 4.39:1, Sky 3.94:1, Water 3.81:1 (these three pass 3:1
  UI-component/large-text but fall short of 4.5:1 for small body text — on
  the page `bg` instead of white, Water dips to 2.96:1, just under even 3:1).
  These are the artifact's own locked hex values, not something to
  unilaterally darken — flagging the numbers for awareness, particularly
  for the 11px `elementTag` caps text specifically, since DimensionTag is
  its only current consumer.

## ⚑ Flags (judgment calls made; flag, don't reinterpret)

- **⚑ Numbers register: Space Mono (my pick, per your chat instruction) vs.
  Space Grotesk (what typography.css's own shipped classes use).** Real
  conflict between two authoritative sources. Confirm which one ships.
- **⚑ Non-artifact color slots collapsed to monochrome** (caution/positive/
  modeled/neutral/trendLine) — reasonable under "monochrome throughout" but
  never explicitly confirmed slot-by-slot. Concrete example: WeekStrip's
  food-logged dot now reads as an error-red for a neutral fact.
- **⚑ `ThemeProvider`'s scheme-switch machinery is dead but still wired** —
  fine for now (harmless no-op), but the honest fix is collapsing
  `ColorScheme` to a literal `'light'` type. Deferred as an architecture
  change, not a token-swap concern.
- **⚑ `app.json`'s `userInterfaceStyle: 'light'` needs a native rebuild** to
  actually affect system chrome (keyboard, alerts) — the JS theme change
  took effect immediately via Fast Refresh, this one won't until the next
  dev-client build.
- **⚑ Element-hue contrast on white/bg** (Sky/Water specifically, 3.8-3.9:1
  on white, worse on `bg`) — below 4.5:1 text-AA, fine for icons/borders/
  dots, borderline for the 11px `elementTag` caps text itself.
- **⚑ `cardTitle`/`heroNumber` type variants added with no call sites** —
  a completeness-of-artifact-translation call, not a bug; flagged in case
  Dylan would rather they land alongside their first real consumer instead.

## Status / handoff

- **main @ `861c9c4`**, 1 commit ahead of Session 9's close-out (`646df1b`),
  NOT pushed (standing pattern this project follows).
- Working tree clean apart from the same pre-existing untracked files noted
  in Sessions 8 and 9's own dev-logs (`planning/nutrition-tab-v2-spec.md`,
  `planning/rework/research/fable-session-prompts.md`, `.claude/skills/`) —
  none of these are this session's work; left untouched.
- Sim left on the Profile tab-in, sample data unchanged (2 seeded routes,
  the pre-existing seeded gym/paddle/climb sessions from prior sessions'
  smoke tests) — nothing new seeded or cleaned up this session.
- **status-sync running next**, per the skill's own stated order (after
  dev-log-closeout, not before).
- **Ready for the Phase 4 planning session** per the playbook — this was
  the last session in the numbered sequence (1-10). See the handoff prompt
  for what Phase 4 needs to resolve first.
