# Pass 5 — Reflect screen (weight trend chart + stimulus ledger)

**Goal:** A real trend chart and a real stimulus ledger — the screen where Phase 1
starts feeling like a product. This is where `computeWeeklyStimulus()` gets its
real implementation and a test that drives it. (game-plan-and-prompts.md, Pass 5)

## Pre-flight

`/pass-status` equivalent at the start confirmed Pass 4 landed clean: `tsc`
exit 0, `jest` 21/21. Green baseline was real before building.

## What shipped

- **Stimulus engine** `core/src/stimulus.ts` — `computeWeeklyStimulus(sessions)`
  implemented for real (was `notImplemented`, "Pass 5"). Groups sessions by ISO
  week (new exported `isoWeekStart()` helper, Monday-anchored). Per week:
  - gym → per-`movementPattern` `{ sets, volumeLoadKg }`, **warm-ups excluded**
    (matches `reveal()` so the ledger and Today never disagree).
  - endurance → `byEnergySystem[…].minutes += durationMin`.
  - climb/hike/other → counted in `sessionIds` only (no fabricated pattern
    volume — the data model carries no load for a send). See quirk 9.
  Returns one `StimulusLedgerWeek` per week **with data**, oldest first; it does
  not invent empty weeks (that needs "now" — a UI concern). `byPattern` is
  sparsely populated; `byEnergySystem` always has its three keys. Speaks
  engine-native kg, like `reveal()` (quirk 6).
- **`useWeeklyStimulus`** `src/hooks/useWeeklyStimulus.ts` (new) — fetches the
  last ~70 days of session Observations, runs the engine, then windows into the
  fixed **8-week** display range (current ISO week + 7 prior), padding empty
  weeks so the timeline is honest about gaps. Also returns `sessionsById` so the
  ledger drill-down renders each contributing session's `reveal()` line with no
  second fetch. Mirrors `useWeightTrend`'s load/error/reload shape.
- **`useWeightTrend`** extended to also return `raw: ObservationOf<'weighIn'>[]`
  — the chart's dots need the actual reading + fidelity, which the smoothed
  trend points don't carry. The hook already fetched them; now it exposes them.
- **`WeightTrendChart`** `src/components/WeightTrendChart.tsx` (new) — custom SVG
  via `react-native-svg`, **no charting library**:
  - smoothed EWMA trend line in `--color-trend-line` (sage), 2px;
  - raw weigh-in dots styled by fidelity — solid filled (high), hollow ring
    (mid), dotted ring (low). All current weigh-ins are 0.95 → solid, but the
    hollow/dashed **infrastructure** is in place for a future low-fidelity source;
  - a confidence band that narrows as the engine's `confidence` climbs and widens
    across sparse stretches (gap term), filled at 0.15 opacity;
  - fixed y-axis strip + horizontal `ScrollView` for swipe-back-in-time (auto-
    scrolls to most-recent on mount). No gesture-handler needed.
  - tap a dot → inline readout (date · weight in display unit · fidelity bar);
    defaults to the latest reading.
  - hard edges, no border-radius (brand kit).
- **`StimulusLedger`** `src/components/StimulusLedger.tsx` (new) — custom SVG
  stacked bars, 8 weeks, segments by movement pattern. Colors from the
  **chart-series palette** (sage/sandstone/clay/slate) — never green/red; stable
  pattern→color map ranked by total volume, cycles the four series colors past
  four patterns with a legend to disambiguate. kg y-axis (quirk 6). Tap a week →
  inline drill-down listing that week's sessions via `reveal()`.
- **Reflect screen** `app/(tabs)/reflect.tsx` — renders the chart on top, ledger
  below, vertically scrollable; `useFocusEffect` reloads both on focus (Today's
  pattern, quirk 4). No TDEE — a single muted line: "Expenditure available once
  food logging is in (Phase 2)." Never a fake number.

## Decisions

