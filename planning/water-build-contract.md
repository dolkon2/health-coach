# Water Dimension — Build Contract (v1.1, judge-amended)

> Locked data shapes + module homes for the Water build. Source of truth for all build agents.
> Research basis: live USGS OGC + Open-Meteo probes (fixtures in `planning/api-probes/`),
> @kingstinct/react-native-healthkit 14.0.2 type-definition spike, codebase-patterns brief.
> Checked against the Notion New Training Database pages (Swimming / White Water Kayaking /
> Wind wing-kite) fresh on 2026-07-05.
> v1.1: amended per 3-judge adversarial panel (23 issues — all blockers + should-fixes folded in).
> Scope directives from Dylan (2026-07-05): tech integrations, not UI polish. Open-water swim OUT.
> Kayak gear = single boat field. Wind gets full gear + kit model, sub-sports incl. PARAWING.
> Constitution: descriptive by default; sessions are facts; private-first; immutable snapshots.

## 0. Architecture decisions (settled)

1. **Whitewater and wind sessions stay on the `gps` surface.** No new `Surface` union values
   (avoids the closed-union ripple through `SURFACE_FIDELITY`, `MODALITY_SURFACE`,
   `sessionTemplate.ts`). Bespoke data rides in NEW optional payload blocks alongside
   `endurance` (the GPS envelope).
2. **Wind sub-sports are activity-registry entries** — `wingfoil`, `windsurf`, `kitesurf`,
   `sail` exist; this pass ADDS `parawing`. The activity id IS the sub-sport discriminator and
   the future split point if these become separate top-level sports (Dylan 2026-07-05). One
   WindBlock serves all of them; no `subSport` field.
3. **Payload blocks need no migration** — sessions are rows in `observations` with a JSON
   `payload` column. All new fields optional, written with omit-when-absent spreads, readers
   tolerate `undefined`. There is no payload schemaVersion; do not add one.
4. **Existing `PaddlingBlock` is untouched.** Unused sketch, never written by any form. ⚑ flagged;
   we do NOT reuse it.
5. **Snapshots are immutable-at-save facts with source provenance.** A failed conditions fetch =
   absent snapshot (never stale, never fabricated, NEVER a now-reading mislabeled as session-time
   conditions). No caching of condition reads. **Both gauge and wind fetches are
   backdate-correct** — they take the session time and fetch conditions *for that time*.
6. **Snapshots + ingested swim lengths must ride on `SessionForm`** (the `importMeta`/
   `captureMeta` pattern) so the edit path — which rebuilds the whole payload from form state —
   round-trips them. `sessionFormFromObservation` must restore every new block field.
7. **Core/lib split follows the nutrition template exactly:** pure response→snapshot parsers +
   derivations in `core/src/conditions/`, fetch wrappers in `src/lib/conditions/` (deps-injected
   `fetchImpl`, AbortController timeout ~4s, typed `null` miss, never throw).
8. **HealthKit workout ingestion is UUID-deduped** (`source.workoutUuid`), NOT civil-day deduped.
9. **No dev-client rebuild needed.** Workout/route/swim reads are runtime JS; permissions added
   at runtime via `requestAuthorization`.
