# Mapping & GPS architecture — the build spec

*Written 2026-07-04. The build contract that turns the two research docs
(`mapping-systems-research.md`, `sport-mapping-research.md`) into a stack. Read those
first for the "why"; this is the "what and in what order."*

## The one idea

GPS is not five sports' worth of mapping features. It is **one shared spine plus thin
per-sport plugins** — the exact shape `training-logging-spec.md` already uses for training
(identity → logging surface → engine), and the exact discipline `core/` already uses for
health facts (one `Observation`, variety in the discriminator, never parallel schemas).

The differentiating value is **not** the map. Both research passes converged on this: the
map renderer is a solved commodity (MapLibre RN, MIT, free). The value is (a) sport-specific
**data overlays** on a generic map, and (b) **algorithms over the raw GPS track**
(run/lift detection, thermal detection, jump detection) — which are not map features at all,
they're derived-fact passes structurally identical to `stimulus.ts`'s `reveal()`.

So we build the innermost ring first — the type that makes everything downstream trivial —
and we do it in pure `core/` with tests, before any of it touches Expo.

## The six layers

```
   things happen (a hike, a flight, a paddle, a ski run)
        │
   ┌────▼─────────────────────────────────────────────┐
 1 │ INGESTION ADAPTERS  (per file format, not sport)  │  FIT · GPX · IGC · HealthKit
   │   each emits the SAME raw shape: GeoPoint[]        │  → GeoPoint[] (observation.ts)
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 2 │ TRACK NORMALIZATION  (core/src/track.ts)          │  pure TS, tested, no map
   │   GeoPoint[] → canonical Track:                   │  outlier reject · ele tiering
   │   cleaned · ele-tagged · simplified · rebased     │  · RDP simplify · rebase t
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 3 │ GPS-ENVELOPE OBSERVATION  (existing schema)       │  Track slots into the EXISTING
   │   Track → EnduranceBlock.gpsPath / gps_data.route │  gpsPath field — no new schema
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 4 │ RENDER  (one MapLibre <RouteMap track={…}/>)      │  built ONCE, renders any Track
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 4½│ 3D REPLAY  (webview: GL JS terrain + deck.gl)     │  shared, same Track, deferred
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 5 │ SPORT OVERLAYS  (style sources, toggled by        │  ski→avalanche.org GeoJSON
   │   activity identity — one `switch`, not 5 maps)   │  flight→OpenAIP · water→gorge
   └────┬─────────────────────────────────────────────┘
        │
   ┌────▼─────────────────────────────────────────────┐
 6 │ SPORT ALGORITHMS  (derived-fact passes over the   │  run/lift · thermal · jump
   │   SAME Track — the real per-sport engineering)    │  → tier-2 Observations
   └───────────────────────────────────────────────────┘
```

### Layer 1 — Ingestion adapters (per format)

One adapter per **file format**, not per sport. A FIT file might be a run or an MTB ride;
the adapter neither knows nor cares. Each adapter's sole job: emit the raw
`GeoPoint[]` (`observation.ts` already defines `GeoPoint = { lat, lng, tsSec, eleM? }`)
plus a per-point elevation-source tag and optional channels (hr, speed, power, cadence).

| Adapter | Sport driver | Where it lives | Dependency | Status |
|---|---|---|---|---|
| GPX | hiking, running, MTB, any GPX export | `core/` (pure text) | none | **Phase 1 (now)** |
| HealthKit route | running, hiking, swim, ski, paddle | `src/` (native — `HKWorkoutRoute`) | already installed¹ | Phase 4 |
| FIT | Garmin devices (run/ride/ski/paddle) | `core/` wrapper | `fit-file-parser` (npm) | Phase 5 |
| IGC | paragliding | `core/` (pure text, B-records) | none | Phase 5 (flight) |

The contract is what matters: every adapter converges on `RawTrackPoint[]`, so Layer 2 is
written once and never learns about formats.

¹ **The HealthKit route adapter is not greenfield — it has a waiting home.**
`src/lib/healthkit/reader.ts` already exposes a `WearableSource` interface whose
`readActivities()` is an explicit `notImplemented(..., 'Phase 3 Pass 3')` stub, and
`wearable-ingestion-spec.md` § Pass 3 already specs "read `HKWorkoutRoute`, populate the
route coordinate array." The Phase-4 route adapter *is* that stubbed Pass 3 — implement the
stub against the shared interface, don't invent a parallel path. Steps + sleep ingestion
(`normalize.ts`, `ingest.ts`) is the pattern to mirror (pure normalize · source-precedence ·
dedup).

### Layer 2 — Track normalization (`core/src/track.ts`) — the de-risking layer

