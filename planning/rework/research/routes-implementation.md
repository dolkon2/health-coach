# Routes implementation — competitor patterns + RN/Expo stack research

*Research date: 2026-07-11. Input to the product-rework planning pass. Extends — does not
restate — `routes-spec.md` (REF pins-routes branch, the authority on the Route entity and
build passes), `gps-mapping-spec.md` (REF versions), `mapping-architecture-spec.md` (the
6-layer contract), and `mapping-systems-research.md` (2026-07-04 renderer/tiles research).
Web findings below were gathered 2026-07-11 via search; codebase facts verified against the
working tree.*

**Scope note:** the routes-spec's locked decisions (straight-line builder, no routing engine,
no off-route alerts, three creation doors, Training list / Map creation, follow = muted line)
are treated as fixed. This doc asks: what do the leading apps do, what's worth stealing
within the constitution, and what should the implementation actually be built on.

---

## 1. How the leading apps do route creation

### Strava

- **Web builder:** snap-to-network routing weighted by the global heatmap ("popularity"
  routing), with preference toggles (popular vs. direct, minimize elevation, paved vs. dirt).
- **Mobile:** tap-to-route between points, heatmap-aware; an explicit **Manual Mode**
  (ellipsis menu) drops to straight point-to-point lines. In Manual Mode Strava disables the
  popularity/elevation selectors and states plainly that *"distance and elevation can only be
  roughly estimated for manual edits."*
- **Save activity as route:** "•••" on an activity → Create Route. Web-only feature; the
  public API cannot create routes at all (Routebuilder-only), and routes/activities are
  served as **Google-encoded polylines** (`summary_polyline`) — encoding is their wire
  format, not their editing model.
- **Follow:** turn-by-turn cues on snapped routes; on manual routes it degrades to a line.

**Steal:** the Manual Mode *honesty labeling* — when geometry is hand-placed, say what the
numbers can and can't claim. That is exactly our confidence-is-first-class convention applied
to a builder readout. Also the precedent that straight-line mode is a first-class mode in the
biggest player's builder, not a fringe hack — the routes-spec reversal is well supported.
**Refuse:** heatmap-weighted routing (population-derived suggestion; also needs a data moat
we don't have and don't want), segments/KOMs (already refused in gps-mapping-spec § The line).

### Komoot

- Full routing engine over OSM: per-sport weighting (surface, trail grade) scores every meter;
  waypoints auto-connect along the network. Turn-by-turn voice is the flagship follow UX.
- Offline is per-route or per-region downloads; off-route while offline shows the planned line
  and alerts, but can't re-route until reconnected.

**Steal:** the per-route offline download unit (download *this route's* corridor, not a whole
country) — relevant later when the Map shell's offline work lands; a route's bbox is the
natural pack definition (already anticipated by `mapping-architecture-spec.md` Layer 4).
**Refuse:** the whole recommendation layer ("ready-made routes for you" is push), voice
turn-by-turn (coach-that-leads posture, and enormous engineering for a refused interaction).

### Gaia GPS — the closest philosophical match

- **Tracks and routes are distinct object types**: a track is what happened (recorded, has
  time/speed), a route is a plan (geometry only). Converting a track to a route **deletes the
  time and speed stats**. This is precisely the routes-spec Session/Route split and its
  timestamp-stripping rule — independently arrived at by the most data-honest app in the set.
- **Per-segment mode switching:** while building, each leg can be snap-to-trail (OSM-based,
  hiking/biking/driving profiles) *or* straight-line; their "hybrid routing" mixes both in one
  route, and where no trail exists the planner falls back to a straight segment.

**Steal:** (a) validation that the track→route conversion strips performance data — keep
that rule exactly; (b) the **hybrid precedent shapes our schema**: if snap-to-trail ever
returns (post-MVP ladder), it arrives as *more points inserted between user waypoints* — the
`RoutePoint[]` storage doesn't change, only the builder does. See § 4 storage for the one
cheap schema addition this implies.

### AllTrails

- Custom routes snap to OSM paths "with confirmed foot traffic"; smart-routing helpers:
  **reverse direction, double back, close loop**, make shorter, reduce elevation, scenic.
- Navigation fires a **wrong-turn notification ~50 m off route**; dismissible per-hike.

**Steal:** the *pure-geometry* helpers. "Reverse direction" and "close loop (straight segment
back to start)" need zero routing engine — they're array operations on `RoutePoint[]` and are
descriptive conveniences, not suggestions. Cheap adds to the builder when it lands.
**Refuse:** wrong-turn push notifications (see § 3), "make shorter / scenic" (engine-driven
and taste-prescribing).

