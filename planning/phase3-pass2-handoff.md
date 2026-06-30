# Phase 3 Pass 2 — HealthKit Adapter: Steps + Sleep

*Handoff doc for a fresh session. Read this + `wearable-ingestion-spec.md` + `CLAUDE.md`.*

---

## What was done (Pass 1 — complete)

Pass 1 migrated from Expo Go to a custom EAS dev client with HealthKit native capability. Everything below is already committed on `main`:

- **EAS project linked** — `eas.json` created, projectId `8944e0f3-ea5f-444b-a127-068a8f94a194`, owner `dolkon`
- **Bundle ID** changed to `com.dylan.healthcoachproject`
- **HealthKit config plugin** installed — `@kingstinct/react-native-healthkit@^14.0.2` with `react-native-nitro-modules@^0.35.10` (required peer dep)
- **`expo-dev-client@~5.2.4`** added
- **`withFmtFix` config plugin** — Xcode 16+ build fix for React Native's `fmt` library, committed at `2676eee`
- **Dev client built via EAS**, installed on Dylan's iPhone (UDID `00008150-00192C1C14D2401C`), Developer Mode enabled
- **App boots in dev client** and connects to Metro on port 8081

Key commits: `ee2612b` (Pass 1 core), `2676eee` (withFmtFix build fix)

No HealthKit reads, no adapter code, no UI changes. Just the native foundation.

---

## What this pass builds (Pass 2)

**Read daily steps and sleep from Apple Health, emit them as Observations on the timeline.**

From the spec (`wearable-ingestion-spec.md` § Pass breakdown, Pass 2):

1. **Shared `WearableSource` interface** — `requestPermissions()`, `readSteps(range)`, `readSleep(range)`, `readActivities(range)`. This is the abstraction that lets HealthKit and (future) Health Connect share one contract.

2. **HealthKit reader for steps** — query `HKQuantityTypeIdentifierStepCount` via `@kingstinct/react-native-healthkit`. Use `HKStatisticsQuery` with source-grouping to pick one authoritative source per day (prefer wearable over iPhone pedometer — see spec § Source precedence / dedup). Emit one `steps` Observation per civil day.

3. **HealthKit reader for sleep** — query `HKCategoryTypeIdentifierSleepAnalysis`. Emit one `sleep` Observation per sleep window. **Date-attribution rule: attribute to the wake day** (the day the sleep ended). Document this visibly.

4. **Normalizer** — takes raw HealthKit data, emits `Observation[]` with correct tier (1), fidelity (~0.9 steps, ~0.85 sleep), and source `{ type: 'healthkit', rawType: '...' }`.

5. **Backfill** — on first permission grant, read trailing 3 months of history so the timeline isn't empty on day one. The z-score detection threshold needs boring history to calibrate.

6. **Timeline display** — steps and sleep_hours Observations render on Today and in history as tier-1 fact cards. Respect the existing card styling patterns.

7. **Staged sleep (tier-3, optional)** — if deep/REM/light/awake breakdown is available for free, store it alongside the tier-1 duration. Never surface above the hours in any UI or engine output.

---

## Schema is ready

The `Observation` type in `core/src/observation.ts` already has everything needed:

- `ObservationKind` includes `'sleep'` and `'steps'`
- `SleepPayload` — `{ kind: 'sleep', durationMin: number, stages?: { deepMin, remMin, lightMin, awakeMin } }`
- `StepsPayload` — `{ kind: 'steps', count: number }`
- `ObservationSource` includes `{ type: 'healthkit', rawType: string }`
- Tier and fidelity fields are on every Observation

**No schema changes needed.** Just write the adapter that reads HealthKit and emits these existing types.

---

## Key files to know

| File | What it does |
|---|---|
| `core/src/observation.ts` | The Observation type — the contract. Don't change it. |
| `src/storage/observations.ts` | SQLite persistence for Observations |
| `src/hooks/useTodayObservations.ts` | Hook that reads today's observations for display |
| `src/components/SessionCard.tsx` | Existing card component — may need step/sleep variants |
| `app.json` | HealthKit plugin config already in place |
| `plugins/withFmtFix.js` | Xcode build fix — don't touch |
| `planning/wearable-ingestion-spec.md` | The full spec — read the whole thing |

---

## What NOT to do

- **No background sync.** Poll-on-open only. Background delivery (`HKObserverQuery`) is explicitly out of scope. "Fresh data waiting for you" is the notification machine sneaking in through the data layer.
- **No activities yet.** That's Pass 3. This pass is steps + sleep only.
- **No GPS routes.** Not relevant for steps/sleep.
- **No Health Connect / Android.** Stub the interface, don't implement it.
- **No writing back to HealthKit.** Read-only. We ingest, we don't write back.
- **Don't sum across sources.** Pick one authoritative source per metric per day. Double-counting steps reads as a data-integrity bug.

---

## Environment

- **SDK 53** — `expo@^53.0.0`, `react-native@0.79.6`
- **HealthKit library** — `@kingstinct/react-native-healthkit@^14.0.2` (already installed)
- **Dev client** — already built and on Dylan's iPhone, no rebuild needed for JS changes
- **Rebuild trigger** — only if you add/upgrade a native module. Pure JS adapter work = just reload.
- **`--legacy-peer-deps`** required for npm install (healthkit peer dep conflict)
- **AGENTS.md says "read Expo v56 docs"** — IGNORE THIS. The project is on SDK 53. Read v53 docs if needed.

---

## Conflict risk with other work

**None.** The nutrition tab and this pass are completely independent:
- Different data types (food vs steps/sleep)
- Different adapters (USDA/OFF vs HealthKit)
- Different UI surfaces (Nutrition tab vs timeline cards)
- Both emit Observations into the same timeline, but different `kind` discriminators — no overlap

A nutrition session and a Pass 2 session can run on separate branches in parallel without conflicts.

---

## Dylan's notes

- **Garmin → Apple Health sync is unreliable** in Dylan's experience. The direct Garmin API will be required (not optional) for activities. For steps/sleep this is less of an issue — HealthKit usually gets those. But be aware the source-precedence logic matters.
- Dylan is a **complete beginner** — no coding/git/terminal experience. Give clear, copy-paste-ready commands for anything that needs the terminal.
- The dev client is already on his phone. He just needs to open the app and it connects to Metro.

---

## Success criteria

Pass 2 is done when:
1. App requests HealthKit permission for steps + sleep on first launch
2. Steps show on the timeline as daily totals (tier-1 cards)
3. Sleep shows on the timeline as duration in hours (tier-1 cards)
4. 3 months of backfill history populates on first permission grant
5. Source-precedence dedup is in place (no double-counted steps)
6. Tests pass against the existing observation/timeline contract
7. `tsc` clean, `jest` green