This is the sibling of `trend.ts`: as `trend.ts` turns noisy tier-1 weigh-ins into a
smooth tier-2 trend, `track.ts` turns noisy tier-1 GPS points into a clean tier-2 `Track`.
Get this type right and every downstream layer is plumbing. It does:

- **Outlier rejection.** Drop points with impossible implied speed (teleport spikes),
  duplicate timestamps, null coords. HealthKit is only ~50 m accurate and Apple explicitly
  says smooth before display; Strava snaps too. This is not optional polish.
- **Elevation source tiering.** Each point's altitude carries an `eleSource`:
  `barometric` (high fidelity, ≈ tier 1 — a real sensor reading), `gps` (low fidelity,
  noisy), `dem` (derived — looked up/corrected against a DEM, marked as such), `none`.
  This is our tier/fidelity model applied to geometry, and it mirrors exactly how Strava
  builds its elevation basemap (barometric kept, GPS-only corrected). **A DEM correction
  never silently overwrites a barometric reading** — same invariant as the rest of the app.
- **Simplification (RDP).** Ramer–Douglas–Peucker to a tolerance. Store full-resolution,
  render simplified — a thumbnail needs far fewer points than a detail view.
- **Timestamp rebasing.** Seconds-since-activity-start, not Unix epoch — required because
  deck.gl's `TripsLayer` stores timestamps as float32 and epoch values lose ~20+ s of
  precision. Doing it in the spine means the replay layer gets it for free.
- **Summary stats.** Distance (haversine), moving vs elapsed duration, elevation gain/loss
  (computed from the *tiered* elevation, with confidence reflecting the source), bounds
  (bbox for map camera + offline-pack definition).

Output is a `Track`: the processed points, the per-source elevation confidence, the stats,
and the bbox. Pure, deterministic, fixture-tested. No Expo, no map, no network.

**`GeoPoint` needs a non-breaking extension.** Today `observation.ts` has
`GeoPoint = { lat, lng, tsSec, eleM? }` — enough for a coordinate, too thin for the
elevation-fidelity model. Add *optional* fields so nothing existing breaks: `eleSource?`
(`'barometric' | 'gps' | 'dem' | 'none'`) and optional per-point channels (`hrBpm?`,
`speedMps?`). Also pin the ambiguous `tsSec` semantics: it is **seconds since activity
start** (rebased), not Unix epoch — the deck.gl float32 constraint makes this the honest
default, and the processed `Track` guarantees it. Extend the type; do not replace it.

### Layer 3 — GPS-envelope Observation (no new schema)

A `Track` populates the **existing** `EnduranceBlock.gpsPath` / `PaddlingBlock.gpsPath`
(`GeoPoint[]`) that `observation.ts` already defines. The Observation's own `tier`/`fidelity`
reflect the track's elevation-source confidence. This is deliberately *not* a new record type
— GPS is just another thing that becomes an Observation.

**Reconcile the route field first — it is defined three incompatible ways today:**

| Where | Name | Shape |
|---|---|---|
| `observation.ts` (code, canonical) | `gpsPath` | `GeoPoint[]` |
| `training-logging-spec.md` | `gps_data.route` | GeoJSON |
| `wearable-ingestion-spec.md` | `route` | `coordinate[]` |

**Decision: `gpsPath: GeoPoint[]` on the block is canonical** (it's the one in running code,
and `GeoPoint[]` carries per-point time/elevation/channels that a bare GeoJSON LineString
drops). GeoJSON is a *render-time projection* of a Track, not the stored form — derive it
where MapLibre needs it, don't store it. The two specs' `route`/`gps_data.route` wording
should be aligned to `gpsPath` (a one-line note in each is enough; no schema migration —
these are prose docs). Settle this in Phase 1 before anything writes a track.

### Layer 4 — Render (one component)

One `<RouteMap track={…}/>` on `@maplibre/maplibre-react-native`. Renders any `Track`
regardless of sport. **The Expo dev build is already paid for** — the app runs a custom dev
client today (`@kingstinct/react-native-healthkit` is installed for wearable ingestion; there
is no Expo Go build to migrate off). Adding MapLibre is a config-plugin + rebuild, *not* the
one-time migration the earlier draft of this doc implied. The remaining external dependency
is a **tile/basemap provider API key** (MapTiler or Stadia free tier) — that needs a human
(account signup), so it's the natural Phase-3 handoff point for an autonomous build. MapLibre
RN ships a built-in `OfflineManager` (`createPack({mapStyle, bounds, minZoom, maxZoom})`) —
the offline-region download every peak app treats as non-negotiable — and the `bounds` come
straight from the Track's bbox (Layer 2).

### Layer 4½ — 3D replay (deferred)

The "spectacular" polish: a webview hosting MapLibre GL JS `raster-dem` terrain (open
Mapterhorn DEM) + deck.gl `TripsLayer` fed by the same rebased Track. Shared across sports,
not per-sport. Deferred — it's the flyover, not the spine.

