# Mapping systems research — how Strava does it, and how we should

*Research date: 2026-07-04. Produced by a fan-out deep-research pass: 24 sources fetched,
58 claims extracted, top 25 adversarially verified (3-vote panels) — 25 confirmed, 0 refuted.
Confidence labels below reflect that verification. Where something was NOT verified, it says so.*

**Context in this repo:** we don't render maps yet. `training-logging-spec.md` defines the
outdoor/GPS logging surface with `gps_data.route: GeoJSON`, and `wearable-ingestion-spec.md`
plans FIT/GPX/TCX ingestion from the Garmin Connect Activity API plus HealthKit. The spec's
own words: *"The app is not building a GPS tracker. It's ingesting from one. Strava is the
right reference for how display of imported GPS data should feel."* This doc is the research
behind choosing that display stack.

---

## 1. How Strava builds its mapping (verified)

### The global heatmap — a batch rasterization pipeline, not a map trick

**High confidence** (primary source: Strava Engineering, Drew Robb, 2017 —
["The Global Heatmap: Now 6x Hotter"](https://medium.com/strava-engineering/the-global-heatmap-now-6x-hotter-23fc01d301de)):

- Apache Spark + Scala batch job reading an S3/Parquet warehouse. It replaced a
  single-machine C implementation that took **months** per update; the rewrite regenerates
  the full heatmap — 700M activities, ~7.7 **trillion** GPS points — across several hundred
  machines in a few hours for **a few hundred dollars** of compute.
- Rasterizes at Web Mercator **zoom 16** (2¹⁶ × 2¹⁶ grid of 256px tiles; >30M populated
  tiles, ~15 TB raw). Each activity is drawn as a **pixel-perfect path** between consecutive
  GPS points (Bresenham line rasterization) rather than plotting points — this is why their
  lines look continuous instead of stippled.
- Lower zooms are built bottom-up: four child tiles sum into one parent, normalization
  re-runs, down to a single world tile. Visual quality also comes from per-tile CDF
  normalization and bilinear interpolation.
- **Caveat:** this is Strava's self-reported 2017 architecture; no newer public source
  documents the current internals.

**Takeaway for us:** the heatmap is a *data-engineering* artifact — precomputed raster tiles
served like any basemap layer — not something the map SDK does at render time. A
personal-scale equivalent (one user's activities) doesn't need Spark at all; it's a
client-side or small-server aggregation.

### Elevation — a crowdsourced basemap plus map-matched lookup

**High confidence** (Strava's own support docs, verified verbatim):

- Every activity uploaded from a **barometric-altimeter** device feeds Strava's own
  elevation basemap. Non-barometric uploads (including their own phone app) get automatic
  "elevation correction" by lookup against that basemap; a public DEM is only the fallback
  where their basemap has no coverage.
- The lookup includes a **map-matching-style snap**: elevation is looked up for the road or
  trail you were actually on, not the slightly-off raw GPS coordinates.
- Barometric devices keep their recorded elevation by default *only if* recognized in
  Strava's device database.

**Takeaway for us:** this mirrors our evidence hierarchy almost exactly. A barometric
altimeter reading is closer to tier 1; a DEM lookup is tier-2/3 derived. When Garmin FIT
files arrive with barometric altitude, keep it; when a trace has GPS-only altitude, correct
against a DEM and mark the lower fidelity. Their snap-to-trail trick is why their elevation
profiles look clean.

### Flyover / 3D — bought, not built

**Medium-high confidence** (TechCrunch Nov 2023 + Strava press releases, unanimous 3-0):
Strava's Flyover 3D terrain replay is powered by **FATMAP**, the 3D mapping platform Strava
**acquired in January 2023** (the FATMAP app was retired Oct 2024 as its tech was absorbed).
Strava did not build 3D flyover in-house. Their basemap rendering historically sits on
Mapbox (their designers have co-published with Mapbox on outdoor map styling), though the
Mapbox-partnership sources didn't survive verification as primary claims.

**Takeaway for us:** even a company with Strava's resources bought this capability. The good
news: the open-source ingredients for the same effect now exist (see §3).

## 2. Garmin — the honest gap

**No claims about Garmin Connect/Explore's internal mapping stack survived verification.**
Garmin publishes almost nothing about its rendering internals. What we know from their
*developer-facing* side (already in `wearable-ingestion-spec.md`): the Garmin Connect
Activity API pushes completed FIT/GPX/TCX files with full GPS, HR, cadence, and elevation to
a webhook. For our purposes Garmin is a **data source**, not a rendering reference — and the
FIT format (their format) is the richest input we'll get.

## 3. The platform landscape

The renderer choice and the tile (basemap data) choice are **separate decisions** — this is
the single most important structural fact in the landscape.

### Renderers

| Renderer | License / cost | RN + Expo | Verified? |
|---|---|---|---|
| **MapLibre** (Native + GL JS) | MIT wrapper / BSD engines — free | `@maplibre/maplibre-react-native`: official Expo config plugin, dev build required (not Expo Go). v11.3.6, June 2026, New Architecture, wraps MapLibre Native Android 13.2.0 / iOS 6.26.0. True native vector rendering, no webview. | **High** (docs + npm artifact inspected) |
| **Mapbox** (`@rnmapbox/maps`) | Proprietary SDK; pay per MAU/loads | Official Expo config plugin; also dev-build-only (custom native code, no Expo Go) | **High** (install docs verbatim) |
| **deck.gl** | MIT — free | Web/WebGL (webview or web build in RN); `TripsLayer` is purpose-built for animated GPS replays | **High** (docs + v9 source) |
| **CesiumJS** | Apache 2.0 (engine free; Cesium ion assets are the paid part) | Web-only; no native RN story — webview if used | *Not verified this pass* |
| **Leaflet** | BSD — free | Web-only, raster-first, no native RN; fine for simple embeds, wrong tool for vector/3D | *Not verified this pass* |
| Google Maps Platform | Proprietary, per-load pricing | Via react-native-maps; styling/3D control is weakest of the set for this use case | *Not verified this pass* |

MapLibre is the community fork of Mapbox GL from when Mapbox closed its license in 2020 —
same style-spec, same mental model, zero renderer cost. The RN wrapper is a fork of the
rnmapbox lineage, now independently maintained under the MapLibre org.

### Tiles (the part MapLibre does NOT give you)

**High confidence:** MapLibre ships **no production basemap**. The bundled demo tiles are
dev-only; production requires either a commercial provider (**Stadia Maps**, **MapTiler** —
both publish official MapLibre RN quickstarts, API-key based) or self-hosting
(**Protomaps** single-file PMTiles on S3/CDN, **OpenMapTiles**, **OpenFreeMap**). This is
the real cost/licensing tradeoff vs. Mapbox/Google, whose pricing bundles the basemap.
Note: OSM data is ODbL (attribution required), and OSMF's public tile server **prohibits
production app traffic** — "free" means self-host or a provider's free tier.

**Not verified this pass:** concrete current pricing tiers (Mapbox MAU rates, Stadia/MapTiler
free-tier ceilings). Check current pricing pages before committing; search-phase signals
suggested Mapbox ≈ $1,050 vs Google ≈ $1,550 at ~300K loads, but those figures come from a
secondary comparison blog that did not survive verification. For a single-digit-thousands-MAU
personal app, every provider's free tier likely covers us.

### 3D terrain and flyover — now achievable with zero SDK licensing

**High confidence** (MapLibre official example, source verified verbatim):
MapLibre GL JS has native 3D terrain: a `raster-dem` source + top-level `terrain` property
(tunable `exaggeration`), pitch up to **85°**, an atmospheric `sky` layer, and a built-in
`TerrainControl`. The official example runs entirely on open data — OSM basemap +
**Mapterhorn** DEM tiles (BSD-3, built from Copernicus data, served as public PMTiles).
Those are the ingredients of a Strava-style flyover view, free.

**Important caveat (verified as a gap, not a capability):** that maturity is for MapLibre
**GL JS on the web**. 3D terrain inside `maplibre-react-native` on-device is less mature.
The pragmatic pattern for an Expo app is: native MapLibre view for everyday 2D route
display, and a **webview hosting MapLibre GL JS (+ deck.gl)** for the 3D flyover/replay
screen. That's an open question to spike, not a settled fact.

### Animated route replay — deck.gl TripsLayer

**High confidence:** `TripsLayer` (`@deck.gl/geo-layers`, extends PathLayer) is purpose-built
for this: paths carry per-vertex timestamps (`getTimestamps`), `currentTime` is the animation
playhead (scrub/replay), `trailLength` gives the fading comet-trail. Hard constraint:
timestamps are **32-bit floats**, so raw Unix epoch values lose ~20+ seconds of precision —
**rebase timestamps to seconds-since-activity-start** in the pipeline.

## 4. The ingestion pipeline (FIT/GPX/HealthKit → GeoJSON)

### FIT (Garmin) — solved off the shelf

**High confidence:** [`fit-file-parser`](https://github.com/jimmykane/fit-parser) (TypeScript,
v3.0.2 June 2026, actively maintained) parses Garmin/Polar/Suunto FIT in JS. Output is a
sessions → laps → records tree (`cascade`/`list`/`both` modes); each record carries
`position_lat`/`position_long` (semicircles — convert by × 180/2³¹), `altitude`, `speed`,
`heart_rate`, `power`, `cadence`. That maps directly to a GeoJSON LineString plus per-point
metadata — exactly the shape `gps_data.route` wants. GPX is trivial by comparison (XML of
`<trkpt lat lon><ele><time>`), needing only a small parser.

### HealthKit routes — three verified constraints

**High confidence** (Apple docs, fetched live 2026-07-04):

1. **Two-step read:** the `HKWorkoutRoute` sample has no coordinates; a second
   `HKWorkoutRouteQuery` is required for the location data.
2. **Batched async delivery:** locations arrive as `CLLocation` batches via a
   repeatedly-called handler with a `done` flag — accumulate until done.
3. **~50 m accuracy guarantee only**, and Apple explicitly says routes "may need additional
   smoothing … to produce clean lines when plotting the route on a map."

### The processing steps a "spectacular" display actually requires

Strava-quality display is mostly pipeline, not renderer:

- **Smoothing/outlier rejection** (HealthKit especially): drop points with absurd implied
  speed; light Kalman or moving-average pass. Apple tells you to; Strava does.
- **Simplification for storage/preview:** Ramer–Douglas–Peucker to a tolerance per zoom use
  (thumbnail vs. detail view). Store full resolution, render simplified.
- **Timestamp rebasing** to seconds-since-start (the deck.gl float32 constraint).
- **Elevation correction:** keep barometric altitude when the FIT source has it (higher
  fidelity — tag it); DEM lookup for GPS-only traces, marked as derived. This is our
  tier/fidelity model applied to altitude.
- **Encoded polylines** (Google polyline5/6) if we ever need compact wire format; GeoJSON
  in SQLite is fine at personal scale.
- **Map matching** (snapping to road/trail network, e.g. Valhalla/OSRM): what Strava uses
  for elevation lookup. *Defer* — it's a server dependency and personal-scale display
  doesn't need it. (Open question below.)

## 5. Recommended stack (synthesis — parts verified, composition not end-to-end)

| Layer | Choice | Why |
|---|---|---|
| Native map view (2D routes, everyday) | `@maplibre/maplibre-react-native` | Free, MIT/BSD, official Expo config plugin, true native vector rendering, actively maintained |
| Basemap tiles | Provider free tier first (MapTiler or Stadia — both have official MapLibre RN guides); self-hosted Protomaps PMTiles if/when cost or control demands | Renderer/tiles decoupling; swap via one style-URL prop |
| 3D flyover / replay screen | Webview: MapLibre GL JS `raster-dem` terrain (Mapterhorn open DEM) + deck.gl `TripsLayer` | The verified-free path to Strava-Flyover-like output; native 3D terrain in RN is immature |
| FIT ingestion | `fit-file-parser` | TS, maintained, full GPS+HR+power record tree |
| HealthKit ingestion | Two-step `HKWorkoutRouteQuery` reader + smoothing pass | Apple-documented constraints (§4) |
| Pipeline | FIT/GPX/HK → smooth → simplify (RDP) → GeoJSON LineString + per-point arrays (t, ele, hr) → `gps_data` | Store full-res, render simplified; rebase timestamps |
| Elevation | Barometric kept + tagged; DEM correction fallback | Mirrors both Strava's method and our fidelity model |

Both map libraries require an **Expo development build** (config plugin) — neither runs in
stock Expo Go. That's a one-time workflow change, already normal for EAS builds.

**Why not Mapbox:** it's the incumbent Strava built on and the styling tooling (Studio) is
best-in-class, but it's per-MAU metered proprietary spend for a personal-scale app, and
MapLibre speaks the same style spec. Mapbox remains the escape hatch if MapLibre RN hits a
wall — the component APIs are siblings.

**Why not Cesium:** true 3D-globe engine, wrong weight class for activity display in an RN
app; MapLibre's terrain gets the flyover effect at a fraction of the integration cost.

## 6. Constitution check

- Route display, elevation profiles, personal heatmaps, replays: all **descriptive** —
  rendering what happened. No conflict.
- Elevation correction creates a derived value: keep the tier/fidelity tagging (barometric
  source ≈ tier 1 high fidelity; DEM-corrected ≈ derived, lower fidelity), never silently
  overwrite a device-recorded altitude.
- Strava's *social* heatmap is Ring 4 territory; a personal heatmap has no such entanglement.
- No gamification surface anywhere in this stack.

## 7. Open questions (carried to backlog)

1. **Garmin Connect/Explore rendering internals** — nothing public survived verification;
   treat Garmin purely as a data source.
2. **Current pricing at our realistic tier** — Mapbox/Google/Stadia/MapTiler/self-hosted
   Protomaps numbers were not verified; check pricing pages when the build starts.
3. **3D terrain maturity in maplibre-react-native on-device** vs. the webview
   (GL JS + deck.gl) pattern — needs a spike before committing the flyover screen.
4. **Map matching & simplification parameters** — Valhalla/OSRM matching, RDP tolerances,
   polyline encoding: fidelity-vs-payload tradeoffs to tune when real traces flow.

## Key sources

- Strava Engineering — [Building the Global Heatmap](https://medium.com/strava-engineering/the-global-heatmap-now-6x-hotter-23fc01d301de) (primary)
- Strava support — [Elevation FAQs](https://support.strava.com/hc/en-us/articles/115001294564-Elevation-on-Strava-FAQs) (primary)
- TechCrunch — [Strava launches Flyover](https://techcrunch.com/2023/11/15/strava-launches-flyover-an-aerial-3d-video-recap-of-every-outdoor-activity-you-do/) (secondary, corroborated by Strava press)
- MapLibre React Native — [Getting started](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), [repo](https://github.com/maplibre/maplibre-react-native) (primary)
- Mapbox RN — [install docs](https://rnmapbox.github.io/docs/install) (primary)
- MapLibre GL JS — [3D terrain example](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/) (primary); [Mapterhorn DEM](https://github.com/mapterhorn/mapterhorn)
- deck.gl — [TripsLayer](https://deck.gl/docs/api-reference/geo-layers/trips-layer) (primary)
- [`fit-file-parser`](https://github.com/jimmykane/fit-parser) (primary)
- Apple — [Reading route data](https://developer.apple.com/documentation/healthkit/workouts_and_activity_rings/reading_route_data) (primary)
