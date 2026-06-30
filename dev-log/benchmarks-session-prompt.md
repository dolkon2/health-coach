# Benchmarks build — kickoff prompt

*Paste the block below into a fresh Claude Code session opened in `~/Projects/health-coach`
(on a clean `main`). It points the session at the full handoff.*

---

```
We're starting the benchmark layer (Phase 5, Ring 1).

First: create and check out a new branch `phase-5-benchmarks` off a clean main.
(If today's planning docs are still uncommitted on main, commit them first as a
docs-only commit — exclude app.json, which is never committed.)

Then read, in order:
  1. planning/benchmarks-spec.md   ← v0.3, the source of truth
  2. dev-log/benchmarks-build-handoff.md   ← the build orientation, sequencing, and pass plan
  3. core/src/benchmark.ts, src/storage/benchmarks.ts, app/(tabs)/reflect.tsx   ← what already exists

The goal of this first slice: get benchmarks running end-to-end — create one, have it
resolve to a tracked dimension, and surface its status on Today. Reflect's foundation
(trend + stimulus ledger) already exists; the benchmark-keyed Reflect view is a LATER
milestone, not this one. Structured entry only (deterministic, no LLM) — the Described
path and the summoned coach are deferred to Phase 7.

Before writing any code, confirm the `benchmarks` table migration is wired and propose
the Pass 1 schema extension (the v0.3 model delta — families, resolution, window, target)
for my review. Then build pass-by-pass: model+migration+tests (tsc LAST, real DB, jest
green) → Structured entry in Training → Today status cards. Single-concern commits with a
dev-log entry per pass. Verify on the iOS sim before calling a pass done.

Hold the constitution lines: no category picker, resolution-gates-existence (unresolvable
= a note), count-never-streak, pull-not-push.
```
