# Water Dimension — Build Contract (v1)

> Locked data shapes + module homes for the Water build. Source of truth for all build agents.
> Research basis: live USGS OGC + Open-Meteo probes (fixtures in `planning/api-probes/`),
> @kingstinct/react-native-healthkit 14.0.2 type-definition spike, codebase-patterns brief.
> Scope directives from Dylan (2026-07-05): tech integrations, not UI polish. Open-water swim OUT.
> Kayak gear = single boat field. Wind gets full gear + kit model. Constitution: descriptive by
> default; sessions are facts (NO new fidelity semantics); private-first; immutable snapshots.

## 0. Architecture decisions (settled)

1. **Whitewater and wind sessions stay on the `gps` surface.** No new `Surface` union values
   (avoids the closed-union ripple through `SURFACE_FIDELITY`, `MODALITY_SURFACE`,
   `sessionTemplate.ts`). Bespoke data rides in NEW optional payload blocks alongside
   `endurance` (the GPS envelope).
2. **Payload blocks need no migration** — sessions are rows in `observations` with a JSON
   `payload` column. All new fields optional, written with omit-when-absent spreads, readers
   tolerate `undefined`. There is no payload schemaVersion; do not add one.
3. **Existing `PaddlingBlock` is untouched.** It's an unused sketch (never written by any form).
   ⚑ flagged for Dylan: candidate for future removal; we do NOT reuse it (its discipline enum
   conflates whitewater with flatwater/sup and it lacks conditions).
