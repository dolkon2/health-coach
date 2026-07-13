# Phase 4 · P4-1 — Expo SDK 53→56 + MapLibre v10→v11 (the New-Arch flip)

**Date:** 2026-07-13 · **Branch:** `chore/sdk56-maplibre-v11` (off `dd93e74`) · **Worktree:** `~/Projects/health-coach`
**Head:** `80ab3bd` · 4 commits · **⚠️ NOT pushed** (awaiting Dylan)

The "clean upgrade only" session — the spine of Phase 4. Moves the whole platform onto the New Architecture and gets MapLibre onto v11, the prerequisite for the 3D-terrain map (P4-2). No 3D terrain here, by design.

## What shipped (4 single-concern commits)

1. **`5d81d43` chore(deps): SDK 53→56.** `expo` `^53`→`^56.0.15` and the whole SDK-managed tree via `expo install --fix`: React 19.0→19.2.3, React Native 0.79.6→**0.85.3**, all `expo-*` modules, the New-Arch native siblings (screens 4.25.2, gesture-handler 2.31.2, safe-area-context 5.7.0, svg 15.15.4, datetimepicker 9.1.0). Reanimated 3.17→**4.3.1** pulls its now-separate `react-native-worklets` 0.8.3 peer. TypeScript 5.8→**6.0.3**, jest-expo 53→56.0.5. Added `@react-native/jest-preset` (jest-expo's RN preset split out of core in RN 0.85) and wired the `react-native-worklets` jest resolver (worklets' native module throws at import under jest otherwise). HealthKit (kingstinct 14.0.2) and MapLibre (still v10 here) untouched.
2. **`47255c8` fix(types): TS 6.0 / SDK 56 reconciliation.** `ignoreDeprecations` "5.0"→"6.0" (TS 6 flags `baseUrl`). SDK 56's tsconfig.base (bundler resolution) stopped auto-including `@types/jest` globals → pinned `types: ["jest","node"]` to restore `describe/it/expect`. expo-router 56's `tabBarIcon` now hands `color` as `ColorValue`; widened the 5 tab-icon components' prop (they forward it to react-native-svg stroke/fill).
3. **`9d675b5` build(ios): remove obsolete withFmtFix plugin.** See ⚑1.
4. **`80ab3bd` refactor(map): MapLibre v10→v11.** `@maplibre/maplibre-react-native` `^10.4.2`→`^11.3.6` (+`@types/geojson`), the whole API migrated across the 3 files that touch the package (`mapLibre.ts` loader/adapter, `RouteMap.tsx`, `MapSurface.tsx`). The 4 consumer screens use the wrappers unchanged. Renames: `MapView`→`Map` (`logoEnabled`→`logo`), `ShapeSource shape`→`GeoJSONSource data`, `LineLayer style{}`→`Layer type="line" paint{}/layout{}` (style-spec kebab keys — cap/join are *layout*, color/width/dasharray are *paint*), `MarkerView`→`ViewAnnotation` (`coordinate`→`lngLat`, `allowOverlap` dropped), Camera `centerCoordinate/zoomLevel`→`center/zoom`, `animationDuration`→`duration`, `bounds {ne,sw,paddingX}`→flat `[w,s,e,n]` + `padding` object. v11 ships named exports (dropped the default-unwrap) and removed `setAccessToken`.

## Verification (all green)

- **jest:** 125 suites / **1309 tests** pass (same count as pre-upgrade).
- **tsc --noEmit:** 0 errors (run LAST, under TS 6.0).
- **iOS native build:** `expo prebuild --clean` + dev-client build to iPhone 17 sim — **0 errors, 0 consteval failures**. Compiled healthkit/nitro, worklets, screens, safe-area-context, svg, and the v11 MapLibre pod under New Arch.
- **/code-review** (Phase A diff + Phase B diff, high effort, adversarially verified): **no findings**.
- **Sim smoke (iPhone 17, real MapTiler tiles, screenshots saved):**
  - App **boots under New Arch, no redbox** — Home renders (tabs, macro bar, template, spots, benchmarks).
  - **Route detail** (`/route/[id]`, "Hood River Loop", 160 pts): polyline draws over the on-brand basemap, camera **fit-to-bounds + padding** correct → validates GeoJSONSource + Layer + Camera bounds.
  - **Map tab** (MapSurface): on-brand MapTiler basemap renders via v11 `Map`; with GPS set, camera **centers** (Camera center/zoom) and the **spot pin** drops (ViewAnnotation hosts the tappable SpotPin child).
  - Zero JS/native errors in the app log across the whole session.

