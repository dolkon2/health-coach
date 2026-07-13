# Phase 4 · P4-2 — 3D terrain + v11 camera/gesture polish

**Date:** 2026-07-12/13 · **Branch:** `feat/3d-terrain-map` (off `main`, HEAD `9b42317`) · **Worktree:** `~/Projects/health-coach`
**Head:** `efda494` · 6 commits · **⚠️ NOT pushed** (awaiting Dylan)

Enables MapLibre v11 3D terrain — hillshade + terrain-RGB DEM exaggeration + an
initial camera tilt — on both map "hero" surfaces (Map tab Record pre-start,
route/session detail via the shared `RouteMap`). No schema, no migration.

## What shipped (6 single-concern commits)

1. **`fdf1755` config: MapTiler terrain-RGB tile URL** — `mapTerrainTileUrl()`
   in `src/lib/config.ts`, gated on the same `MAPTILER_KEY` as the base style
   (no second keyed dependency).
2. **`c439a60` adapter: widen the MapLibre v11 adapter** — `Camera` gains
   `pitch`/`bearing` (documented v11 `CameraOptions`), `Map.mapStyle` widens
   to `string | StyleSpecification`, `RasterDEMSource` joins the typed
   adapter (`src/components/mapLibre.ts`).
3. **`60cd36b` terrain style transform + fetch/cache hook** — `withTerrain()`
   (`src/lib/mapTerrain.ts`, unit-tested) layers the style-level `terrain` +
   `sky` fields onto a fetched MapTiler style JSON; a first-pass
   `useTerrainMapStyle` hook fetched-and-cached it.
4. **`041f146` wire it into RouteMap + MapSurface** — both hero surfaces got
   the terrain-RGB `RasterDEMSource` + hillshade `Layer`, plus an initial
   Camera `pitch`.
5. **`e65ed58` config dedup** — `mapStyleUrl()`/`mapTerrainTileUrl()` factored
   onto one `mapTilerUrl(path)` helper (review finding).
6. **`efda494` fix: settle terrain style resolution once, not mid-mount** —
   see below; this is the real substance of the pass.

## The bug the review caught (and the sim caught again, live)

The high-effort 8-angle `/code-review` on commits 1-5 converged, from three
independent angles, on the same real defect: handing `Map` a plain style URL
string on first render and later swapping it for the fetched+terrain-
augmented object forces MapLibre to reload the whole style — which resets
the camera to the default world view. The Camera's `center`/`zoom` props
hadn't changed, so nothing re-issued the jump.

This wasn't theoretical — I reproduced it live on the iPhone 17 sim: the Map
tab's Record pre-start surface got stuck at a world view instead of
centering on the user/spots, exactly matching the predicted failure. (A
second, unrelated world-view sighting during the same session turned out to
be simulator GPS flakiness — confirmed by reverting to the pre-terrain
`MapSurface.tsx` and reproducing the identical stuck-world-view with `git
checkout main -- ...`, so that one is *not* a regression from this pass.)