### onX (Backcountry / Offroad / Hunt)

- Mobile-first builder: drop a point, drop the next, auto-snap to the nearest trail from
  their 650k-mile dataset; **"Point Draw"** is the explicit free-placement mode.
- Distance/elevation metrics update live as points are placed.
- **Routes can be built fully offline** on top of a saved offline map region (iOS).

**Steal:** live distance readout per placed waypoint (pure haversine fold — we already have
`routeDistanceM`); the offline-builder expectation for the eventual Map shell (a builder that
dies without signal is a builder that dies at the trailhead). **Refuse:** nothing notable
beyond the proprietary trail dataset itself, which is their moat and not our game.

### Ride with GPS

- Ride→route conversion lives on the web ("convert a ride to a route", then edit/add cues).
- Follow: voice turn-by-turn plus **off-course chimes repeating every two minutes**.

**Steal:** the naming default when saving a recording (defaults to date, one-tap rename) —
low-friction save-as-route matches our door 3. **Refuse:** the two-minute nag chime — this is
the single clearest example in the space of the app grabbing the wheel.

### The follow-UX reference that actually matches ours: watch breadcrumbs

Garmin/COROS/Suunto breadcrumb navigation is a course line + a chevron for where you are and
which way you're pointing — no map, no turn-by-turn. Watches add a vibration at ~10–20 m
deviation; strip that and the remainder — **line + self-position, user navigates themselves** —
is exactly the routes-spec follow decision. Useful vocabulary for the eventual Explore-surface
design: we are building *phone-screen breadcrumb navigation*, a pattern users of outdoor
watches already know, not a degraded Komoot.

---

## 2. Cross-app synthesis

1. **Straight-line creation is a legitimate first-class mode everywhere** (Strava Manual Mode,
   Gaia straight-line legs, onX Point Draw). No app treats it as a broken state; two label its
   estimates honestly. The routes-spec's cut-reversal is squarely inside industry practice —
   the *unusual* part of our MVP is only that straight-line is the *only* mode, which Gaia's
   hybrid model shows is forward-compatible rather than a dead end.
2. **Save-recording-as-route is universal, and always lossy on purpose.** Every app that has
   both concepts (Strava, Gaia, RWGPS) converts by stripping time/performance. Our
   door 3 (P2.5) is the standard pattern; no app prompts aggressively at record-stop either —
   Strava and Gaia both make it an after-the-fact action from history, which supports the
   routes-spec's resolution (explicit later action; stop-prompt deferred).
3. **Follow without turn-by-turn is the watch pattern, not an app anomaly.** Phone apps mostly
   bolt on alerts; watches prove line+chevron alone navigates fine.
