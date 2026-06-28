# Phase 4, Pass 5 — Swimming surface (pool + open-water)

**Goal:** Give Swim its own surface instead of the Pass-2 stub, and make it show in
the stimulus ledger as energy-system minutes (not `sessionIds`-only).
(planning/phase-4-training-plan.md, Pass 5)

Verified green: **tsc** exit 0, **jest 83/83**.

## What shipped

- **`SwimmingBlock` + `SwimStroke`** (`core/src/observation.ts`) — `distanceM?`,
  `poolLengthM?`, `laps?`, `stroke?`, and an `energySystem`. Added `swimming?` to
  `SessionPayload` (JSON column, no migration).
- **Pool distance = laps × pool length** (`src/lib/session.ts`, `buildSwimming`) —
  an audited total, so it earns higher fidelity (0.85) than an open-water estimate
  (0.5, a guess like a manual GPS distance). Pool length is metres; open-water
  distance is entered in display units and stored as metres.
- **`revealSwimming`** (`core/src/stimulus.ts`) — e.g. "aerobic · 30 min · 1,500 m ·
  freestyle". Swimming reads in metres (its native unit), not km. The reveal branch
  was inserted ahead of climbing so a swim never falls through to the duration line.
- **Ledger** — `computeWeeklyStimulus` now adds a swim's `durationMin` to its energy
  system, so swimming contributes minutes rather than only an id.
- **Swim form body** (`app/log-session.tsx`) — a Pool / Open-water toggle; pool shows
  length + laps with a live "Total: N m"; open-water takes a direct distance. Stroke
  + energy-system pickers. The pool length prefills from a new remembered default.
- **Settings** — `defaultPoolLengthM` (25 m).
- **Round-trip** — `sessionFormFromObservation` restores the swim body from a saved
  block (mode inferred from whether a pool length was recorded).

## Decisions applied

- Pool distance is laps × length, shown as a total (locked decision).
- Honest fidelity: an audited pool total > an open-water estimate.
- Practice keeps its "coming next" stub until Pass 6.

## Verification

`tsc` + `jest` (4 new: pool distance/fidelity/reveal, open-water, round-trip, and
the energy-system-minutes ledger contribution). Simulator smoke-test of the swim
body is worth a later interactive run.
