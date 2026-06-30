# Phase 5 — Pass 1: Benchmark v0.3 model + migration + storage

*Date: 2026-06-29 · Worktree: `~/Projects/health-coach` · Branch: `phase-5-benchmarks`*

---

## TL;DR

The data layer for the goal layer. A `Benchmark` now carries the v0.3 structure
from `planning/benchmarks-spec.md`: it **resolves to a tracked dimension** (the
existence gate), behaves as one of **two shapes** (cadence | trend), and can be
**pinned** to Today. No UI yet — this pass is the architectural input the
Structured-entry screen (Pass 2) and Today cards (Pass 3) build on.

**Verify posture:** `npx jest` → **25 suites, 254 tests** (7 new, real
better-sqlite3 in-memory DB, no mocks). `npx tsc --noEmit` → **0 errors**. No sim
verify this pass — there is no observable UI yet; the data layer is proven by the
round-trip tests.

---

## What shipped

### The model (`core/src/benchmark.ts`)

Extended the v0.1/v0.2 `Benchmark` type. Three additions, nothing removed:

- `resolution: ResolvedDimension` — **required.** The existence gate: a benchmark
  must resolve to a dimension the app actually tracks, or it isn't a benchmark
  (unresolvable text is a *note*, deferred with the Described path). Pass 1 wires
  the two dimensions the app already renders — `{ metric: 'sessionCount',
  modality?, activity? }` (cadence-count, reads logged sessions) and
  `{ metric: 'bodyweight' }` (the trend dimension). The union grows additively
  (distance, exerciseLoad, steps, … sketched in a comment, not built).
- `shape: BenchmarkShape` — `CadenceShape` (window week/month + a `count` or
  `magnitude` measure) or `TrendShape` (direction up/down + optional `target`
  threshold). `family` is the union discriminant, set by the constructor from
  *what the user fills in*, never picked from a menu.
- `pinned: boolean` — true ⇒ surfaces on Today.

`relatedModalities` kept as a soft engine-hint (now superseded by
`resolution.modality`; flagged for a later cleanup, not dropped — append-only).

### Migration 007 (`src/storage/migrations/007_benchmark_v03.ts`)

Additive `ALTER TABLE benchmarks ADD COLUMN` ×3 — `resolution TEXT`, `shape TEXT`
(both JSON, same pattern as `observations.payload` / `session_templates.shape`),
`pinned INTEGER` (0/1, like `isActive`). Registered in `migrations/index.ts`.
Migration 001 untouched. The table ships empty (no entry UI ever created a
benchmark before v0.3), so there is nothing to backfill.

### Serialize + CRUD

- `src/storage/serialize.ts` — `BenchmarkRow` gains the three columns;
  `benchmarkToRow`/`rowToBenchmark` stringify/parse `resolution` + `shape` and
  hydrate `pinned` 0/1 ↔ boolean. `resolution`/`shape` are non-null in the row
  type — they're semantically required and every write provides them.
- `src/storage/benchmarks.ts` — the three columns threaded into `COLUMNS`, the
  INSERT placeholder list, and the UPDATE SET clause. No signature changes; the
  existing mutable-update contract is unchanged.

### Tests (`src/storage/__tests__/benchmarks.test.ts` — 7, real DB)

Cadence round-trip (resolution + measure + discriminator intact); trend
round-trip (threshold target preserved, pure trend omits it); resolution stays
present (the gate); `listBenchmarks` status filter + createdAt-desc order;
`updateBenchmark` patch + merged shape persisted; missing-id throws; `pinned`
0/1 ↔ boolean.

---

## Decisions made (Dylan blessed before the build)

1. **`resolution` is required, not nullable.** Strongest encoding of
   resolution-gates-existence — an un-resolvable benchmark cannot be constructed.
   The *note* (degraded path for un-resolvable text) is therefore a separate
   object, built later with the Described entry path (Phase 7). Costs nothing in
   Pass 1: Structured entry only picks real tracked dimensions, so resolution
   can't fail by construction.
2. **Pass 1 dimensions = `sessionCount` (cadence) + `bodyweight` (trend).** The
   two the app already renders, so Today (Pass 3) runs on real data with zero new
   engine work, and both families are proven end-to-end. Magnitude/distance,
   exercise-load, steps, etc. are type-ready, wired later.
3. **New benchmarks default `pinned = true`** (decided; consumed when the entry
   UI lands in Pass 2).
4. **Naming `shape` / `measure`** — `shape` is the spec's own word ("two shapes").

## Constitution lines held

- **No category picker / no goal-type enum.** No family selector exists; `family`
  is derived from the fields filled, never chosen.
- **Resolution gates existence.** `resolution` required at the type level.
- **Count, never streak.** The schema stores only `target` + `window` — no
  streak, no milestone, no "best run" column. Today computes "2/4 this week" live
  and lets it reset without drama. Nothing here can author a reward.
- **Pull, not push.** No schedule/reminder/notification field. `pinned` only
  governs whether Today *surfaces* it on open.

---

## Files changed

```
core/src/benchmark.ts                              (+~70 lines: types + Benchmark fields)
src/storage/migrations/007_benchmark_v03.ts        NEW
src/storage/migrations/index.ts                    (import + registry entry)
src/storage/serialize.ts                           (BenchmarkRow + to/from row)
src/storage/benchmarks.ts                          (COLUMNS + INSERT/UPDATE)
src/storage/__tests__/benchmarks.test.ts           NEW (7 tests)
dev-log/phase-5-pass-1.md                          NEW (this file)
```

(`core/src/index.ts` untouched — it `export *`s from `./benchmark`, so the new
types are re-exported automatically.)

## Test posture

- `npx jest` → **25 suites, 254 tests, all green** (7 new benchmark tests).
- `npx tsc --noEmit` → **0 errors** (run last, after the tests were written).

---

## Next — Pass 2: Structured entry in Training

Build the deterministic "weigh it out" creation path (no LLM): pick dimension →
number/direction → window, the `shape` falling out of which fields are filled
(no family picker). Plus an active-benchmarks list to manage them. Then Pass 3
surfaces pinned actives on Today as factual status cards. The benchmark-keyed
Reflect view is the later milestone (its foundation — trend + stimulus ledger —
already renders as the no-benchmark default).
