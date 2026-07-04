# GPS & Mapping — build session prompt (Phases 1–2)

*Handoff for an autonomous build session. Scope: the pure-`core/` GPS spine + storage
wiring, reconciled with existing code. Stops at the map-render boundary (needs a human for a
tile-provider API key). Recommended model: **Opus 4.8** — this is correctness-critical work
that must reconcile with existing code, run unsupervised.*

## Mission

Build the **GPS tracking spine** for the training stack: the pieces that turn a GPS file or
a HealthKit route into a clean, tiered, canonical `Track` that lands on the timeline as an
Observation — with tests, matching this codebase's conventions, breaking nothing. This is
the foundation every outdoor sport (running, hiking, skiing, paragliding, whitewater,
wing/kite) sits on. You are building the innermost ring; the map render, sport overlays, and
3D replay come in later sessions.

**This is not greenfield.** A GPS *logging surface* and a HealthKit ingestion pattern already
exist and are waiting for exactly this work. Your job is to slot into those seams, not build
parallel ones. **Read the existing code before writing any.** (The first attempt at this plan
skipped that step and referenced files as hypothetical that already existed — don't repeat
it.)

## Branch

Work on `claude/mapping-systems-research-cit3ol` (already has the planning docs). Commit in
single-concern commits; push when green.

## Read first, in this order

1. `CLAUDE.md` + `planning/claude-md.md` — the constitution. Non-negotiable.
2. `planning/mapping-architecture-spec.md` — **the build contract.** The 6-layer model, the
   route-field reconciliation decision, the `GeoPoint` extension, the phase order. This
   session is Phases 1–2 of that doc.
3. `planning/mapping-systems-research.md` + `planning/sport-mapping-research.md` — the "why"
   behind the choices (Strava's elevation model, deck.gl timestamp constraint, RDP, etc.).
4. `planning/wearable-ingestion-spec.md` — the GPS-route strategy and the tier/fidelity table
   (imported route ≈ 0.95).
5. **The existing code you must reconcile with (read all of it):**
   - `core/src/observation.ts` — `GeoPoint`, `EnduranceBlock.gpsPath`, `PaddlingBlock.gpsPath`,
     `SessionPayload.activity`. The types you extend.
   - `core/src/trend.ts` — the closest analog to what you're building (noisy tier-1 →
     smooth tier-2, confidence as a first-class output). Match its shape and doc-comment tone.
   - `src/lib/session.ts` — the GPS logging surface. Note `SURFACE_FIDELITY.gps = 0.5` with
     the comment *"Phase 3 import will raise it"* — that is the hook your work fills.
   - `src/lib/activity.ts` — the identity→surface→modality registry.
   - `src/lib/healthkit/{reader,ingest,normalize,sourcePrecedence}.ts` — the ingestion
     pattern to mirror. `reader.ts::readActivities()` is a `notImplemented(..., 'Phase 3
     Pass 3')` stub — the eventual home of HealthKit route import (a *later* session, but know
     it's there so your Track types fit it).
   - `core/__tests__/trend.test.ts` + `core/src/nutrition/__fixtures__/` — test + fixture
     conventions.

## Scope THIS session (Phases 1–2)

### Phase 1a — Reconcile the route field (do this first, it's a decision, not code)

Per the architecture spec: **`gpsPath: GeoPoint[]` on the block is canonical.** GeoJSON is a
render-time projection, not stored. Add a one-line clarifying note to
`training-logging-spec.md` (`gps_data.route`) and `wearable-ingestion-spec.md` (`route`)
pointing at `gpsPath` as canonical. No schema migration — these are prose docs.

### Phase 1b — Extend `GeoPoint` (non-breaking)

In `observation.ts`, add *optional* fields only (nothing existing may break):
- `eleSource?: 'barometric' | 'gps' | 'dem' | 'none'`
- `hrBpm?: number`, `speedMps?: number`
- Document that `tsSec` is **seconds since activity start** (rebased), not Unix epoch.

### Phase 1c — `core/src/track.ts` (the de-risking layer — the heart of this session)

A pure, platform-free engine (no Expo, no map, no network — like `trend.ts`). Raw points →
canonical `Track`:
- **Outlier rejection** — drop impossible-speed teleports, dup timestamps, null coords.
- **Elevation source tiering** — carry `eleSource` per point; a `dem` correction NEVER
  overwrites a `barometric` reading (constitution: tier-3/derived never overwrites tier-1).
- **RDP simplification** — `simplify(track, toleranceM)`; store full-res, render simplified.
- **Timestamp rebasing** — seconds-since-start (deck.gl float32 constraint).
- **Summary stats** — haversine distance, moving vs elapsed duration, elevation gain/loss
  from the *tiered* elevation with confidence reflecting the source, bbox for camera/offline.
- **Confidence is a first-class output**; "not enough data" returns null, never a fabricated
  number (match `trend.ts`).
- Export from `core/src/index.ts`.

### Phase 1d — GPX ingestion adapter

`core/src/geo/gpx.ts` (or similar): pure-text GPX → `RawTrackPoint[]` feeding `track.ts`.
No deps. Proves the adapter contract end-to-end for the hiking/running first slice. (FIT, IGC,
HealthKit-route adapters are LATER sessions — do not build them now.)

### Phase 2 — Persistence + fidelity reconciliation

- Wire a normalized `Track` into a session Observation's `gpsPath` (the existing
  `EnduranceBlock`/`PaddlingBlock` field). Follow the `healthkit/normalize.ts` pattern (pure
  normalize, tier/fidelity/source stamped, tested).
