# Phase 4, Pass 2 — Surface-driven logger + activity identity + honest GPS fidelity

**Goal:** Convert the logger from a `modality` switch to a **surface** switch, with
the chosen **activity** carried as an identity on the record. Behaviour-preserving
for gym/GPS/climbing; swim/practice render a "coming next" stub.
(planning/phase-4-training-plan.md, Pass 2)

## Pre-flight

Plan was stale: it said "no code yet", but **Pass 1 already shipped** (commit
`f3ae90d`). Re-baselined on current HEAD (`58cc06b`, after the concurrent Ring 2
food-schema commit landed mid-session): `tsc` exit 0, `jest` 46/46. After this
pass: `tsc` exit 0, `jest` **53/53** (+7 in `src/lib/__tests__/session.test.ts`).

## What shipped

- **`activity?: string` on `SessionPayload`** (`core/src/observation.ts`) — the
  identity label (e.g. `calisthenics`, `wingfoil`). No SQL migration: payload is a
  JSON column.
- **Surface/identity resolution** (`src/lib/session.ts`) — new `resolveSurface()`
  (activity → registry surface, else modality → surface) + `resolveModality()`
  (activity's nearest engine modality, else the picked one). `SessionForm` gains an
  optional `activity`. The user never picks a surface — the router is invisible.
- **Surface-driven build** — `buildSessionObservation` switches block-building on
  surface (gym→lifting, gps→endurance, climbing→climbing; swim/practice→no block
  yet; other→footer only) and writes `activity`. `validateSessionForm` gates the
  gym rules on the *surface*, so Calisthenics/Strength/CrossFit all get them.
- **Honest GPS fidelity** — fidelity is now a per-surface table: gym 0.95, **manual
  GPS/swim 0.5** (a typed distance is a guess without a wearable; Phase 3 import
  raises it), climbing/practice/other unchanged at 0.95.
- **Block-driven `reveal()` + inverse** (`core/src/stimulus.ts`, `session.ts`) —
  `reveal()` and `sessionFormFromObservation` follow the populated block, not the
  coarse modality. This (a) keeps every existing reveal string byte-identical,
  (b) fixes a latent `case 'swim'` fall-through, (c) lets Hike/Surf (GPS surface)
  reveal distance, and (d) round-trips identities that normalise to `other`
  (Surf/Wingfoil). The fallback duration line prefers the activity ("wingfoil ·
  40 min", not "other · 40 min").
- **Logger UI** (`app/log-session.tsx`) — step 1 is now an **activity** picker
  (headline + More, the registry) for Today's quick-log; the body resolves from the
  surface; swim/practice show a stub that still records duration/effort/note. Header
  + back-link show the activity label.
- **Routing** (`app/(tabs)/training.tsx`) — `logActivity` deep-links
  `?activity=<id>` (was `?modality=`); the identity now reaches the record.
- **Removed** the vestigial `isEndurance` / `ENDURANCE_MODALITIES` modality-era
  helpers (no remaining callers).

## Decisions applied

- Identity ≠ engine modality: Calisthenics and Strength are both `gym` surface.
- Fidelity falls out of the surface (structure), never a self-report dial.
- Swim/practice are honest stubs — a duration log, not a fake form — until Pass 5/6.

## Notes / follow-ups

- Verification was `tsc` + `jest` only (Expo/RN — no browser preview). Simulator
  smoke-test of the activity picker + GPS/stub bodies is worth a later interactive run.
- ⚠️ **Concurrency:** a parallel wearable-ingestion (HealthKit) effort is editing
  this working tree (uncommitted `package.json`/`app.json`/`eas.json`). This commit
  stages **only** the six Pass-2 files + this log — their work is left untouched.
  Pass 3b (expo-notifications) will need `app.json`/`package.json` edits that
  overlap theirs; coordinate before then.
