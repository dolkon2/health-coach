# Phase 4, Pass 3a — Timestamped sets → derived gym duration

**Goal:** Make a gym session's duration fall out of *structure* — the spread of its
set timestamps — instead of being declared. Additive in this pass: the manual
duration field still stands as a fallback (it's removed in Pass 3b when the live
set-complete affordance lands). (planning/phase-4-training-plan.md, Pass 3)

## Note on history

This pass's code was authored against the old shared tree and was folded into the
`d0b19c2` "checkpoint: save in-flight work across all sessions" commit during the
worktree split. This log is the paper trail; the work is verified green on the new
`phase-4-training` baseline (Expo SDK 53, TS 5.8.3): **tsc** exit 0, **jest 73/73**.

## What shipped

- **`completedAt?: ISOInstant` on each lifting set** (`core/src/observation.ts`) —
  stamped live when a set is marked complete (the affordance is Pass 3b). Absent for
  batch-entered sets.
- **`deriveSessionDuration(sets)`** (`core/src/sessionTiming.ts`, new) — pure: the
  span between the first and last `completedAt`, rounded to whole minutes, with a
  fidelity that reflects capture. A lived spread → `{ durationMin, 0.95 }`. Clustered
  stamps (span < 2 min) or fewer than two stamps → `{ durationMin: null, 0.6 }` —
  duration is *unknown*, never a fabricated 0 (constitution: null ≠ 0).
- **Build wiring** (`src/lib/session.ts`) — `buildLifting` carries `completedAt`
  through; the gym branch derives duration from the set spread and, when it gets a
  real value, overrides the manual field and adopts the derived fidelity. With no/
  clustered stamps it falls back to the manually entered duration (current behaviour,
  preserved). `sessionFormFromObservation` restores `completedAt` so the round-trip
  holds. `SetDraft` gains an optional `completedAt`.
- **Tests** — `core/__tests__/sessionTiming.test.ts` (5: lived spread, clustered →
  null, < 2 stamps → null, ordering/skip-unstamped, threshold) + 4 build-integration
  cases in `src/lib/__tests__/session.test.ts` (derive overrides manual; manual
  stands with no stamps; manual stands when clustered; completedAt round-trips).

## Decisions applied

- Duration is derived, not declared — it falls out of structure (locked decision).
- Batch/clustered entry yields low/null fidelity, detected from the spread; never a
  fabricated number. Manual fallback remains only until Pass 3b removes the field.

## Follow-ups for Pass 3b

- The live set-complete affordance stamps `completedAt`; once it exists, remove the
  manual gym duration field and let `durationMin` be genuinely optional (honest
  null), updating the gym duration tests for the no-manual-field reality.