10. **Cross-branch coordination:** Water claims **migration version 10**. Verified 2026-07-05
    that no sibling dimension branch has a 010 yet. Reservation to relay to Dylan/siblings:
    **Water=010, Earth=011, Sky=012, Body=013.** Migration SQL uses `CREATE TABLE IF NOT EXISTS`
    as a defensive belt. GearCategory union carries ONLY Water's arms — other dimensions append
    their own arms on their branches (upstream decision; union merges are trivial conflicts).
    **Water owns the `readActivities` rewrite** — Earth must rebase on it, not reimplement;
    v1 ingestion filter is restricted to WATER activity types (see §7).

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
  trend?: 'rising' | 'falling' | 'steady';  // from 6h series ENDING at session time
  observedAtUtc: string;           // reading time nearest the session
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
  observedAtUtc: string;           // explicit RFC3339 UTC ('...Z'), from unixtime epoch
  fetchedAtUtc: string;
  source: 'open-meteo-forecast' | 'open-meteo-archive' | 'manual';  // never mix models in one snapshot
}
```

`core/src/conditions/usgs.ts` — pure parsers over OGC GeoJSON: `parseLatestReadings(json)`,
`parseSeries(json)`, `parseSiteSearch(json)`. Handle: `properties.value` is a STRING →
parseFloat with NaN guard; `numberReturned: 0`; missing parameters per site; `qualifier` flags.
**`parseSiteSearch` filters to `properties.agency_code === 'USGS'`** (bbox results include
cooperator sites like `OR004-*` that latest-continuous cannot serve).
`core/src/conditions/gaugeTrend.ts` — `computeTrend(points) → 'rising'|'falling'|'steady'`
(±5% over the window; document; ⚑ tunable).
`core/src/conditions/openMeteo.ts` — pure parsers: `parseCurrentWind(json)` (unixtime),
`pickHourlyWind(json, targetEpochSec)` (unixtime+UTC integer math), `parsePrecipDays(json)`.
Null-check every array element. Reject `{error:true, reason}` bodies.
Fixtures: copy trimmed probe responses into `core/src/conditions/__fixtures__/` (strip
`_probe_url` keys). Where a needed shape has no fixture (e.g. unixtime `current=` response,
bounded-interval series), the build agent captures ONE live response and saves it as a fixture.

## 2. Fetch clients (`src/lib/conditions/`)

```ts
// src/lib/conditions/usgsClient.ts
export interface ConditionsDeps { fetchImpl?: typeof fetch; signal?: AbortSignal; }

export async function fetchGaugeSnapshot(
  siteId: string, whenUtcSec: number, deps?): Promise<GaugeSnapshot | null>;
// BACKDATE-CORRECT. If now − when ≤ 2h: latest-continuous path —
//   /collections/latest-continuous/items?monitoring_location_id=USGS-...&limit=100&f=json
//   (limit=100: parameter-rich sites overflow the default limit of 10) → pick 00060/00065.
// Else: historical path — /collections/continuous/items with a bounded RFC3339 interval
//   time={when−3h}/{when+3h}&parameter_code=00060&limit=100 (+ same for 00065), pick the
//   reading nearest `when`. Probe the bounded-interval form live once during build (duration
//   form PT6H is fixture-verified; bounded documented) — if unsupported past some horizon,
//   degrade to null → manual entry. NEVER return a now-reading for a backdated session.
// Trend: 6h series ENDING at `when` — time={when−6h}/{when}&sortby=-time&limit=100
//   &skipGeometry=true&properties=time,value (limit=100 REQUIRED: default limit 10 truncates
//   PT6H to ~2.25h — proven by fixture). Trend failure degrades to snapshot-without-trend.

export async function searchGaugeSitesByName(text: string, deps?): Promise<GaugeSite[]>;
// CQL2: filter=monitoring_location_name LIKE '%TEXT%' (uppercase), limit=100, USGS-only filter.
export async function searchGaugeSitesByBbox(bbox, deps?): Promise<GaugeSite[]>;
// site_type_code=ST, limit=100, USGS-only filter. `next` cursor links ignored at this size.
```
URL details (live-probed, pin `v0`): base `https://api.waterdata.usgs.gov/ogcapi/v0`; site IDs
MUST be `USGS-` prefixed; STRICT param validation (unknown params → 400); no API key.

```ts
// src/lib/conditions/openMeteoClient.ts
export async function fetchWindSnapshot(lat, lng, whenUtcSec, deps?): Promise<WindSnapshot | null>;
// Age cutover: ≤90 days → forecast API start_date/end_date + hourly wind vars; older → archive
// API. Very recent (≤2h) may use current=... . EVERY call: windspeed_unit=kn (assert response
// units === 'kn') AND timeformat=unixtime&timezone=UTC (current.time comes back as epoch too —
// naive local ISO strings are a parsing footgun). observedAtUtc = epoch → explicit '...Z' string.
// Tag source with which API served it.

export async function fetchPrecip72hMm(lat, lng, whenUtcSec, deps?): Promise<number | null>;
// BACKDATE-CORRECT: start_date/end_date = the 3 civil days preceding the session date on the
// forecast API (≤90d; archive API older), daily=precipitation_sum&timezone=auto (server resolves
// tz from coords — Spot carries no tz field). Value = sum of 3 civil-day sums preceding the
// session date; name kept, semantics documented.
```
⚑ minutely_15 wind (confirmed working, HRRR US) deferred to a fast-follow — v1 uses hourly.

## 3. Core types — gear, kit, spot