4. **Every phone competitor pushes off-route alerts; we deliberately don't.** Recorded for the
   post-MVP constitution review the routes-spec already schedules (its ladder: "off-route
   indication (if ever — constitution review first)"): the competitor framing is safety
   ("focus on the view, not the map"), and a *passive* visual state (your dot is visibly off
   the line — which the user sees by looking, no buzz, no banner) is arguably already what our
   follow renders. Nothing to build; noted so the future review starts from the research
   rather than from Strava-envy. Not re-flagging — the decision is locked and the spec
   already carries the review hook.
5. **Nobody stores editing geometry as encoded polylines.** Encoding shows up at wire/export
   boundaries (Strava API). Editing/storage models keep structured points. Matches our plan.

---

## 3. The RN/Expo implementation picture

### Renderer: stay on MapLibre RN — but the v10→v11 line matters now

`mapping-systems-research.md` already picked `@maplibre/maplibre-react-native`; nothing in
this pass overturns it. What's new since 2026-07-04 is that the version question is no longer
theoretical:

- **Installed today:** v10.4.2, pinned because its config plugin matches Expo SDK 53
  (`package.json`: `expo ^53.0.0`, RN 0.79.6; `RouteMap.tsx` documents the pin).
- **v11 (current):** **New Architecture only**, RN ≥ 0.80, and a renamed API surface aligned
  to MapLibre GL JS — `MapView`→`Map`, `centerCoordinate`→`center`, `zoomLevel`→`zoom`,
  `sourceID`→`source`, plus OfflineManager changes (packs by generated id,
  `subscribe`→`addListener`, restructured `createPack` options).
- **Expo SDK 56** (the docs AGENTS.md mandates): RN 0.85, React 19.2, Hermes v1 default —
  comfortably clears v11's floor. SDK 53 does not.

⚑ **Sequencing fork the user should call:** the route *builder/follow* work (P3/P4, already
deferred into the Map Explore track) will be gesture- and camera-heavy — exactly the API
surface v11 renamed. Building it on v10 and then upgrading means paying the migration on our
most map-dense screens. Options: **(a)** upgrade Expo SDK 53→56 + MapLibre v10→11 *before*
the Map shell / Explore / builder work starts (my lean: the deferral of P3/P4 creates a
natural window, and AGENTS.md already points the project at SDK 56 docs); **(b)** build P1–P2.5
now on v10 (they barely touch the map — list uses the SVG `RoutePreview`, detail reuses
`RouteMap` as-is) and gate only the Explore-surface work on the upgrade. These are compatible:
P1–P2.5 are map-version-agnostic, so (b) now with (a) as a prerequisite of the Explore track
is the low-regret path — but the upgrade itself is real work (New Arch flip, healthkit +
reanimated + screens compatibility) and needs its own decision.

**Decision (obvious call): expo-maps and react-native-maps stay rejected.** `expo-maps`
(SDK 56) is alpha, iOS 18-minimum, Apple Maps/Google Maps only — no custom tile sources, no
offline story, basemaps wrong for trail terrain. `react-native-maps` renders vector tiles
poorly (raster `UrlTile`/WMS only; community threads confirm `.pbf` sources don't work),
has no offline manager, and would orphan the shipped `RouteMap`. Neither can render the
OSM-outdoor cartography this product lives on.

### Map tap gesture (builder + spot placement spike)

The v10 lineage documents `MapView.onPress` delivering a GeoJSON Point feature for the tapped
location (same API family as the old react-native-mapbox-gl; v11 keeps an equivalent on
`Map`). So tap-to-place is a documented API, not a research risk — the routes-spec's
crosshair-button fallback should stay specced anyway because the *spike is about on-device
behavior under our pinned v10.4.2 + Expo 53 dev client* (event reliability, gesture conflicts
with camera pan), not about whether the prop exists. Shared spike with Spots Pass 4 stands.

### Tiles: cost and the keyless-default opportunity

| Source | Cost/terms | Fit |
|---|---|---|
| **MapTiler Cloud** (wired in today via `mapStyleUrl()`) | Free tier: 100k requests + 5k sessions/mo, non-commercial framing; paid from $25/mo | Best outdoor cartography (topo/contours/terrain-RGB); the key is a per-dev setup step |
| **OpenFreeMap** | Free, **no API key, no request limits, no registration**; production use explicitly OK (MapHub runs on it); attribution required ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") | Vector OSM styles (Liberty etc.); **no topo/terrain layers, no DEM** |
| **Protomaps (PMTiles)** | Free self-host — one file on any static host/CDN | Full control + true offline potential; ops burden is ours |

**Decision (obvious call): make OpenFreeMap the keyless default style, keep MapTiler as the
keyed upgrade.** `RouteMap` currently degrades to the SVG trace whenever no MapTiler key is
configured; pointing the fallback at an OpenFreeMap style URL instead means every dev build
and every user gets a real GL basemap for free, with MapTiler's outdoor/topo style as the
opt-in when a key exists. One config change in `src/lib/config.ts`'s style resolution, zero
schema impact. (SVG fallback stays for the no-native-module case.)

⚑ **Offline packs will re-open the tile-terms question.** MapLibre's `OfflineManager.createPack`
(bounds from a route's bbox) is the mechanism, but bulk tile download runs into provider
terms: MapTiler's cloud plans meter requests (an offline pack is thousands of tile requests),
and OpenFreeMap's public instance, while unlimited, isn't designed as an offline-pack origin
either. The clean end-state for offline regions is self-hosted Protomaps extracts. Nothing to
decide in this build (offline is the Map-shell Record track), but the routes/pins work should
not assume "current tile source + createPack" is settled — flagging now so the Map-shell spec
inherits it as an explicit decision point rather than a surprise.

### Storage: JSON points in SQLite is right; encoding is an export format

- **Keep `points TEXT` (JSON `RoutePoint[]`) per migration 016.** At personal scale this is
  the honest, queryable-enough choice: a simplified 500-point route is ~25 KB of JSON; even
  hundreds of routes are megabytes. No spatial index is needed — lists sort by `updatedAt`,
  detail loads by id, and the efforts query scans session payloads (already the
  `listSessionsForSpot` pattern).
- **Google-encoded polyline: adopt only at boundaries, never as the stored shape.** It's
  lossy (1e-5 ≈ ~1 m grid; 1e-6 variant exists), drops elevation entirely, and buys nothing
  inside SQLite. Where it earns its keep later: GPX/route export and any Ring-4 share payload.
- **GeoJSON stays a render-boundary projection** — already canon
  (`mapping-architecture-spec.md` Layer 3, and `RouteMap` does exactly this today).

### Simplification: the missing step in P2.5 (save-as-route)

A recorded session trace at ~1 Hz is 3,600 points/hour; a 3-hour outing promoted verbatim
becomes a 10k+-point "recipe" that bloats the row, slows the SVG thumbnail, and encodes GPS
jitter as if it were geometry. Every serious pipeline simplifies (Strava's own display
pipeline; Gaia's converter; `mapping-systems-research.md` §4 already prescribes RDP).

**Decision (obvious call): add Ramer–Douglas–Peucker simplification to the save-as-route
promotion (P2.5), implemented as a pure function in `core/`** (~60 lines, zero deps — matching
core's no-dependency discipline; `simplify-js` is the reference implementation: radial-distance
pre-pass + RDP). Epsilon in meters via a local equirectangular projection; **~5–10 m
tolerance** preserves trail shape while cutting 60–80%+ of points. Two invariants keep it
constitution-clean:

1. **Never simplify the Session's trace** — that's the tier-1 fact and stays full-resolution
   on the Observation.
2. **Simplify the promoted Route copy freely** — a route is a recipe, not a record; it has no
   tier and no fidelity, so lossy geometry reduction costs nothing honest. (Plotted routes
   need no simplification — the user placed every point.)

### One cheap schema future-proof: remember which points were waypoints

Gaia's hybrid model and any future snap-to-trail layer share one property: the user's
*intent* is the waypoints; everything between is derived. In MVP straight-line routes,
points == waypoints, so nothing distinguishes them — but the moment a routing engine (or even
DEM densification) inserts intermediate points, editing needs to know which points the user
placed. **Decision (obvious call): note in routes-spec that `RoutePoint` may later gain a
`kind?: 'waypoint' | 'derived'` (or the Route a `waypointIdxs?: number[]`), and that MVP
writes plain points** — no migration change now (JSON column absorbs optional fields for
free), just a recorded intention so the builder's undo model is designed against waypoints,
not raw points, from day one.

### Elevation for plotted routes (post-MVP, confirming the honest gap)

The spec's "show nothing, not a flat fake profile" stance survives contact with the options.
When DEM lookup does land, three viable paths, best-first for this stack: **(a)** client-side
terrain-RGB decode — fetch DEM tiles (Mapterhorn PMTiles, BSD-3/open, or MapTiler terrain-RGB)
and sample per point; MapTiler's own `dem-elevation-profiler` is an open reference
implementation of exactly this; **(b)** MapTiler Elevation API (hosted, per-request,
counts against quota); **(c)** self-hosted open-elevation (ops burden, personal-scale
overkill). Whatever the source, DEM-derived elevation carries the `dem` source tag per
`mapping-architecture-spec.md` Layer 2 — derived, never presented as measured.

### Background recording (context for routes-spec flag #5, not this build)

Follow's known ceiling — foreground-only recording — is fixed by the Map-shell Record track,
via `expo-location`'s background mode (config-plugin: `UIBackgroundModes: location` /
`ACCESS_BACKGROUND_LOCATION`), which SDK 56 continues to support in dev builds.
⚑ **Doc-merge hazard for the rework consolidation (needs the user's eyes only because two
"fresh" branches disagree):** the map-nav branch's `gps-mapping-spec.md` (2026-07-10) carries
the deliberate amendment that **background *continuation* of a user-started recording is
required, not banned**; the pins-routes branch's copy (same filename, 2026-07-11) predates
that amendment and still reads "never runs in the background." The merged planning set must
keep the 2026-07-10 amendment — losing it would silently re-ban exactly the 4-hour-flight use
case the amendment exists for.

---

## 4. What routes-spec should adopt / change

**Adopt (additions, no locked decision touched):**

1. **RDP simplification in P2.5** with the two invariants above (session trace never; route
   copy always). Pure-`core/` implementation, fixture-tested.
2. **Strava-style honesty labeling in the eventual builder**: plotted distance is
   point-to-point ("distance as plotted — trails may be longer"); no elevation number at all.
   Our confidence-first convention already demands this; the research just shows the best
   competitor does it too.
3. **Direction affordance on the route line** (route detail + follow): a start marker and
   line-direction arrows (MapLibre `symbol-placement: line`) — descriptive, answers "which way
   does the loop run," standard in every app surveyed.
4. **Reverse / close-loop helpers** on the post-MVP builder ladder — pure geometry, no engine.
5. **`RoutePoint.kind` future-proofing note** (§ 3) — design the builder's model around
   waypoints; schema unchanged at MVP.
6. **OpenFreeMap as the keyless default basemap style** with MapTiler as keyed upgrade (§ 3).
7. **Watch-breadcrumb vocabulary for follow** in the Explore-surface design conversation —
   names the pattern we're building and inoculates against "but Komoot has turn-by-turn."

**Change / carry forward as flags:**

8. ⚑ **MapLibre v10→v11 + Expo SDK 53→56 sequencing** (§ 3) — P1–P2.5 are version-agnostic
   and can build now; the Explore-surface builder/follow work should decide upgrade-first vs.
   build-on-v10. Lean: upgrade lands before the Explore track starts.
9. ⚑ **Offline tile terms** (§ 3) — inherit into the Map-shell spec as an explicit decision
   (provider quota vs. self-hosted Protomaps extracts) before `createPack` ships.
10. ⚑ **gps-mapping-spec merge hazard** (§ 3) — preserve the 2026-07-10 background-continuation
    amendment when consolidating the branch copies.
11. **No change to the no-alerts follow decision** — research context recorded (§ 2 point 4)
    for the constitution review the spec already schedules; not re-flagged.

## Key sources

Strava: [Creating Routes on Mobile](https://support.strava.com/hc/en-us/articles/18001474720397-Creating-Routes-on-Mobile) · [Routes on Web](https://support.strava.com/hc/en-us/articles/216918387-Routes-on-Web) · [API reference / summary_polyline](https://developers.strava.com/docs/reference/) —
Komoot: [Navigation FAQ](https://support.komoot.com/hc/en-us/articles/10605424981402-Navigation-FAQ) · [Offline routes & maps](https://support.komoot.com/hc/en-us/articles/10356476920986-Download-routes-and-maps-for-offline-use) —
Gaia GPS: [Create & Measure Routes](https://help.gaiagps.com/hc/en-us/articles/115003640568-Create-and-Measure-Routes-on-gaiagps-com) · [Convert Tracks to Routes (iOS)](https://help.gaiagps.com/hc/en-us/articles/4411719096215-Convert-Tracks-to-Routes-in-the-iOS-app) · [Hybrid routing](https://blog.gaiagps.com/create-a-route-ah-hybrid-routing/) —
AllTrails: [Wrong-turn alerts](https://support.alltrails.com/hc/en-us/articles/37213407013908-Wrong-turn-alerts) · [Custom routes](https://support.alltrails.com/hc/en-us/articles/37270479773204-How-to-create-custom-routes) —
onX: [Backcountry Route Builder](https://www.onxmaps.com/backcountry/app/features/route-builder) · [Snap-to-trail help](https://onxbackcountry.zendesk.com/hc/en-us/articles/22965175493133-Building-Routes-that-snap-to-road-and-trails) —
Ride with GPS: [Voice navigation / off-course](https://support.ridewithgps.com/hc/en-us/articles/4419572706971-Voice-Navigation) —
Breadcrumb pattern: [Advnture explainer](https://www.advnture.com/features/breadcrumb-navigation) —
Stack: [MapLibre RN v11 release](https://github.com/maplibre/maplibre-react-native/releases/tag/v11.0.0) · [v11 migration](https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11/) · [OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/) · [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56) · [expo-maps (alpha)](https://docs.expo.dev/versions/latest/sdk/maps/) · [OpenFreeMap](https://openfreemap.org/) · [MapTiler pricing](https://www.maptiler.com/cloud/pricing/) · [MapTiler Elevation](https://docs.maptiler.com/cloud/api/elevation/) · [dem-elevation-profiler](https://github.com/maptiler/dem-elevation-profiler) · [Protomaps](https://protomaps.com/) · [Encoded polyline format](https://developers.google.com/maps/documentation/utilities/polylinealgorithm) · [simplify-js lineage](https://github.com/geonome/simplify2-js)