- **Raise fidelity above the 0.5 manual placeholder** when a real track is present, keyed on
  elevation source (barometric ≈ 0.95 per the wearable spec table; GPS-only lower;
  DEM-corrected marked derived). This is the `session.ts` "Phase 3 import will raise it" hook,
  honored honestly.
- Persist + round-trip through storage; land on the timeline. Tests against the existing
  observation/timeline contract.

## Explicitly DEFER (do not build this session)

- Any map rendering / MapLibre / `<RouteMap>` — needs a tile-provider API key (a human).
- FIT, IGC, and HealthKit-route adapters — later sessions (the HK one implements the
  `readActivities` stub).
- Sport overlays (OpenAIP, avalanche.org, gorge, thermal.kk7), 3D replay, sport algorithms.
- Wind/kite anything — under-researched, needs its own pass.

## Guardrails (from the constitution + conventions)

- **Descriptive only.** Everything here renders what happened. No targets, no prescriptions.
- **Tier/fidelity are load-bearing.** null ≠ 0 (an unknown elevation is absent, not 0).
  Derived values keep their tag; never overwrite a tier-1 sensor fact.
- **No gamification.** No streaks/scores/badges anywhere.
- **Conventions:** TypeScript ESM, **extensionless relative imports** (`from './observation'`,
  never `.js`). `moduleResolution: bundler`. Heuristics documented honestly with their error
  band (like `KCAL_PER_KG`, `HALF_LIFE_DAYS`).
- **`npm install --legacy-peer-deps` only** (healthkit peer-dep conflict) if you add anything.
  Prefer adding nothing — Phase 1 needs no new deps.
- **Tests must stay green.** `npm test` (jest-expo). `npx tsc --noEmit` clean. Add tests for
  every new function; fixtures for the GPX parser (a small real-ish `.gpx`).
- **Commits:** single-concern, descriptive. Co-author + session trailers per the repo's
  existing commit style. Do NOT open a PR unless asked. Do NOT put the model id in commits.

## Definition of done for this session

- Route field reconciled (canonical = `gpsPath`), the two specs annotated.
- `GeoPoint` extended non-breakingly; `tsSec` semantics documented.
- `core/src/track.ts` built, exported, fully unit-tested (outliers, elevation tiering, RDP,
  rebasing, stats, null-confidence honesty).
- GPX adapter built + fixture-tested, producing points `track.ts` consumes.
- A `Track` persists into a session Observation's `gpsPath`, fidelity raised honestly by
  elevation source, round-trips through storage, lands on the timeline — tested.
- `npm test` green, `tsc` clean, pushed.
- **Write `dev-log/gps-mapping-pass-1.md`**: what shipped, decisions made, and a clean
  handoff for the next session (Phase 3: MapLibre render — note the tile-provider API key is
  the blocking prerequisite).

If you hit a genuine fork the constitution doesn't resolve, make the honest call, document it
in the dev-log, and keep moving — don't stall. The goal is a correct, tested spine, not a
perfect one.
