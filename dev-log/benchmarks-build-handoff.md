# Benchmarks build — handoff (Phase 5, Ring 1)

*Kickoff handoff for a fresh session building the benchmark layer. Source of truth is
`planning/benchmarks-spec.md` (**v0.3**, reconciled 2026-06-29) — read it first; this
doc is the build orientation, not a re-statement of the spec. Constitutional root:
spine rules 5 (no gamification), 6 (pull, not push), 7 (goals are yours) in
`planning/product-overview.md`.*

---

## The goal of this build

Get **benchmarks running end-to-end**: create one, have it resolve to something the app
tracks, and see its status surface on Today. This is the first slice that makes the goal
layer real. The richer Reflect dashboard comes *after* (see Sequencing).

## Sequencing — benchmarks first, Reflect-keyed view after (and Reflect's base already exists)

The question "build Reflect first or after?" is mostly already answered by the code:

- **Reflect's foundation is built.** `app/(tabs)/reflect.tsx` already renders the weight
  trend + weekly stimulus ledger — which *is* the spec's **no-benchmark default**
  (`benchmarks-spec.md`, "No-benchmark default"). Its own comment says benchmarks land on
  top "in the next Reflect pass." So you are not building Reflect from scratch.
- **Build order:** the benchmark *object* + entry + Today surfacing first (standalone
  value via Today's status card), **then** layer the benchmark-keyed view into Reflect
  (the three-layer hierarchy on top of the existing trend+ledger). Neither blocks the
  other for the first slice — Reflect already renders without benchmarks.
- This matches the spec: `benchmarks-spec.md` gates the full Reflect build; the benchmark
  model is the architectural *input* to Reflect, not the other way round.

## What already exists (build ON these, don't rewrite)

- `core/src/benchmark.ts` — the `Benchmark` type. Today it has: `id, createdAt,
  resolvedAt, status (active|achieved|abandoned|paused), title, description, targetDate,
  relatedModalities`. This is the **v0.1/v0.2 shape** — user's-own-words, no picker. It
  predates v0.3 and needs extending (below).
- `src/storage/benchmarks.ts` — full typed CRUD (`createBenchmark`, `listBenchmarks`,
  `getBenchmarkById`, `updateBenchmark`). Mutable (update, not supersede). Solid; extend it.
- `src/storage/serialize.ts` + the `benchmarks` table migration — referenced by the CRUD,
  so they exist. **Verify the migration is wired** before extending the schema.
- `app/(tabs)/reflect.tsx`, `training.tsx`, `index.tsx` (Today) — the surfaces a benchmark
  threads through. Benchmarks are **created/managed in Training**, **pinned on Today**,
  **mirrored over time in Reflect** (`benchmarks-spec.md`, "Three surfaces, one object").

## The v0.3 model delta (Pass 1 — design against the spec, don't over-invent)

The current `Benchmark` type can't express v0.3. Extend it per `benchmarks-spec.md` §"The
two goal families" and §"Three entry layers". What's missing:

- **Family / shape** — *cadence* (a rhythm per window) vs *trend* (a dimension moving,
  optionally to a threshold). The user never picks this; it's derived from the resolved
  dimension. Store enough to render each (`benchmarks-spec.md`, "The two goal families").
- **Resolved dimension** — v0.3's hard rule: a benchmark must resolve to a *trackable*
  dimension before it's a benchmark (unresolvable text is a **note**, not a benchmark).
  Today's `relatedModalities` is a soft hint; v0.3 wants a real resolved dimension. Decide
  how to represent "resolved vs note."
- **Cadence fields** — window (weekly/monthly), and event-count vs magnitude-sum target.
- **Trend fields** — direction, and optional threshold (target value). A threshold is a
  trend + a number, not a separate family.
- **Pinned** — which active benchmarks surface on Today.

Keep `status` lifecycle (active/achieved/abandoned/paused) — it already matches the spec's
Archiving/lifecycle section.

## Build slice (suggested passes — single-concern each)

1. **Model + storage + migration + tests.** Extend `Benchmark` (core) for v0.3; migrate the
   `benchmarks` table; update serialize + CRUD; unit tests against a **real** DB (house rule:
   don't mock the DB). No UI yet.
2. **Structured entry (the v1 path) in Training.** Create a benchmark by picking
   dimension → number/direction → window directly. **Deterministic, no LLM** — the spec's
   "weigh it out" path that ships first. Plus an active-benchmarks list to manage them.
3. **Today surfacing.** Pinned active benchmarks as at-a-glance status cards: cadence shows
   "2/4 this week" (a *factual count*, not a streak — no flame, no celebration); trend shows
   current-vs-target/direction. Counting reads existing logged sessions.
4. **(Next milestone, maybe next session) Reflect benchmark-keyed layer.** The three-layer
   hierarchy (benchmark frame → hero → supporting context) + MacroFactor-grammar dashboard,
   layered on the existing trend+ledger. This is the bigger piece.

**Deferred, do NOT build now:** the **Described** entry (keyword resolver → Haiku) and the
**Summoned coach** are Phase 7 / later (`benchmarks-spec.md`, "Build sequence"). v1 is the
Structured path only.

## Constitution guardrails (these are the easy lines to cross — hold them)

- **No category picker / no goal-type enum.** The user names the goal; the app resolves it.
  Family (cadence/trend) is inferred, never chosen.
- **Resolution gates existence, not desire.** Unresolvable → a note. The app never narrows
  what the user may want; it only refuses to pretend it can track what it can't see.
- **Count, never streak.** Cadence "3 weeks in a row" is a revealed fact — no flame, no
  loss-aversion, no shareable card, resets without drama (`benchmarks-spec.md`, "Consistency
  counters").
- **Pull, not push.** Status surfaces when you open the app; never a notification.

## Build discipline (house rules — from `feedback` memory + repo convention)

- Plan files first → **jest green** → **`tsc` LAST** (after the test files are written, not
  before). Single-concern commits with a dev-log entry per pass.
- Real DB in tests (mocks lied about reality once). 
- **Never commit `app.json`** — it holds Dylan's local Anthropic key; committed value is
  `null`. `git add` specific files, never `-A`.
- Verify on the iOS sim before declaring a pass done (the `verify` skill / `run` skill).

## Git setup

- Start from a clean `main`. Today's planning reconciliation is currently uncommitted on
  `main` — commit it first (docs-only; exclude `app.json`) so the branch starts clean.
- Branch: `phase-5-benchmarks` (matches the repo's `phase-N-*` convention).
- **Parallel-session hazard:** do not run a second Claude session in the same worktree at
  once — it corrupts `node_modules`/lockfile. Either work solo in `~/Projects/health-coach`,
  or use a dedicated worktree (`git worktree add ../health-coach-benchmarks -b
  phase-5-benchmarks`, then `npm install --legacy-peer-deps`).

## First step for the new session

Read `planning/benchmarks-spec.md` (v0.3) end-to-end, then `core/src/benchmark.ts` +
`src/storage/benchmarks.ts` + `app/(tabs)/reflect.tsx`, confirm the `benchmarks` migration
is wired, and propose the Pass 1 schema extension for review **before** writing it.