4. **Snapshots are immutable-at-save facts with source provenance, no fidelity fields.**
   A failed conditions fetch = absent snapshot (never stale, never fabricated). No caching of
   condition reads (foodSearch's cache-first pattern is deliberately NOT copied).
5. **Snapshots must ride on `SessionForm`** (the `importMeta`/`captureMeta` pattern) so the
   edit path — which rebuilds the whole payload from form state — round-trips them.
   `sessionFormFromObservation` must restore every new block field.
6. **Core/lib split follows the nutrition template exactly:** pure response→snapshot parsers +
   derivations in `core/src/conditions/`, fetch wrappers in `src/lib/conditions/` (deps-injected
   `fetchImpl`, AbortController timeout ~4s, typed `null` miss, never throw).
7. **HealthKit workout ingestion is UUID-deduped** (`source.workoutUuid`), NOT civil-day deduped.
   `isAlreadyImported` is wrong for sessions and must not be reused.
8. **No dev-client rebuild needed.** Workout/route/swim-quantity reads are runtime JS against the
   already-installed native module. Permissions are added to `requestAuthorization` at runtime.

## 1. Core types — conditions (`core/src/conditions/snapshot.ts`)

```ts
/** One instantaneous gauge reading. Values are parsed numbers (API returns strings). */
export interface GaugeReading {
  parameter: 'discharge' | 'gaugeHeight';   // 00060 | 00065
  value: number;
  unit: string;                              // 'ft^3/s' | 'ft' as returned
  timeUtc: string;                           // RFC3339 UTC from the API
}

/** Immutable river-condition snapshot frozen onto a whitewater session at save. */
export interface GaugeSnapshot {
  siteId?: string;                 // 'USGS-14123500' (agency-prefixed). Absent for manual entry.
  siteName?: string;
  readings: GaugeReading[];        // discharge and/or gauge height; ≥1 entry
  trend?: 'rising' | 'falling' | 'steady';  // from 6h series at freeze time (discharge preferred)
  observedAtUtc: string;           // newest reading time
  fetchedAtUtc: string;            // when we froze it
  source: 'usgs' | 'manual';
  approvalStatus?: string;         // 'Provisional' | 'Approved' — surfaced per USGS policy
}

/** Immutable wind snapshot frozen onto a wind-sport session at save. */
export interface WindSnapshot {
  lat: number;                     // REQUESTED coords (spot), never the grid-snapped echo
  lng: number;
  speedKts: number;
  gustKts?: number;
  directionDeg?: number;           // meteorological (wind FROM)
  observedAtUtc: string;           // the hour slice matched to session time
  fetchedAtUtc: string;
  source: 'open-meteo-forecast' | 'open-meteo-archive' | 'manual';  // never mix models in one snapshot
}
```

`core/src/conditions/usgs.ts` — pure parsers over OGC GeoJSON: `parseLatestReadings(json)`,
`parseSeries(json)`, `parseSiteSearch(json)` (site id/name/lat/lng). Handle: `properties.value`
is a STRING → parseFloat with NaN guard; `numberReturned: 0`; missing parameters per site;
`qualifier` flags. `core/src/conditions/gaugeTrend.ts` — `computeTrend(points: {timeUtc, value}[])
→ 'rising'|'falling'|'steady'` (relative threshold, e.g. ±5% over the window, document choice).
`core/src/conditions/openMeteo.ts` — pure parsers: `parseCurrentWind(json)`,
`pickHourlyWind(json, targetEpochSec)` (unixtime+UTC integer math per probe),
`parsePrecip72h(json)`. Null-check every array element. Reject `{error:true, reason}` bodies.
Fixtures: copy trimmed probe responses into `core/src/conditions/__fixtures__/` (strip `_probe_url`).

## 2. Fetch clients (`src/lib/conditions/`)

```ts
// src/lib/conditions/usgsClient.ts
export interface ConditionsDeps { fetchImpl?: typeof fetch; signal?: AbortSignal; }
export async function fetchGaugeSnapshot(siteId: string, deps?): Promise<GaugeSnapshot | null>;
// One latest-continuous call (unfiltered → pick 00060/00065) + one 6h continuous call for trend.
// Trend fetch failure degrades to snapshot-without-trend, not null.
export async function searchGaugeSitesByName(text: string, deps?): Promise<GaugeSite[]>;  // CQL2 LIKE, uppercase
export async function searchGaugeSitesByBbox(bbox, deps?): Promise<GaugeSite[]>;          // site_type_code=ST
```
URL details (from live probe, pin `v0`): base `https://api.waterdata.usgs.gov/ogcapi/v0`;
site IDs MUST be `USGS-` prefixed; `time=PT6H&sortby=-time&skipGeometry=true&properties=time,value`
for trend series; STRICT param validation (unknown params → 400); no API key.

```ts
// src/lib/conditions/openMeteoClient.ts
export async function fetchWindSnapshot(lat, lng, whenUtcSec, deps?): Promise<WindSnapshot | null>;
// Age cutover: ≤90 days → forecast API start_date/end_date + hourly + timeformat=unixtime&timezone=UTC;
// older → archive API. Recent-now path may use current=... (15-min slice). ALWAYS windspeed_unit=kn
// on every call; assert response units === 'kn'. Tag source with which API served it.
export async function fetchPrecip72hMm(lat, lng, tz: string, deps?): Promise<number | null>;
// daily=precipitation_sum&past_days=3&forecast_days=1&timezone={spot local tz} — sum the 3 past days.
```
⚑ minutely_15 wind (confirmed working, HRRR US) deferred to a fast-follow — v1 uses hourly.

## 3. Core types — gear, kit, spot

```ts
// core/src/gear.ts
export type GearCategory = 'kayak' | 'wing' | 'kite' | 'board' | 'foil';
// Extensible union: other dimensions append their arms (shoe, bike, ski...) on their branches.

export interface GearSpec {          // flat all-optional; meaning keyed by category
  sizeM2?: number;                   // wing / kite
  volumeL?: number;                  // board
  boardLengthCm?: number;            // board
  areaCm2?: number;                  // foil (front wing)
  mastLengthCm?: number;             // foil
}

export interface GearItem {
  id: string;
  name: string;                      // "9m Duotone Unit", "Jackson Antix 2.0"
  category: GearCategory;
  spec?: GearSpec;
  acquiredOn?: string;               // ISO date
  retiredOn?: string;                // set = retired (soft delete; sessions keep the ref)
  notes?: string;
  createdAt: string;                 // ISO
}

export interface Kit {               // named combo — wind's "build a kit" feature
  id: string;
  name: string;                      // "Light-wind setup"
  gearIds: string[];
  createdAt: string;
}

// core/src/spot.ts
export interface Spot {
  id: string;
  name: string;                      // "White Salmon — Green Truss", "Hood River sandbar"
  kind: 'river-section' | 'launch';
  lat?: number;                      // required in practice for 'launch' (wind fetch needs it)
  lng?: number;
  riverName?: string;                // river-section spots
  sectionName?: string;
  gaugeSiteId?: string;              // home gauge, picked once per river ("USGS-14123500")
  notes?: string;
  createdAt: string;
}
```

## 4. Persistence — migration 010 + stores

`src/storage/migrations/010_gear_kits_spots.ts` (version 10, register in `migrations/index.ts`):
three tables, modeled on `meal_templates` (TEXT id PK, JSON columns for nested shapes):

```sql
CREATE TABLE gear (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  spec TEXT, acquired_on TEXT, retired_on TEXT, notes TEXT, created_at TEXT NOT NULL);
CREATE TABLE kits (id TEXT PRIMARY KEY, name TEXT NOT NULL, gear_ids TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE TABLE spots (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
  lat REAL, lng REAL, river_name TEXT, section_name TEXT, gauge_site_id TEXT,
  notes TEXT, created_at TEXT NOT NULL);
```

Stores: `src/storage/gear.ts` (GearItem + Kit CRUD; `listGear({includeRetired?})`,
`listKits()`), `src/storage/spots.ts` (`listSpots({kind?})`). Line-for-line style of
`mealTemplates.ts`: COLUMNS const, row mappers, optional injected `SqlDatabase`.
Tests with `makeTestDb()` + `runMigrations`.

## 5. Payload blocks (`core/src/observation.ts` — additive only)

```ts
export interface WhitewaterBlock {
  riverName?: string;
  sectionName?: string;
  spotId?: string;                   // ref; block also carries denormalized names (spot may be deleted)
  gauge?: GaugeSnapshot;             // IMMUTABLE once saved (edit round-trips it untouched)
  sectionClass?: string;             // 'I'..'V+' incl. modifiers 'III+', 'IV-'; validate /^(I{1,3}|IV|V)[+-]?$/
  boatGearId?: string;
  waterTempC?: number;
  hazards?: string;                  // free text; private-first
  swims?: number;                    // swim count
  rolls?: number;
  precip72hMm?: number;              // rain context frozen alongside the gauge
}

export interface WindBlock {
  spotId?: string;
  spotName?: string;                 // denormalized snapshot of the name
  wind?: WindSnapshot;               // IMMUTABLE once saved
  kitId?: string;                    // provenance if a kit was picked
  gearIds?: string[];                // resolved gear refs (kit expansion or loose picks)
  note?: string;                     // subjective session note ("lit on the 9m")
}
// No subSport field: the activity id (wingfoil | windsurf | kitesurf | sail) already carries it.

// SessionPayload additions:
//   whitewater?: WhitewaterBlock;
//   wind?: WindBlock;
// SwimmingBlock addition:
//   lengths?: SwimLength[];

export interface SwimLength {        // one pool length, from HealthKit per-length samples
  startSec: number;                  // offset from session start (tz-free, compact)
  durationS: number;
  distanceM?: number;
  strokes?: number;
  stroke?: SwimStroke | 'mixed' | 'kickboard' | 'unknown';  // reuse/extend existing SwimStroke
  tag?: 'drill' | 'kick';            // manual annotation slot (no UI this pass)
}
```

`ObservationSource` healthkit member gains optional `workoutUuid?: string` (additive).

## 6. Swim derivations (`core/src/swim.ts` — pure)

- `clusterSets(lengths: SwimLength[], restGapS = 15): SwimSet[]` — consecutive lengths with
  inter-length gap < threshold form a set; model on `splits.ts`/`deriveSessionDuration`.
  `SwimSet = { lengths: SwimLength[], startSec, durationS, distanceM, reps, dominantStroke? }`
  (derived at read time, NEVER stored).
- `swolfPerLength(l: SwimLength): number | null` — `durationS + strokes` (null if strokes absent).
- `pacePer100(lengths, stroke?): number | null` — seconds per 100m, optionally stroke-filtered.
Sets are derived, not persisted — facts in, derivations out.

## 7. HealthKit workout ingestion

`src/lib/wearable.ts` — replace `readActivities(range): Promise<never>` with:

```ts
export interface RawWorkout {
  uuid: string;
  hkActivityType: number;            // WorkoutActivityType enum value
  startUtc: string; endUtc: string;
  durationS: number;
  distanceM?: number;
  energyKcal?: number;
  sourceBundleId: string; sourceName: string;
  route?: GeoPoint[];                // flattened from getWorkoutRoutes(), thinned via thinTrack
  swim?: {
    locationType: 'pool' | 'open';
    lapLengthM?: number;             // metadata.HKLapLength
    lengths: RawSwimLength[];        // from workout-scoped SwimmingStrokeCount + DistanceSwimming
  };
}
export interface RawSwimLength { startUtc: string; endUtc: string; distanceM?: number;
  strokes?: number; hkStrokeStyle?: number; }
readActivities(range: DateRange): Promise<RawWorkout[]>;
```

Reader (`src/lib/healthkit/reader.ts`): `queryWorkoutSamples({filter:{date:range}, limit:-1,
ascending:true})`; per proxy: `toJSON()` immediately, `getWorkoutRoutes()` eagerly (proxies are
live native objects — never persist); pool swims (`workoutActivityType===46 &&
metadata.HKSwimmingLocationType===1`): per-length via
`queryQuantitySamples('HKQuantityTypeIdentifierSwimmingStrokeCount', {filter:{workout:proxy},
limit:-1, ascending:true})` + `'HKQuantityTypeIdentifierDistanceSwimming'`, stroke style joined
from lap events (`WorkoutEventType.lap===3`, `metadata.HKSwimmingStrokeStyle`) by interval overlap.
Permissions added to `requestAuthorization.toRead`: `HKWorkoutTypeIdentifier`,
`HKWorkoutRouteTypeIdentifier`, `HKQuantityTypeIdentifierSwimmingStrokeCount`,
`HKQuantityTypeIdentifierDistanceSwimming`. Keep the dynamic-import `getHk()` pattern.
Ingested v1 activity types (client-side filter): swimming=46, paddleSports=31, sailing=38,
surfingSports=45, running=37, cycling=13, hiking=24. ⚑ set flagged for Dylan.
Open-water swims (`HKSwimmingLocationType===2`): SKIPPED in v1 (Dylan: out of scope) — log and drop.

Normalizer (`src/lib/healthkit/normalizeWorkout.ts`, pure): RawWorkout → `ObservationOf<'session'>`:
- HK type → activity id: 46→`swim` (pool), 31→`kayak` ⚑ (can't distinguish whitewater; user edits),
  38→`sail`, 45→`surf`, 37→`run`, 13→`ride`, 24→`hike`.
- swim → `SwimmingBlock { poolLengthM, laps: lengths.count, distanceM, lengths: SwimLength[] }`
  (startSec offsets from startUtc); others → `EnduranceBlock { distanceM?, gpsPath? }`.
- `source: { type:'healthkit', rawType:'HKWorkout', workoutUuid: uuid }`; `occurredAt = startUtc`.
- Fidelity: existing surface defaults only — NO new fidelity logic.
Dedup (`ingest.ts`): list existing sessions in range ±48h padding; skip if any
`source.workoutUuid === uuid`. Non-iOS stub returns `[]` (not throw). Update every fake reader
in existing tests to satisfy the new interface member.

## 8. Form + freeze-at-save wiring

`SessionForm` gains `whitewater: {...}` and `wind: {...}` sub-objects (string-typed drafts +
the fetched snapshot objects riding whole). `buildSessionObservation` writes the blocks
(omit-when-absent); `sessionFormFromObservation` restores them (round-trip tests extend
`session.test.ts`). Form sections: `src/components/surface/WhitewaterSection.tsx` +
`WindSection.tsx` (GymExerciseEditor precedent) rendered inside the `surface==='gps'` branch,
keyed off activity id: whitewater/kayak → WhitewaterSection; wingfoil/windsurf/kitesurf/sail →
WindSection. BAREBONES functional UI only (existing styling patterns, no polish — Dylan's
redesign supersedes): spot pick (simple list + create), gauge fetch + display + manual-entry
fallback (value + unit + parameter), class/boat/temp/hazards/swims/rolls fields; wind: spot pick,
fetch-conditions button (uses occurredAt → backdate-correct), snapshot display, kit/gear pick,
note. Snapshot fetch happens when the user picks a spot or taps fetch — visible before save
(honest freeze); what's on the form at save IS the frozen value. Editing a session keeps the
snapshot untouched (no refetch on edit).

## 9. Similar-conditions query (`core/src/conditions/similar.ts` — pure, descriptive)

`findSimilarWindSessions(sessions, target: {speedKts, directionDeg?}, opts?) →
ranked [{session, score}]` — wind-speed delta (primary) + direction delta (secondary,
circular), returns past sessions with their gearIds/kitId so the UI can answer
"what did I ride last time in these conditions?" DESCRIPTIVE ONLY — returns what happened,
never recommends. Tests. No UI this pass (Dylan's redesign owns placement). ⚑

## 10. Commit plan (single-concern, orchestrator commits)

1. `docs(planning)`: this contract + api-probe fixtures
2. `feat(core)`: conditions snapshot types + pure parsers + trend + fixtures + tests
3. `feat(lib)`: USGS OGC client + tests
4. `feat(lib)`: Open-Meteo client + tests
5. `feat(core+storage)`: gear/kit/spot types + M010 + stores + tests
6. `feat(core)`: swim derivations + tests
7. `feat(core)`: payload blocks (whitewater/wind/lengths/source.workoutUuid) + session builders + round-trip + tests
8. `feat(wearable)`: readActivities + normalizeWorkout + ingest + dedup + tests
9. `feat(app)`: form sections + freeze-at-save wiring + tests
10. `feat(core)`: similar-conditions query + tests
11. `docs(dev-log)`: water-build log + ⚑ flags

## 11. ⚑ Flags for Dylan (accumulating; final list in dev-log)

- ⚑ PaddlingBlock is an unused sketch we're NOT reusing — candidate for removal later.
- ⚑ HK paddleSports → 'kayak' default (can't auto-detect whitewater); user edits activity.
- ⚑ Ingested activity-type set (7 types incl. run/ride/hike — they came free with the bus).
- ⚑ minutely_15 wind resolution deferred (hourly v1); confirmed available for fast-follow.
- ⚑ AW GraphQL deferred entirely (dead JSON routes; gauge correlations empty) — planning note kept.
- ⚑ Similar-conditions core fn built with no UI — placement belongs to the redesign.
- ⚑ Manual swim set-logger ("10×100 free on 1:40") + lap editing + drill/kick tag UI: all
  deferred (UI-heavy); data slots exist (`SwimLength.tag`).
- ⚑ Trend threshold ±5%/6h — judgment call, tune with real use.
