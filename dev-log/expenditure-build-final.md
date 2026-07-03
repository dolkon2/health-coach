# Expenditure build — final handoff (overnight session, 2026-07-03)

*Fable, hands-off overnight run. Brief: `dev-log/tdee-expenditure-build-handoff.md`.
All six passes (A–F) built, verified, committed on `benchmarks`. Per-pass detail
in `dev-log/expenditure-pass-{a…f}.md`. Morning checklist:
`dev-log/morning-smoke-test.md` — the sim is left set up for it (below).*

## State

- **391 jest green** (305 → 391), `expo export --platform ios` clean, `tsc` 0
  (run LAST, every pass). Commits: `a8a5c1d` (A) → `a3d4f22` (B) → `16a9c0c` (C)
  → `830c835` (D) → `5101491` (E) → `1c97d27` (F) → `bb56c24` (verification fixes).
- **Sim-verified headless** (iPhone 17, udid `4DD9794E`, dev-client via Metro
  port 8095 from THIS worktree): Today's three-valued cards, fidelity share,
  energy-balance line (measured AND not-enough-data states), Nutrition burn
  card (measured AND predicted registers), capture labels on meal rows,
  Reflect nutrition lens (numeric energy-balance hero + hazed rhythm + chips),
  step-1 nutrition tiles, body-profile hydration (ft/in). Screenshots in the
  session scratchpad; old training benchmarks confirmed unregressed.
- **10-agent adversarial review** over the whole diff: 6 findings, 5 refuted
  with evidence, 1 confirmed (edit-mode hydration flash) and fixed. Sim
  verification caught one more real bug (today's half-eaten day counted as
  final intake, biasing measured TDEE low) — fixed + tested (`bb56c24`).

## Sim bench (left running for the morning test)

- iPhone 17 sim BOOTED, app installed, Metro on **port 8095** serving this
  worktree (other sessions' Metros on 8090/8091 untouched).
- Seeded rows all carry the `seed-` id prefix: 9 `seed-f-*` foodEntries
  (Jun 29–Jul 3: hit/unknowable/missed protein days; T3/T2/T1 mix),
  3 nutrition benchmarks (`seed-b-protein`, `seed-b-fidelity`,
  `seed-b-calories` w/ energyBalance outcome), and a `bodyProfile` settings
  row (180 cm / 1996 / male / 18% / moderate). Wipe: delete `seed-f-*` +
  the three `seed-b-*` rows + the settings row, or Settings → clear sample data
  for the older rows.

## ⚑ Flags for Dylan (honest defaults taken, not silently decided)

1. **Deficit size** — calorie prefill = current burn estimate − **300** kcal
   (`SUGGESTED_DEFICIT_KCAL`); "deficit for a weight goal" was locked, the size
   wasn't.
2. **Bodyfat source** — baseline reads the PROFILE's bodyfat only; weigh-ins
   also carry one (smart-scale). Should a fresher weigh-in bodyfat win?
3. **Day-grain rhythm** — days-benchmarks render per-WINDOW hit bars with
   three-valued haze; a per-day grid inside the current window would be a
   strict upgrade (day verdicts already computed in `evaluateDaysWindow.byDate`).
4. **Macro-switch reset** — switching the macro chip resets the amount
   (protein → its suggestion, others → blank). Deterministic; feel-check it.
5. **Early-hit current window extends the run** — a days-window already
   provably hit counts into the revealed run before it closes (irreversible
   verdict); session-count windows still wait for the window to close. Defensible
   asymmetry, worth a glance.
6. (Cosmetic) height-unit preference isn't persisted; defaults from weightUnit.

## Smoke-test veto points (pre-answered)

- **#1 prefill vs suggest-on-tap**: built PRE-FILLED (the handoff locked
  "default the field to the suggestion").
- **#2 energy-balance visibility**: built VISIBLE with an honest
  "not enough data to measure yet" (sim-verified both states).

## NOT built (recorded, per handoff)

- **Training ↔ measured-burn correlation** ("your real multiplier is ~1.6") —
  correlation engine, own spec. The measured TDEE ships without it. The
  firewall held everywhere: session data never touches the expenditure path.
- **Step + sleep benchmarks** — still commented rows in `core/src/benchmark.ts`.
- **Plan-tab activity Route 2** — waits on the Plan tab.
- Phase-7 earned fidelity remains an honest `notImplemented` stub.

## Follow-ups worth a card

- Merge `benchmarks` → main once Dylan's smoke test passes (extends PRO-63).
- Day-grid rhythm component (flag 3). Correlation engine milestone.
- `useSettings` still returns hardcoded units — the settings table (M009) is
  its natural home now.