## ⚑ Judgment calls made without stopping to ask

- **⚑1 — withFmtFix removed, not repatched.** RN 0.85 ships its C++ deps (fmt/folly) as a **prebuilt `ReactNativeDependencies` xcframework**, so fmt is no longer a source pod — the plugin matched nothing and its guard log never fired. Because fmt is precompiled, the Xcode-16 consteval bug it worked around *can't occur* (build proved 0 errors). Removed it as dead code. *Alt (rejected): repoint the patch at the new header path — pointless, nothing compiles fmt from source anymore.*
- **⚑2 — SDK bump landed as ONE atomic deps commit,** not 5 sub-commits. `expo install --fix` resolves the tree atomically; splitting would leave non-installable/tsc-red intermediate commits. *Alt (rejected): 5 commits — breaks green-at-every-commit.*
- **⚑3 — TypeScript bumped to 6.0.3** to match SDK 56's bundled version (`expo install --check` flagged it). Cost only `ignoreDeprecations "6.0"`; no code changes. *Alt (rejected): pin TS 5.8 — leaves toolchain drift.*
- **⚑4 — `types: ["jest","node"]`** to restore jest globals SDK 56's base stopped auto-including. Verified restricting `types` can only surface errors, never hide them (tsc still 0). *Alt (rejected): jest.setup / triple-slash refs — less standard.* **Forward note:** any future `@types/geojson` use must be a module import (`import type … from 'geojson'`), not a global `GeoJSON.*` namespace, or it won't resolve under this `types` array (would be a loud error, not silent).
- **⚑5 — Layer uses modern `paint`/`layout`,** not the deprecated legacy `style` prop (still works in v11, removed in v12). *Alt (rejected): legacy camelCase `style` — buys a future re-migration.*
- **⚑6 — Camera uses direct `bounds`/`center` props,** not `initialViewState`. Preserves v10's reactive re-fit when the path changes (initialViewState is initial-only).
- Reconciled **AGENTS.md (targets 56) vs package.json (was ^53)** by bumping the manifest to 56 — the contradiction the playbook flagged.

## Not done / deferred

- **Live-recording (Record in-progress) + background smoke was NOT driven in-motion.** Starting a recording needs a UI tap, and Simulator computer-use access was **denied** this session; the sim was driven headlessly (deep links + `simctl`, DB-seeded test spot). The Record *pre-start* surface (MapSurface basemap + "GPS READY") is validated on-device, and the live track reuses the exact Map+Camera+GeoJSONSource+Layer paths that ARE validated; background location is `expo-location`/`expo-task-manager`, untouched by this migration. **Low-risk, but not visually confirmed drawing while recording.** Worth a 2-min manual check when Dylan next opens the app (start a kayak recording, walk/simulate a route, confirm the live line draws + survives backgrounding).
- **3D terrain** — out of scope (P4-2, next session).
- **NOT pushed / not merged** — shared-state action, awaiting Dylan.

## Environment gotcha (record this)

**MapLibre v11 adds a Swift Package Manager dependency** — `maplibre-gl-native-distribution` (a prebuilt binary xcframework) fetched from GitHub during xcodebuild's "Resolve Package Graph". v10 was pure CocoaPods. The **first** build's "Planning build" fetches it over the network and can look like a dead hang (no output, no compile activity). Once resolved it's cached and the build flies. **Do not clear DerivedData between build attempts** or it re-resolves from scratch. (Cost ~3 stalled build attempts before diagnosis; `xcodebuild -list` forces the resolve and surfaces the package.)

## Status block

- **Pass:** P4-1 SDK 53→56 + MapLibre v11 · branch `chore/sdk56-maplibre-v11` · head `80ab3bd`
- **Tests:** 1309/1309 jest · tsc 0 · iOS build 0 errors · code-review clean · sim-smoke all static map surfaces ✓
- **⚑ flags:** 6 judgment calls above — all resolved in-session, none blocking; the only one worth a second look is ⚑4's forward note on geojson types.
- **Deferred:** in-motion live-recording smoke (tap-gated, access denied); 3D terrain (P4-2).
- **Safe to leave as-is?** Yes — branch is green and self-consistent; the one open item is the in-motion Record check, which is low-risk. Next action is Dylan's call to push, then P4-2 (3D terrain) can build directly on this.