```ts
// core/src/gear.ts
export type GearCategory = 'kayak' | 'wing' | 'kite' | 'board' | 'foil' | 'parawing';
// Water's arms only. Other dimensions append theirs (shoe, bike, ski...) on their branches.

export interface GearSpec {          // flat all-optional; meaning keyed by category
  sizeM2?: number;                   // wing / kite / parawing
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
  retiredOn?: string;                // set = retired. SOFT delete only — sessions keep the ref.
  notes?: string;
  createdAt: string;
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

`src/storage/migrations/010_gear_kits_spots.ts` (version 10 — see §0.10 reservation; register in
`migrations/index.ts`); `CREATE TABLE IF NOT EXISTS` on all three:

```sql
CREATE TABLE IF NOT EXISTS gear (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  spec TEXT, acquired_on TEXT, retired_on TEXT, notes TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kits (id TEXT PRIMARY KEY, name TEXT NOT NULL, gear_ids TEXT NOT NULL,
  created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spots (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL,
  lat REAL, lng REAL, river_name TEXT, section_name TEXT, gauge_site_id TEXT,
  notes TEXT, created_at TEXT NOT NULL);
```

Stores: `src/storage/gear.ts` (GearItem + Kit CRUD; `listGear({includeRetired?})`, `listKits()`),
`src/storage/spots.ts` (`listSpots({kind?})`). Style of `mealTemplates.ts` (COLUMNS const, row
mappers, injected `SqlDatabase`) **EXCEPT: gear.ts exposes NO hard-delete function** — retiring
(`retired_on`) is the only removal, because sessions reference gear ids. Kits MAY be hard-deleted
(WindBlock denormalizes resolved `gearIds`, so a deleted kit loses nothing). Spots: no hard
delete either (blocks denormalize names but spotId refs should stay resolvable; soft enough v1).
Tests with `makeTestDb()` + `runMigrations`.

## 5. Payload blocks (`core/src/observation.ts` — additive only)

```ts
export interface WhitewaterBlock {
  riverName?: string;
  sectionName?: string;
  spotId?: string;                   // ref; block carries denormalized names (spot may be deleted)
  gauge?: GaugeSnapshot;             // IMMUTABLE once saved (edit round-trips it untouched)
  sectionClass?: string;             // free text. SOFT validation hint /^(VI|IV|V|I{1,3})[+-]?$/ —
                                     // never block: 'IV-V', 'III(IV)' are legitimate notations.
  boatGearId?: string;
  waterTempC?: number;
  hazards?: string;                  // free text; private-first
  swims?: number;
  rolls?: number;
  precip72hMm?: number;              // 3 civil-day rain sum preceding session date (see §2)
}

export interface WindBlock {
  spotId?: string;
  spotName?: string;                 // denormalized snapshot of the name
  wind?: WindSnapshot;               // IMMUTABLE once saved
  kitId?: string;                    // provenance if a kit was picked
  gearIds?: string[];                // resolved gear refs (kit expansion or loose picks)
  note?: string;                     // subjective session note ("lit on the 9m")
}
// No subSport field: activity id (wingfoil | windsurf | kitesurf | parawing | sail) carries it.

// SessionPayload additions:  whitewater?: WhitewaterBlock;  wind?: WindBlock;
// SwimmingBlock addition:    lengths?: SwimLength[];

export interface SwimLength {        // one pool length, from HealthKit per-length samples
  startSec: number;                  // offset from session start (tz-free, compact)
  durationS: number;
  distanceM?: number;
  strokes?: number;
  stroke?: SwimStroke | 'kickboard' | 'unknown';
  // SwimStroke already includes 'mixed'/'medley' — do NOT extend the SwimStroke union itself
  // (it feeds the manual form's chip list); the extra arms live only here.
  tag?: 'drill' | 'kick';            // manual annotation slot (no UI this pass)
}
```

`ObservationSource` healthkit member gains optional `workoutUuid?: string` (additive).

## 6. Swim derivations (`core/src/swim.ts` — pure)

- `clusterSets(lengths, restGapS = 15): SwimSet[]` — consecutive lengths with inter-length gap
  < threshold form a set; model on `splits.ts`/`deriveSessionDuration`.
  `SwimSet = { lengths, startSec, durationS, distanceM, reps, dominantStroke? }` — derived at
  read time, NEVER stored. ⚑ 15s default is a judgment call, tune with real data.
- `swolfPerLength(l): number | null` — `durationS + strokes` (null if strokes absent).
- `pacePer100(lengths, stroke?): number | null` — seconds per 100m, optionally stroke-filtered.

## 7. HealthKit workout ingestion

`src/lib/wearable.ts` — replace `readActivities(range): Promise<never>` with:

```ts
export interface RawWorkout {
  uuid: string;
  hkActivityType: number;            // WorkoutActivityType enum value
  startUtc: string; endUtc: string;
  durationS: number;
  distanceM?: number;                // from Quantity {unit, quantity} — CONVERT units, never
  energyKcal?: number;               //   assume; HK can return yd/mi/km (toMeters helper)
  sourceBundleId: string; sourceName: string;
  route?: GeoPoint[];                // flattened from getWorkoutRoutes(), thinned via thinTrack
  swim?: {
    locationType: 'pool' | 'open';
    lapLengthM?: number;             // metadata.HKLapLength is a Quantity {unit, quantity} —
                                     // US pools are commonly 25 yd: toMeters(q, unit), yd×0.9144.
                                     // Yard-pool case REQUIRED in tests.
    lengths: RawSwimLength[];
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
from lap events (`WorkoutEventType.lap===3`, `metadata.HKSwimmingStrokeStyle`) by interval
overlap. Permissions added to `requestAuthorization.toRead`: `HKWorkoutTypeIdentifier`,
`HKWorkoutRouteTypeIdentifier`, `HKQuantityTypeIdentifierSwimmingStrokeCount`,
`HKQuantityTypeIdentifierDistanceSwimming`. Keep the dynamic-import `getHk()` pattern.

**Ingested v1 activity types — WATER ONLY:** swimming=46, paddleSports=31, sailing=38,
surfingSports=45. The HK-type→activity map is trivially extensible; Earth adds run=37/ride=13/
hike=24 on its branch after rebasing on Water's readActivities (§0.10). ⚑ flagged.
Open-water swims (`HKSwimmingLocationType===2`): SKIPPED in v1 (Dylan: out of scope) — log & drop.

Normalizer (`src/lib/healthkit/normalizeWorkout.ts`, pure): RawWorkout → `ObservationOf<'session'>`:
- HK type → activity id: 46→`swim` (pool), 31→`kayak` ⚑ (can't auto-detect whitewater; user
  edits), 38→`sail`, 45→`surf`.
- **`durationMin: Math.round(durationS / 60)` on EVERY ingested payload** (measured fact).
- **`energySystem` from the mapped activity's `defaultEnergySystem` in the registry, fallback
  `'aerobic'`** (EnduranceBlock/SwimmingBlock require it; without it sessions are un-editable).
- swim → `SwimmingBlock { poolLengthM, laps: lengths.length, distanceM, lengths }` (startSec
  offsets from startUtc); others → `EnduranceBlock { distanceM?, gpsPath?, energySystem }`.
- `source: { type:'healthkit', rawType:'HKWorkout', workoutUuid: uuid }`; `occurredAt = startUtc`.
- **Fidelity 0.95** — the EXISTING device-recorded rung already documented in session.ts
  (a watch recording is the most-measured capture the app has; 0.5 gps-manual default would be
  wrong). No new fidelity semantics. ⚑ session-fidelity-vs-constitution tension flagged for Dylan.

Dedup (`ingest.ts`): dedup query range = [min candidate occurredAt − 48h, max candidate
occurredAt + 48h] (computed from candidates, mirroring steps/sleep; the padding absorbs workouts
straddling the window edge). Skip when any existing session has `source.workoutUuid === uuid`.
**Daily workout poll reads a trailing 7-day window** (UUID dedup makes wide windows free; the
18h steps/sleep lookback would permanently miss late-syncing watch workouts).
Non-iOS stub returns `[]` (not throw). Update EVERY fake reader in existing tests to the new
interface member.

## 8. Form + freeze-at-save wiring

`SessionForm` gains `whitewater: {...}` and `wind: {...}` sub-objects (string-typed drafts + the
fetched snapshot objects riding whole), and **`form.swim` gains `lengths?: SwimLength[]` carried
whole** (importMeta pattern — never hand-edited; when lengths are present `buildSwimming` keeps
the measured `distanceM` instead of recomputing laps × poolLengthM, and stroke is optional).
`buildSessionObservation` writes the blocks (omit-when-absent); `sessionFormFromObservation`
restores ALL of them — round-trip tests extend `session.test.ts`.

Form sections: `src/components/surface/WhitewaterSection.tsx` + `WindSection.tsx`
(GymExerciseEditor precedent) rendered inside the `surface==='gps'` branch keyed off activity id:
whitewater/kayak → WhitewaterSection; wingfoil/windsurf/kitesurf/parawing/sail → WindSection.
**Both receive a `sessionTimeUtc` prop = `original?.occurredAt ?? new Date().toISOString()`**
from log-session.tsx (edit mode already holds `original`) — this is what makes fetches
backdate-correct. **Fetch is allowed only when the block has no snapshot yet**; an existing
snapshot is immutable — fetch button hidden, snapshot displayed read-only. No refetch on edit.

BAREBONES functional UI only (existing styling patterns, no polish — Dylan's redesign
supersedes): spot pick (simple list + create), gauge fetch + display + **manual gauge entry
fallback** (value + unit + parameter — covers ungauged creeks day one), class/boat/temp/hazards/
swims/rolls fields; wind: spot pick, fetch-conditions button, snapshot display, **manual wind
entry fallback** (speedKts + optional gust/direction — no-signal launches; keeps the 'manual'
source arm honest), kit/gear pick, note. New activity registry entry: `parawing` (surface gps,
same shape as wingfoil).

## 9. Similar-conditions query (`core/src/conditions/similar.ts` — pure, descriptive)

`findSimilarWindSessions(sessions, target: {speedKts, directionDeg?}, opts?) → ranked
[{session, score}]` — wind-speed delta (primary) + circular direction delta (secondary); returns
past sessions with their gearIds/kitId so the UI can answer "what did I ride last time in these
conditions?" DESCRIPTIVE ONLY. Tests. No UI this pass (redesign owns placement). ⚑

## 10. Commit plan (single-concern, orchestrator commits)

1. `docs(planning)`: contract v1.1 (this doc)
2. `feat(core)`: conditions snapshot types + pure parsers + trend + fixtures + tests
3. `feat(lib)`: USGS OGC client + tests
4. `feat(lib)`: Open-Meteo client + tests
5. `feat(core+storage)`: gear/kit/spot types + M010 + stores + tests
6. `feat(core)`: swim derivations + tests
7. `feat(core)`: payload blocks + session builders + round-trip + registry (parawing) + tests
8. `feat(wearable)`: readActivities + normalizeWorkout + ingest + dedup + tests
9. `feat(app)`: form sections + freeze-at-save wiring + tests
10. `feat(core)`: similar-conditions query + tests
11. `docs(dev-log)`: water-build log + ⚑ flags

## 11. ⚑ Flags for Dylan (accumulating; final list in dev-log)

- ⚑ Migration-number reservation: Water=010, Earth=011, Sky=012, Body=013 — relay to sibling
  sessions. Water owns the readActivities rewrite; Earth rebases for run/ride/hike ingestion.
- ⚑ PaddlingBlock is an unused sketch we're NOT reusing — candidate for removal later.
- ⚑ HK paddleSports → 'kayak' default (can't auto-detect whitewater); user edits activity.
- ⚑ Ingested activity-type set restricted to water (46/31/38/45); run/ride/hike left to Earth.
- ⚑ Ingested workouts get fidelity 0.95 (existing device-recorded rung) — the session-fidelity
  mechanism itself predates the "fidelity is food-only" ruling; resolve globally someday.
- ⚑ minutely_15 wind resolution deferred (hourly v1); confirmed available for fast-follow.
- ⚑ AW GraphQL deferred entirely (dead JSON routes; gauge correlations empty).
- ⚑ FIT parser not built — v1 assumes Garmin per-length swim data arrives via HealthKit;
  verify with a real Garmin export.
- ⚑ Whitewater progression milestones (first III/IV/V, days-on-water) deferred — the
  descriptive-vs-gamification framing needs your call.
- ⚑ Similar-conditions core fn built with no UI — placement belongs to the redesign.
- ⚑ Manual swim set-logger ("10×100 free on 1:40") + lap editing + drill/kick tag UI deferred
  (UI-heavy); data slots exist (`SwimLength.tag`).
- ⚑ Trend threshold ±5%/6h and swim rest-gap 15s — judgment calls, tune with real use.
- ⚑ Gauge historical path: bounded-interval `time=` form gets one live probe during build; if
  the continuous collection can't serve backdated windows at some horizon, backdated sessions
  degrade to manual gauge entry (never a mislabeled now-reading).