### Layer 5 — Sport overlays (data, toggled by identity)

Sport-specificity in the map is **additional style sources swapped by the session's activity
identity** — one `switch` on activity kind, not five map implementations. Ranked by
reuse-availability (from `sport-mapping-research.md`):

| Sport | Overlay | License reality |
|---|---|---|
| Skiing | avalanche.org GeoJSON (pre-styled danger zones) + DEM slope-angle | turnkey; DEM self-produced |
| Free flight | OpenAIP airspace | open API, attribution |
| Whitewater | gorge gauge points (USGS + ~24 sources) | MIT code, per-source data diligence |
| Ski/hike/MTB | self-produced hillshade/contour/slope from open DEMs | public-domain DEMs |
| Free flight | thermal.kk7 skyways/thermals | **CC BY-NC-SA — off by default**; personal-tracks heatmap is the license-clean substitute |

Offline caveat: a pack only captures sources *referenced in the style*, so any overlay that
must work offline (airspace in flight!) is wired as a style source, not fetched ad hoc.

### Layer 6 — Sport algorithms (the real per-sport work)

Each is a derived-fact pass reading a `Track` and emitting tier-2 Observations —
confidence-attached, descriptive, never gating — exactly like `stimulus.ts`'s `reveal()`:

- **Run/lift detection** (ski): segment a GPS track into runs vs lift rides. Slopes' entire
  moat; resort data only *names* the segments afterward.
- **Thermal detection** (flight): barometric rate-of-climb over the Track → thermal
  segments; a personal skyways layer is your own tracks rasterized (Strava's heatmap recipe,
  no license issue since it's your data).
- **Jump/session detection** (wind/kite): GPS+accelerometer, analogous to run detection.
  (Least-researched vertical — needs its own pass before building.)

These read the *same* canonical Track. No new ingestion, no new render — pure analysis.

## Build order (inside-out, mirrors the rings)

| Phase | Deliverable | New native dep? | Status |
|---|---|---|---|
| 0 | This spec | no | ✅ done |
| 1 | Route-field reconciliation + `GeoPoint` extension + `core/src/track.ts` spine + GPX adapter + tests | no | **next (autonomous)** |
| 2 | Track → Observation persistence + timeline wiring + fidelity reconciliation | no | **next (autonomous)** |
| — | *handoff: pick tile provider (MapTiler/Stadia), get API key* | — | needs a human |
| 3 | `@maplibre/maplibre-react-native` config plugin + `<RouteMap>` (renders any Track) | maplibre (config plugin, dev client already exists) | after key |
| 4 | **Hiking/Running vertical slice** (HealthKit route via the `readActivities` stub + GPX → render → elevation profile) | no | first proof |
| 5 | Per-sport overlays + algorithms, walked outward (ski → flight → water → wind) | FIT lib at ski/Garmin | the long tail |
| 6 | 3D replay (webview GL JS + deck.gl) | no (webview) | polish |

**Why this order:** Phases 1–2 are stack-agnostic `core/` + storage work with tests and need
no new native dependency — the project's strongest ground, where correctness is cheapest to
establish, and **fully completable by an unsupervised session** (no device, no map, no API
key). Phase 3 is where an external dependency (a tile-provider API key) first needs a human,
so that's the clean autonomous-build stopping line. The Expo dev client itself is *already*
in place from wearable ingestion — adding MapLibre is a config-plugin rebuild, not a
migration. Hiking/Running is the Phase-4 proving ground because it exercises the whole spine
(HealthKit route + GPX ingest, DEM elevation, basemap, elevation profile) with **no
NC-licensed data and no bespoke algorithm** — the cleanest end-to-end test, which then
becomes the template every other sport copies.

## Invariants (carried from the constitution)

- Every derived value (DEM elevation correction, algorithm-detected segments) keeps its
  tier/fidelity tag; a tier-3/derived value never overwrites a tier-1 sensor fact.
- All map surfaces are **descriptive** — rendering what happened. A personal heatmap has
  none of the social entanglement of Strava's; that stays Ring 4.
- No gamification anywhere in this stack.
- thermal.kk7 (NC) ships **off by default**; the license-clean personal-tracks heatmap is
  the substitute.

## Open dependencies to resolve as phases land

- Tile/basemap provider choice + free-tier ceilings (MapTiler vs Stadia vs self-host
  Protomaps) — decide at Phase 3, not before.
- Wind/kite mapping is under-researched (`sport-mapping-research.md` §4) — needs its own
  pass before its Phase-5 increment.
- 3D terrain maturity inside `maplibre-react-native` vs the webview pattern — spike at
  Phase 6.
