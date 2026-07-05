# GPS map + display — Pass 1 (MapLibre map, elevation, splits)

*Branch `claude/outdoor-sports-workspace-fbl5` (the GPS trunk, worktree `~/Projects/health-coach-outdoor`). Built 2026-07-04. Ground truth: `planning/gps-mapping-spec.md`; renderer + data-layer research: `planning/mapping-systems-research.md` + `planning/sport-mapping-research.md` (pulled onto this branch in Step 0). Supersedes the old `gps-mapping-session-prompt.md` / `mapping-systems-research-cit3ol` architecture spec, which were written on a false "greenfield" premise.*

## What this pass ships

The recorded/imported route is no longer just a sparse SVG thumbnail — an outdoor session's **detail view** (open a logged GPS session → it opens `log-session` in edit mode) now shows the full display stack under **Route attached**:

- a **MapLibre vector map** with the route drawn as a polyline over MapTiler tiles (`RouteMap`),
- an **elevation profile** (`ElevationProfile`) — a quiet area chart of climb vs. distance,
- **per-km / per-mile splits** (`Splits`) — pace as a row of rhythm bars.

Every piece is **self-absenting**, honoring the spec's one rule (*ingest or record a track, never fabricate one*) and *null ≠ 0*:

- No MapTiler key → `RouteMap` degrades to the existing SVG trace. No native module (old dev build / jest) → same. Never an empty map frame, never a fake line.
- No altitude in the track (a GPX planned route, a phone with no barometric fix) → the elevation profile renders **nothing**, not a flat 0-line.
- Untimed track → splits render **nothing**, not a fabricated pace.

Fidelity is deliberately **not** an axis here — no GPS fidelity-ladder UI (spec § "Fidelity is not the organizing axis"). Comparison/leaderboards are out; splits are the mirror (bar length ∝ speed, scaled to the fastest split), never a scoreboard.

## Files

- **`src/lib/elevationProfile.ts`** (new) — pure `elevationProfile(points)` → cumulative-distance-vs-`eleM` samples, reusing `geo.ts`'s haversine so the x-axis can't drift from reported distance. Distance accumulates across every fix; a sample is emitted only where a fix carries `eleM`. `null` when < 2 elevation-bearing fixes. Tested.
- **`src/lib/splits.ts`** (new) — pure `splits(points, unit)` → per-km/mi splits, interpolating each unit boundary's crossing time within the straddling segment; the trailing sub-unit stretch is a `partial` split with pace projected to a full unit. `null` when untimed or zero-distance. Tested.
- **`src/components/ElevationProfile.tsx`** (new) — SVG area chart in the `RoutePreview` / `WeightTrendChart` house style; captioned with gain + min–max. Exports `elevationPaths()` (the path builder). Renders nothing when the series is null.
- **`src/components/Splits.tsx`** (new) — the splits as label · bar · pace rows; renders nothing when `splits()` is null.
- **`src/components/RouteMap.tsx`** (new) — the MapLibre map. Projects `GeoPoint[]` → GeoJSON `LineString` **at the render boundary only** (never the stored shape). Native module **lazily `require()`d** behind a gate (mirrors `healthkit/index.ts`), so importing the file never touches native code — safe in jest and old builds. Falls back to `RoutePreview` on no-key / no-module.
- **`src/lib/config.ts`** — `MAPTILER_KEY` / `MAP_STYLE_ID` (`EXPO_PUBLIC_` convention) + `mapStyleUrl()`, which assembles `https://api.maptiler.com/maps/${styleId}/style.json?key=${key}` in code. Key/style never touch `app.json` or git; `null` with no key.
- **`app/log-session.tsx`** — wires `RouteMap` + `ElevationProfile` + `Splits` into the `surface === 'gps'` "Route attached" block, alongside the existing `RoutePreview`.
- **`src/components/index.ts`** — barrel exports for the three new components.
- **`app.json`** — `@maplibre/maplibre-react-native` Expo config plugin.
- **`.env.example`** — `EXPO_PUBLIC_MAPTILER_KEY` + `EXPO_PUBLIC_MAP_STYLE_ID` (names only, no values).
- **`planning/training-logging-spec.md`** — stale `route: GeoJSON` → `gpsPath: GeoPoint[]` (spec data-model ruling #1); GeoJSON now framed as a render-boundary projection only. `data-model.md` was already correct.
- **`planning/mapping-systems-research.md` + `planning/sport-mapping-research.md`** — pulled onto this branch (Step 0).

## Decisions / ⚑ flags for review

1. **MapLibre, not Mapbox** (spec open q#4). Open, no per-load billing; MapTiler for the tiles. Style URL is built in code from env; the free key + custom style id live only in the gitignored `.env.local`.
2. **Modern `paint`/`layout` layer props**, not the deprecated `style` prop (removed in maplibre-rn v12) — future-proof. The native module is typed via a thin local adapter interface (only the four props we pass, verified against the package d.ts); the actual native render is validated by the human's prebuild + visual check, not tsc.
3. ⚑ **`RoutePreview` kept *alongside* `RouteMap`** as the prompt asked. Once the tile map renders, the little SVG trace above it is somewhat redundant — a candidate to drop after the visual check. Left in for now.
4. ⚑ **Elevation is shown in metres** regardless of the km/mi setting — matches the app's existing convention (`… m gain`). If mi users should see feet, that's a small unit-conversion follow-up.
5. ⚑ **The map lives inside the `log-session` ScrollView.** Pan/zoom vs. page-scroll gesture contention is a real on-device UX question — the visual check should confirm it feels right; may want gesture handling or a tap-to-expand full-screen map later.
6. **Wired into the GPS (`endurance`) surface only.** The `paddling` block also carries `gpsPath`, but it isn't a distinct form surface yet — future.
7. **MapTiler attribution left ON** (their ToS requires it) — do not disable.

## Verification

- **299 jest passing** (new: `elevationProfile.test.ts` ×5, `splits.test.ts` ×6; the pure functions are covered — components follow the house pattern of testing the pure layer, not RN render).
- **tsc 0 errors.**
- **`npm install --legacy-peer-deps` only** (locked rule); single dep added: `@maplibre/maplibre-react-native@^11.3.6`.
- **Remaining steps — both a human's:**
  1. **Native rebuild.** MapLibre is a new native module → needs a fresh dev build (`expo prebuild` + `expo run:ios`, or EAS). Not run here by design. The Expo config plugin is already in `app.json`.
  2. **Visual check on device.** Open a logged GPS session that has a route (record a short walk or import a GPX), confirm the map draws the polyline over tiles, the elevation profile matches the climb, and the splits read right. Then eyeball flags ⚑3–⚑5. **The `.env.local` is already set** with the MapTiler key + style id, so the map should light up on first run with no further config.
- **Not yet user-confirmed:** anything requiring the native render (the map itself). Everything below the render boundary — the pure series + the degradations — is tested/typed.
