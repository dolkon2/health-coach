# Dimension Sky — Pass 1 (Track A foundation + Track B research)

**Date:** 2026-07-05/06 · **Branch:** `dimension/sky` · **Worktree:** `~/Projects/health-coach-sky`
**Verification:** 58 suites / 592 tests passing (native jest-expo), `tsc --noEmit` clean, run after all test files written (tsc last).

## What landed (7 commits)

| Commit | Concern |
|---|---|
| `a9e452f` | docs: session orientation (`planning/dimension-sky-session.md`) |
| `22f6cf3` | IGC parser (`src/lib/igcImport.ts`) + shared flight stats (`src/lib/flightStats.ts`) |
| `67a24e7` | Gear/quiver entity — `core/src/gear.ts`, migration **010**, `src/storage/gear.ts` |
| `b16583a` | USHPA ledger — `core/src/ushpaLedger.ts` (pure, descriptive-only), reserved benchmark dims |
| `eed4d64` | Spot entity — `core/src/spot.ts`, migration **011**, `src/storage/spots.ts` |
| `383db6c` | Conditions freeze — `core/src/conditions.ts`, Open-Meteo fetch, migration **012**, insert-only storage |
| `f4c6bfb` | docs: Track B research (`planning/sky-research-track-b.md`) |

**Not built yet (by design):** takeoff/landing detector, flight/session schema, ingest wiring, parakite gear fields — all gated on Dylan's calls on the research doc's §4 flags.

## ⚑ Build flags for review (curated)

### IGC parser / flight stats
- ⚑ Both-altitudes-zero → **no** `eleM` (absent over fabricated zero; baro-less recorders write `00000`). A genuine sea-level fix reading exactly 0/0 loses elevation — judged acceptable.
- ⚑ `maxClimbRateMS` is `undefined` for a never-climbing flight (not a negative "climb"); `maxSinkRateMS` reports sink as positive magnitude; `maxDescentM` is an honest `0` for climb-only tracks.
- ⚑ Flight `name`: HFGID (glider ID) wins over HFPLT (pilot) when both present.
- ⚑ HFDTE two-digit year pivots at 80 (≥80 → 19xx) so 1990s archive files don't land in 2090.
- ⚑ Midnight rollover requires a >12 h backward time jump — out-of-order fixes can't falsely advance the date.
- ⚑ Rate windows: stat is `undefined` when the track's whole time spread is shorter than the smoothing window (no full-span fallback).

### Gear
- ⚑ Hard `deleteGear` exists alongside soft `retireGear` (parity with existing modules); retire is the documented default end-of-life.
- ⚑ `wingTotalHours`: tracked hours without a baseline = the known floor of the wing's life; `undefined` only when baseline unknown AND tracked = 0.
- ⚑ `repackDueAt` clamps month-end (Jan 31 + 1 mo → Feb 28/29); **no default repack interval** — user-set, descriptive.

### USHPA ledger
- ⚑ `USHPA_P3` = 90 flights / 20 h / 30 flying days (per product spec). **P4 deliberately omitted** until real numbers are verified against the USHPA SOP — never guessed.
- ⚑ `DEFAULT_COUNTED_STYLES = ['xc','hikefly']` — Hike & Fly counts toward the ledger by default; one-line change if Dylan rules otherwise.
- ⚑ Ledger's style union deliberately duplicates `WingSpec['style']` (not shared) to stay decoupled until the flight schema lands — revisit then.

### Spots / conditions
- ⚑ `fetchConditionsSnapshot` returns `null` on non-OK responses (repo's honest-miss fetch pattern, same as OFF/USDA).
- ⚑ Surface block prefers the API's `current` block (conditions AT capture); aloft always nearest-hour (pressure-level vars are hourly-only). Nearest-hour tie → earlier hour; out-of-range clamps.
- ⚑ `conditions_snapshots` is insert-only with no `createdAt` (capturedAt IS the write time) and no FK to spots (no FK precedent in this schema; frozen snapshots are captured facts).
- ⚑ `deleteSpot` is a hard delete (spots are places, not lifecycle entities); a deleted spot leaves snapshots keyed to a dangling spotId — accepted.
- Fixed a **flaky test** (pre-existing pattern hazard, worth knowing): jest's `.rejects` mis-unwrapped a native better-sqlite3 error under parallel workers (~3/8 full runs). First native-error `.rejects` in the repo. Fix: try/catch + message match. 7/7 green after.

## Environment note
Fresh worktrees have no `node_modules`; installed here via `npm ci --legacy-peer-deps` (lockfile untouched). Agents' interim scratchpad-harness test runs were superseded by native full-suite verification.

## Next (blocked on Dylan)
Read `planning/sky-research-track-b.md` §4 (7 ⚑ flags: parakite merge window, ski-vs-air fallback, ground-kiting accounting, speedfly Flight materialization, retrim nudge, wind capture UX, snow run-grouping deferral). Then: detector build → SkySession/Flight schema (migration 013+) → ingest wiring → USHPA ledger evaluator wiring.
