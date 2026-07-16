# Map tab reframe — My Map | Explore, v1

*2026-07-16. Branch: `main` (local, not pushed — 5 commits ahead of
`origin/main` for this pass, 23 ahead overall).*

## What was built

Per `planning/rework/tabs/map-tab.md`'s 2026-07-15 REFRAME AMENDMENT
(authoritative over the rest of that doc): the Map tab is now two live
modes, not the single "Record" screen it was through M1–M4.

- **`mapLibre.ts` adapter extension** — `Map`'s `ref`/`onLongPress` and
  `Camera`'s `ref`, added to the existing thin typed adapter (confirmed
  against the installed v11 `.d.ts`, not guessed). Additive only — no
  existing caller (`RouteMap.tsx`) touched.
- **`MapSurface.tsx`** — now `React.forwardRef`, exposing `getCenter()` via
  a new `MapSurfaceRef`. New `routes`/`traces` props render as one
  `GeoJSONSource`+`Layer` each (a data-driven `match`-on-`element` paint
  expression), not one source per route/trace, so native layer count stays
  constant regardless of data volume. Route start-marker + direction-arrow
  rendering rides `ViewAnnotation` (reusing the proven `SpotPin` pattern)
  rather than native per-feature tap-picking or a `symbol`/`icon-image`
  layer — both would have meaningfully expanded the adapter's native
  surface for marginal gain. New `liveLoc` prop (blue dot) and declarative
  `flyTo` prop (location-search recenter, keyed on a monotonic `requestId`
  after a review finding — see below).
- **`app/(tabs)/map.tsx`** — `mode: 'myMap' | 'explore'` state; My Map is
  the landing. The `SegmentedControl` (house pattern) and everything that
  lets the user leave My Map is structurally absent, not hidden, whenever
  `mapLocked` (`isRecording || recorder.recoverable != null`) is true — a
  `useEffect` forces `mode` back the instant either goes true. Record's
  existing pre-start/live/save states now nest under the My Map branch,
  unchanged. My Map gained a layers toggle row (Spots/Routes on by
  default, My traces off) and long-hold → "pin a spot here." Explore is a
  blank crosshair canvas (no spots/routes/traces layer, no toggle row) —
  a fixed screen-center reticle with "View forecast" and "Pin this
  location," both reading the crosshair's live coordinate via
  `getCenter()` on tap, never a continuously-tracked region.
- **`PointForecastSheet.tsx`** (new) — Explore's "View forecast," reusing
  F1's `fetchForecast({lat,lng})` + `WindForecastCard`/`RainShineForecastCard`
  for a bare coordinate. Fixed Wind + Rain/Shine panel set (no sport tag to
  derive a smarter default from). Nothing is written from the sheet —
  "Pin this location" routes through the same `new-spot.tsx` param
  contract the long-hold door uses (one spot-creation code path, not two).
- **`mapTraces.ts`** (new) — `sessionTracks()`, structurally excluding Body
  via a type guard (never a filter flag a caller could flip) — covers
  `endurance`/`paddling`/`sky` track fields (fixed a gap in `SessionCard.tsx`'s
  inline version, which is missing the `paddling` case — that file itself
  is untouched, flagged below).
- **`mapRoutes.ts`** (new) — `routesForLayer()`, same structural-exclusion
  shape as `mapTraces.ts`; extracted mid-pass after a code-review finding
  that the equivalent route-filtering logic was inline and untested while
  traces had already gotten the pure-function treatment.
- **`mapGeom.ts`** (new) — `bearingDeg`/`directionMarks`, pure geometry for
  route direction arrows.