1. **Engine reports, hook windows.** `computeWeeklyStimulus` stays pure and free
   of "now": it emits only weeks that have data. `useWeeklyStimulus` owns the
   8-week relative-to-today window and empty-week padding — exactly the split
   `trend.ts`/`useWeightTrend` already use.
2. **Custom SVG, not a library.** The fidelity dot styling and confidence band
   are the visual differentiator and don't retrofit onto an off-the-shelf chart
   (phase-1 open question). Rolled both charts by hand.
3. **Swipe via horizontal `ScrollView`, taps via SVG `onPress`.** No
   `react-native-gesture-handler` root wiring — the root layout doesn't install
   `GestureHandlerRootView`, so the RN-built-in path is simpler and robust.
4. **Honest empty states, never hidden.** Chart gates the smoothed curve at ≥7
   weigh-ins (acceptance #3), showing an `N/7` count below that. Ledger renders
   as soon as **any** session exists (won't hide real 1–3-session weeks); a muted
   sub-line notes "Patterns sharpen once a week has 4+ sessions" until one does
   (acceptance #4). Zero sessions → a plain "log sessions…" panel.
5. **kg on the ledger** — the ledger is the engine's voice, consistent with
   `reveal()` (quirk 6). Axis labeled `volume load (kg)`. Revisit alongside the
   reveal-units question if it grates with real data.
6. **Climb/hike show in the drill-down, not the bars** — no fabricated volume.
   Logged as a known visual gap (quirk 9).

## Verified

- `npx tsc --noEmit` clean.
- `npx jest` → **23/23 pass**, incl. new `src/__tests__/weeklyStimulus.test.ts`
  driving the real path: build sessions across two ISO weeks via
  `buildSessionObservation` → `createObservation` → windowed `listObservations`
  → filter sessions → `computeWeeklyStimulus`. Asserts week count + Monday
  `weekStart`s, per-pattern `{sets, volumeLoadKg}` with warm-ups excluded,
  energy-system minutes, complete per-week `sessionIds`, and that `[]` input is
  an honest empty ledger (not a throw).
- **iOS bundle** — `npx expo export --platform ios` succeeds; Metro resolves the
  two new components, the new hook, the engine change, and `react-native-svg`
  (web untested by design — quirk 3).
- On-device sim smoke test: handed to Dylan as a tap-through checklist.

## Next — ~2-week dogfood stop

Per Dylan's "Pass 5 Prompt.md" (Opus planning session, 2026-06-26): the minimum
useful loop is complete, so the next step is **using it for real for ~2 weeks**
before adding anything. Acceptance #6 ("you actually want to open it tomorrow")
is the only test that matters now, and it can't be coded.

**On hold pending dogfood (decided 2026-06-26):** a *weekly summary* section —
session count by modality + total working volume load above the current week's
reveal() lines. The ledger's tap-a-week drill-down already shows the reveal()
lines; the only missing piece is the aggregates. Dylan chose to HOLD rather than
pre-build — revisit only if the aggregates are actually missed in real use
(constitution: don't add until the need is proven). When built, the clean shape
is to upgrade the existing drill-down panel, not add a second redundant block.

**Roadmap correction (carry forward):** Benchmarks are NOT the next pass — they're
**Phase 5, Pass 2**, needing a Phase-5 spec + dogfood data + a domain-mapping
layer (keyword mapper → AI parser). Reflect's bigger arc (benchmark→hero-signal
mapping, hierarchy recomposition, correlation overlays, z-score detection, AI
forensics) is all post-dogfood, Phases 5/7. The separate logging deep-dive +
Garmin Connect ingestion ("ring 1" input pipeline) still stands as its own effort.

**Before dogfooding:** clear the dev sample seed (Settings → Developer → Clear
sample data) so the trend and ledger reflect only real entries — otherwise the
honesty rule is undermined by seeded data sitting in the charts.
