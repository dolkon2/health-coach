# Phase 5 · Pass 2.5 — the behavior/outcome collapse

*2026-07-01 · commits `54b5346` (spec v0.4) + `1ff3d26` (code) on branch `benchmarks`.
Slotted between Pass 2 (structured entry) and Pass 3 (Today status cards) because
Pass 3's cards need to know which face they're rendering.*

## The insight (from Dylan's meeting)

v0.3 had cadence goals and trend/threshold goals as two separate benchmark
*types*. The meeting surfaced that they're two **faces of every benchmark**, not
two categories: a controllable behavioral input (training frequency, logging
consistency) and a measured output (speed, weight, performance). This maps onto
the existing evidence-tier model — behavior ≈ tier-1 logged facts, outcome ≈
tier-2 accumulated — and *simplifies* the spec rather than complicating it.

Vocabulary settled with Dylan: **behavior / outcome**. Behavior is sovereign —
the user gets to feel good about holding it directly. Outcome is observed,
never moralized. Behavior-only benchmarks are valid ("sometimes I don't care
about certain goals, I just want to be consistent" — Dylan). Both faces is the
richest case: the outcome names success, the behavior is *your own chosen path
to it*.

## What changed

- **Spec v0.4** (`planning/benchmarks-spec.md`): "The two goal families" →
  "The two faces of every benchmark". Downstream sections reconciled (entry
  layers, three surfaces, layout key, consistency counters, Plan modes,
  constitution audit). New open question: per-face lifecycle. Answered
  question: when both faces exist, the **outcome face keys the Reflect hero**,
  behavior renders beneath as consistency context; behavior-only promotes the
  rhythm itself.
- **Model** (`core/src/benchmark.ts`): `BehaviorFace` (dimension + window +
  measure) and `OutcomeFace` (dimension + direction + target?) replace
  `shape: CadenceShape | TrendShape`. Both optional on `Benchmark`, ≥1
  required — enforced in `benchmarkToRow` (the write boundary), kept loose in
  the type so partial updates stay ergonomic.
- **Each face carries its own dimension.** This is the one place the build
  deviated from the pre-approved sketch (which kept a single top-level
  `resolution`): the dual-face case is cross-dimension *by nature* — "train
  4×/week" resolves to sessionCount while "weight down" resolves to bodyweight,
  in one benchmark. A single resolution couldn't represent the exact case the
  collapse exists to support, so the existence gate moved per-face. Flagged,
  not silently reinterpreted.
- **Migration 008** (`benchmark_faces`): adds `behavior`/`outcome` JSON columns
  and rewrites legacy v0.3 rows into faces with SQLite JSON1 (`resolution`
  moves inside each face as its `dimension`; targetless trends omit the key —
  absent, not null). Needed after all — the earlier "no migration needed"
  claim missed that Dylan's sim DB has real Pass-2 rows. Old
  `resolution`/`shape` columns left dead (additive discipline; never edit a
  shipped migration). The rewrite is guarded (`AND behavior IS NULL`) so it's
  idempotent, and exported separately (`legacyShapeRewrite`) so the test can
  exercise it against hand-planted legacy rows.
- **Entry** (`benchmarkForm.ts` + `app/edit-benchmark.tsx`): the step-1 pick
  seeds the *primary* face (activity → behavior, bodyweight → outcome);
  the other face is **pairable** via a quiet link — never pushed, one tap to
  remove. Bodyweight path's paired behavior defaults to *any* logged session
  (bare `sessionCount`) with chips to narrow by activity. Face cards carry
  their register in the header: "the part you control" / "the part you watch".
  Still no goal-type picker anywhere; `familyOf` → `primaryFaceOf`.
- **Face removal on edit**: `updateBenchmark`'s spread merge only sheds a face
  when the key is passed explicitly as `undefined`; `buildBenchmarkFields`
  therefore always returns both face keys. Shedding the last face throws.

## Verified

272 jest (26 suites; was 264 — net +8 from dual-face, any-session, pairing
validation, and migration-rewrite tests), tsc 0 (run last, after tests —
house rule), `expo export --platform ios` clean (6.35 MB hbc). Not
sim-verified — the pairing UI (expander links, face cards, activity chips)
wants a tap-through when Dylan next runs the benchmarks sim.

## Pass 3 implications

Today status cards get simpler, not harder: one card per pinned benchmark,
behavior line when the face exists ("Kayak: 2/4 this week" — factual count,
no streak), outcome line when it exists ("trending down, 1.2 kg to go" —
observed, unmoralized), both lines for dual-face with behavior on top (you
control it) and outcome below (you watch it). The two render paths from the
old families become two optional *lines* of one card.

## Left open

- `phase-6-plan-tab-spec.md` still speaks v0.3 ("cadence benchmark") —
  reconcile when Phase 6 builds (noted in spec v0.4's build sequence).
- `relatedModalities` still dead on the model — cleanup pass later.
- Per-face lifecycle (archive/complete one face) — spec open question, v1 is
  whole-benchmark.