- **`geocode.ts`** (new) — MapTiler geocoding on the existing key,
  Nominatim (free, no key, User-Agent'd) otherwise. Response parsing split
  into pure functions so tests don't depend on an env-configured
  `MAPTILER_KEY`.
- **`useLiveLocation.ts`** (new) — the blue dot: continuous
  `watchPositionAsync`, distinct from `map.tsx`'s existing one-shot
  pre-start probe. Never itself requests permission (the existing
  readiness chip owns that prompt). **Deliberate design exception**: the
  dot is an actual blue marker, not a monochrome token — the one place
  this app's locked "four elements are the only saturated colors" rule is
  knowingly broken, decided explicitly (asked, not assumed) because "you
  are here" is a near-universal map convention.
- **`new-spot.tsx`** — `lat`/`lng` param prefill, closing a gap the file's
  own header comment already flagged as deferred.

**No migration.** No suggested routes, no global heatmap (refused, not
deferred). Cohort/friends layers: not built at all this pass (the brief's
"gated stubs in comments" scope was covered by simply not rendering
anything for Explore — there was no existing pins/routes/traces surface in
Explore to stub around). Explore-2 (route builder) seam: a typed
`ExploreSubState` discriminated union was considered but the simplest
honest seam turned out to be "no seam needed yet" — Explore's render branch
is a single `mode === 'explore'` check with nothing else inside it; a
future takeover state is just a new branch alongside it. No speculative
scaffolding was added beyond that.

## Verification

- **jest:** 147 suites / **1476 tests** pass (up from the pre-pass 144/1460
  — new: `mapGeom.test.ts`, `mapTraces.test.ts`, `mapRoutes.test.ts`,
  `geocode.test.ts`, `useLiveLocation.test.ts`).
- **tsc --noEmit:** 0 errors, checked after every commit in the sequence,
  not just at the end.
- **`/code-review` (medium effort, 8 finder angles, self-verified against
  the actual MapLibre v11 source rather than rubber-stamped):** 6 findings
  survived verification and were fixed:
  - `mapPins` wasn't memoized (unlike `mapRoutes`/`mapTraces`), silently
    reintroducing the native-bridge-churn bug `MapSurface`'s own memo
    comment warns about, whenever Spots was toggled off or in Explore.
  - Explore was reachable while an orphaned recording sat unresolved —
    `recorder.recoverable` didn't force `mode` back to My Map the way
    `isRecording` did, so the RecoveryBanner (the only Finish/Discard
    affordance) could silently vanish. New `mapLocked` covers both.
  - `useLiveLocation`'s `start()` had a single lock-check before three
    separate `await`s — a fast blur-then-refocus could let a stale
    `watchPositionAsync` assign a live, un-removable subscription after
    the tab had already left. Added an `activeRef` re-checked after each
    await.
  - `MapSurface`'s `flyTo` recenter effect keyed on raw lng/lat/zoom, so
    re-picking the identical search result a second time (e.g. after
    panning away) was silently a no-op. Now keyed on a monotonic
    `requestId`.
  - `mapRoutes`' filtering was inline/untested while `mapTraces`' identical-shaped
    logic had already been extracted and tested — extracted to
    `mapRoutes.ts` for consistency and coverage.
  - The "push `/new-spot` with lat/lng params" logic was duplicated across
    three call sites, already showing early signs of drift — collapsed
    into one `pushNewSpotAt` helper.
  - One finding was independently investigated and **refuted**, not
    fixed: a claim that the camera would get permanently stuck at a
    searched location once `Camera` first mounted with a `flyTo`-derived
    center. Read the actual `Camera.js` implementation
    (`@maplibre/maplibre-react-native`) to confirm `center`/`zoom`/etc. are
    spread into a `stop` prop passed to the native component on every
    render — the same reactive mechanism the imperative `flyTo()` method
    uses internally — so a later `center` recompute (e.g. once a real GPS
    fix arrives) does move the camera. No change made.
- **Sim (iPhone 17 simulator, real dev-build install, existing seeded DB,
  deep-linked via `xcrun simctl openurl healthcoach:///(tabs)/map`,
  driven via `cliclick` mouse-click coordinate mapping since no `idb` was
  available for native touch injection):**
  - My Map: switcher, layer toggle row (Spots/Routes on, My traces off —
    matches the locked default), sport-arm control, GPS-ready chip, Record
    button all render correctly; the blue dot renders at the simulator's
    live location; a spot pin renders on the map (real seeded data).
  - Mode switch to Explore: crosshair reticle renders centered; **confirmed
    blank canvas** — no spot pins, no routes bled through from My Map;
    "View forecast"/"Pin this location" buttons render; layer toggle row
    and sport-arm control correctly absent.
  - "View forecast" → `PointForecastSheet` opens with a **live** Open-Meteo
    round-trip (not mocked) for the exact crosshair coordinate — real Wind
    (2 avg, gusting 2 kt from 112°) and Rain/Shine (0.1 in/24h, an 8-day
    table) cards rendered with correct model/fetch-time attribution, honest
    raw-coordinate header (no fabricated place name).
  - "Pin this location" → New Spot screen opened with `Latitude: 0` /
    `Longitude: -64.93046712714386` — an **exact** match to the crosshair
    coordinate the forecast sheet had just shown, full precision preserved
    through `getCenter()` → `pushNewSpotAt` → `new-spot.tsx`'s param
    parsing. Not saved (form abandoned deliberately — no test data written
    to the dev DB).
  - No runtime errors surfaced in any screenshot.

## ⚑ Flags

- **⚑1 — Nominatim as the free geocoding fallback is my own call** (per
  "decide technical patterns yourself, escalate product calls" — this read
  as a technical choice, not a product one), same tier as F2's Synoptic
  pick: free, no key, but a third-party ToS dependency (rate limit ~1
  req/sec, requires a `User-Agent`, asks for no autocomplete-on-keystroke —
  honored by making search submit-triggered). **Not live-verified this
  session** — no MapTiler key is configured in this dev environment
  either, so neither geocoding branch has actually round-tripped against a
  real network response; both are only unit-tested against hand-built JSON
  fixtures. Verify a real search (either branch) before trusting this in
  front of users.
- **⚑2 — A fresh Home deep-link (`activity`/`element` param change) now
  also forces `mode` back to `'myMap'`**, bundled into the same effect
  that already resets `armOverride`. Not explicitly specced in the brief
  — the only reading consistent with "Record lives inside My Map now" —
  but worth a one-line confirmation since it's filling an unstated gap,
  not following a stated one.
- **⚑3 — `SessionCard.tsx:34`'s inline "get this session's track" fallback
  chain (`p.endurance?.gpsPath ?? p.sky?.track`) is missing the
  `paddling?.gpsPath` case** that `mapTraces.ts`'s `trackOf()` correctly
  handles — a Water/paddling session's track can now show up in My Map's
  traces layer but never on that same session's own `SessionCard` route
  preview. Pre-existing bug, surfaced by code review, **not fixed** —
  `SessionCard.tsx` is outside this diff's single concern. Worth a
  dedicated small fix.
- **⚑4 (carried) — the blue-dot color is a deliberate, asked-and-answered
  exception** to the locked monochrome+4-element palette (`theme.colors`
  has no "blue" — `LIVE_LOCATION_BLUE = '#1A73E8'` is hardcoded in
  `MapSurface.tsx`, not a design-system token). Not a bug, just flagged so
  a future design-system audit doesn't "fix" it back to ink without
  knowing this was a conscious call.
- **⚑5 — direction-arrow and route-tap-target rendering both took the
  lower-native-surface option** (rotated-triangle `ViewAnnotation`s over a
  `symbol` layer; a start-marker `ViewAnnotation` over native per-feature
  picking). Reasonable v1 calls, not verified against any specific visual
  mockup — if the on-device look reads wrong at a glance, these are the
  two places to reconsider first.

## Not done / deferred

- Push/merge — not requested; `main` is 23 commits ahead of `origin/main`
  overall (this pass is the last 5).
- Live verification of both `geocode.ts` branches (⚑1).
- `SessionCard.tsx`'s `paddling` gap (⚑3) — separate small fix.
- Two low-value code-review findings intentionally not applied (in-scope
  but judged not worth the churn): `geoJson.ts`'s `toLineString` could
  delegate to the newer `toMultiLineString` instead of duplicating the
  coordinate-projection logic; the My Map layer-toggle row hand-rolls a
  multi-select chip pattern `ForecastPanelPicker.tsx` already generalizes
  (for an array-shaped option list, not this screen's
  `Record<key,boolean>` shape — adapting it wasn't a clean drop-in).
- Human tap-through still needed for: the long-hold-to-pin gesture itself
  (mouse clicks via `cliclick` can't simulate a genuine press-and-hold);
  the search field's real keyboard-typing round trip; deliberately
  toggling each of the three My Map layers back and forth to confirm
  visual on/off (one incidental toggle was observed responding correctly
  mid-session, not a systematic check); visually confirming a seeded Body
  session never renders as a trace (the exclusion is structurally
  guaranteed and unit-tested in `mapTraces.test.ts`, but not eyeballed
  on-device with real Body data this pass).
- Explore-2 (the route builder) — no UI, no builder-specific seam beyond
  Explore's render branch being a single, easily-extended `mode ===
  'explore'` check. Handoff prompt follows separately.

## Safe to leave as-is?

Yes. Branch is green (jest/tsc clean across every commit in the sequence,
not just the end state), `/code-review` findings applied and one
explicitly refuted with source-level verification rather than guessed,
sim-tested with two genuine live-network round-trips (Open-Meteo forecast,
plus the pre-existing NWS/current-conditions calls Home already made) and
one exact-precision coordinate round-trip confirmed pixel-for-pixel against
displayed data. The five open flags are documented judgment calls or a
pre-existing (not newly introduced) bug in an untouched file, not
regressions from this pass — ⚑1 (neither geocoding branch live-verified)
and ⚑3 (the `SessionCard.tsx` gap) are the two worth prioritizing next.