**Fix (`efda494`):** `useTerrainMapStyle` (moved to `src/hooks/`, matching
the codebase's other hooks) now resolves to a settled
`{status: 'ready', mapStyle, terrainReady}` exactly once per session — a
`'loading'` state in between, which `RouteMap`/`MapSurface` treat as their
existing fallback (SVG trace / neutral placeholder) rather than mounting
`<Map>` early. `<Map>` therefore only ever mounts with its *final* style
value; nothing swaps it out from under an already-rendered camera. Also:
- One shared in-flight promise across every RouteMap/MapSurface mount
  (closes a duplicate-fetch race the review found).
- `res.ok` checked before parsing JSON (an expired/invalid key was
  previously accepted as a valid style body).
- `terrainReady` is now the *single* flag gating both the style's `terrain`
  field and the matching `<RasterDEMSource>` (extracted into
  `src/components/TerrainHillshade.tsx`, replacing copy-pasted JSX in both
  callers) — they can no longer disagree.
- A failed fetch degrades that one mount honestly (flat style, no terrain)
  without poisoning later retries — a later independent mount tries again,
  since the failure is transient network state, not a permanent capability
  gap.

## Verification

- **jest:** 127 suites / **1317 tests** pass (+4 new: `mapTerrain.test.ts`
  covers the pure `withTerrain()` transform; +4 more:
  `useTerrainMapStyle.test.ts` covers the extracted `resolveTerrainStyle`
  async function against a mock `fetchImpl` — success-with-terrain,
  success-without-a-DEM-url, non-2xx, and a rejected fetch).
- **tsc --noEmit:** 0 errors.
- **`/code-review` (high effort, 8 angles, adversarially verified):** found
  the camera-reset bug above (converged 3 ways) plus a handful of
  cleanup/efficiency findings (duplicated JSX, a duplicated 3-line hook
  setup at each call site, a `Map`-based cache where a single nullable slot
  would do, the hook living outside `src/hooks/`). All addressed in the fix
  commit. A follow-up verification agent re-read the fix pass afterward and
  confirmed it holds; one narrow, self-healing edge case remains (below).
- **Sim smoke (iPhone 17, on-device MapTiler tiles + terrain-RGB, real
  hillshade relief visible on Bald Mountain's ridge near Hood River):**
  Record pre-start centers correctly and renders visible relief shading
  (screenshots saved); route detail (`Hood River Loop`, plotted, 0.98 mi)
  draws its polyline over the terrain-enabled style with no crash — that
  specific route's bounding box happens to sit mostly over flat river
  surface, so it doesn't visually showcase relief, but the same hook/
  component path is exercised and confirmed via a temporary on-screen debug
  readout (`terrainReady=true pitch=45`) before being removed. The
  interactive two-finger tilt *gesture* could not be driven via
  computer-use's single-pointer mouse simulation (a known tooling
  limitation, same one noted in the P4-1 handoff for live-recording taps) —
  `touchPitch` defaults to `true` on `Map` and was left untouched, so the
  gesture itself is unexercised by this session, not disabled.

## ⚑ Judgment calls made without stopping to ask

- **⚑1 — Terrain rides MapTiler's own terrain-rgb-v2 tileset**, not a
  separate free/keyless DEM (e.g. Mapterhorn, which `mapping-architecture-
  spec.md`'s "spectacular polish" note and the MapLibre RN repo's own
  Hillshade example both use). Reasoning: the handoff explicitly said
  "MapTiler serves a terrain-RGB tileset; confirm the URL/key," terrain
  only activates on the already-keyed path (no OpenFreeMap/keyless terrain
  in this pass — M0's keyless default is still unbuilt, unrelated to this
  pass), and one key/vendor for both style + DEM is simpler than adding a
  second unkeyed dependency. *Alt (rejected): Mapterhorn — free but a
  second cartography source to reconcile stylistically with MapTiler's
  outdoor style, and out of scope for "the keyed upgrade."*
- **⚑2 — Terrain fields (`terrain`/`sky`) require fetching and mutating the
  style JSON client-side**, since v11's RN wrapper has no declarative
  component or imperative `setTerrain()`/`setSky()` for those two
  style-level fields (confirmed against the installed package's `.d.ts` and
  the upstream repo's own examples — only `RasterDEMSource` + a
  `type="hillshade"` `Layer` are declarative). This is the "spike" the
  handoff anticipated; documented in `mapTerrain.ts`/`useTerrainMapStyle.ts`
  so the next surface that wants terrain doesn't have to re-derive it.
- **⚑3 — Initial camera pitch fixed at 45°**, not user-configurable, not
  ramped in from 0. Reasoning: the task asked for a tilt "where it reads
  well," and a fixed value the user's own two-finger drag can still adjust
  (`touchPitch` default) seemed the simplest honest interpretation. *Not
  re-litigated: exaggeration (1.3×) and pitch (45°) are both guessed tuning
  constants, not measured — flag if they read too subtle/too dramatic once
  Dylan's seen them on a real device.*
- **⚑4 — Did not build a `Camera` `bearing`-setting UI or wire map rotation
  anywhere**, despite adding `bearing` to the adapter type (the P4-1 handoff
  asked for both `pitch?` and `bearing?` on the Camera type). `bearing` is
  therefore currently unused outside the type surface — a deliberate
  API-completeness match to the real v11 `CameraOptions`, not scope creep;
  flag if a future reviewer wants it removed until a caller exists.
- **⚑5 (small, self-healing) — a narrow retry-delay edge case**: if *every*
  subscriber to an in-flight style fetch unmounts before it resolves (e.g.
  the user navigates away and immediately back during a slow/failing
  fetch), the next mount reuses that already-settled (failed) promise
  instead of retrying immediately — it self-corrects on the mount *after*
  that. Verified via an independent review pass; judged not worth the extra
  complexity of a proper subscriber-count/abort mechanism at this app's
  personal scale. Flag if this ever becomes visible as "map doesn't have
  terrain for a session," which would need a real repro to confirm.

## Not done / deferred

- **OpenFreeMap keyless default (M0)** — still unbuilt, unrelated to this
  pass; terrain only ever activates on the keyed MapTiler path, and the
  existing keyless/native-absent fallbacks are unchanged and re-verified.
- **Interactive tilt-gesture verification** — `touchPitch` left at its `true`
  default; not driven interactively this session (tooling limitation, see
  above).
- **NOT pushed / not merged** — shared-state action, awaiting Dylan.

## Status block

- **Pass:** P4-2 3D terrain · branch `feat/3d-terrain-map` · head `efda494`
- **Tests:** 1317/1317 jest (127 suites) · tsc 0 · code-review: 1 real bug
  found + fixed (confirmed live on sim) · sim-smoke: Record pre-start +
  route detail both verified, screenshots saved
- **⚑ flags:** 5 above — none blocking; ⚑5 is the only one worth a second
  look if terrain ever silently fails to show up on a session
- **Deferred:** OpenFreeMap keyless default (M0, separate pass), interactive
  tilt-gesture drive-test
- **Safe to leave as-is?** Yes — branch is green and self-consistent. Next
  action is Dylan's call to push/merge, then whichever Phase 4 track he
  picks up next (P4-3 Benchmark groups, P4-4 Gear Quiver, or a 🟥
  flag-resolution pass to unblock the Sections/Explore track).
