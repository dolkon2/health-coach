# Handoff → P4-2: 3D terrain map

**Written:** 2026-07-13, at the close of P4-1 (SDK 56 + MapLibre v11).
**Base:** P4-1 is **merged + pushed to `main`** — `origin/main == 6ec347e` (2026-07-13). Branch P4-2 straight off `main`. (The merge-vs-stack red box below is resolved — merged.)

## Model + how to run

- **Opus 4.8** (`/model claude-opus-4-8`). This is design-and-native work on a fresh v11 API — present-for, not overnight-on-Fable.
- **Start in plan mode.**
- 🟥 **RED BOX — where does P4-2 branch from?** P4-1 lives on `chore/sdk56-maplibre-v11`, unmerged. 3D terrain *requires* MapLibre v11, so it must sit on top of P4-1. Two options — **Dylan picks before you start:** (a) merge/push P4-1 to `main` first, then branch P4-2 off `main` (clean, but commits the upgrade); or (b) branch P4-2 directly off `chore/sdk56-maplibre-v11` and keep both stacked until Dylan reviews together. Do not merge P4-1 yourself without the call.

## What P4-1 already gives you (don't redo)

- MapLibre is on **v11.3.6**, New Architecture, RN 0.85 / React 19.2 / Hermes v1. iOS dev-client builds clean.
- Every map surface is on the v11 API, behind the shared lazy loader `src/components/mapLibre.ts` (a hand-written `MapLibreModule` type adapter) + the `RouteMap` / `MapSurface` wrappers. The 4 consumer screens never touch the package.
- The on-brand MapTiler style renders; the honest fallbacks (`RoutePreview` SVG trace, `MapUnavailable` placeholder) are intact. **Keep all three.**

## The 3D-terrain surface (what to build)

v11 exports the terrain primitives P4-1 didn't need yet — you'll wire these:
- **`RasterDEMSource`** — the elevation tile source (terrain-RGB). MapTiler serves a terrain-RGB tileset; confirm the URL/key against the current `mapStyleUrl()` setup in `src/lib/config.ts`.
- **Style-spec `TerrainSpecification` + `SkySpecification`** (both exported from the package) — the `terrain` (exaggeration + DEM source ref) and `sky` blocks. Likely set via the `mapStyle` JSON or a v11 terrain prop — check the v11 `Map`/style docs for how RN v11 wants terrain enabled (style-embedded vs. a component/prop).
- **`Camera` `pitch` + `bearing`** — needed to actually *see* the 3D. ⚠️ The P4-1 adapter (`mapLibre.ts`) only declares the slim set we used (`center/zoom/bounds/padding/duration`). **Add `pitch?` and `bearing?` to the `Camera` type in the adapter** — they exist on the real v11 `CameraProps` (via `CameraOptions`), just not yet mirrored.
- Optional depth: **hillshade** (`<Layer type="hillshade">`) and/or **`fill-extrusion`** for extruded features, both already in v11's unified `Layer`.

## Guardrails

- **Single-concern commits. Flag (⚑) ambiguity, don't reinterpret.**
- Preserve the fallbacks and the tiny-route centering branch in `RouteMap`.
- **Finish sequence:** full `jest` → `tsc` LAST → `/code-review` → sim smoke (terrain renders with pitch; route polyline still draws *over* terrain; fallbacks still honest) → `status-sync` + `dev-log-closeout`.
- **Do not push without asking Dylan.**

## Build gotcha inherited from P4-1 (read this before you build)

MapLibre v11 pulls a **Swift Package Manager** binary — `maplibre-gl-native-distribution` — from GitHub during xcodebuild's "Resolve Package Graph". The **first** build's "Planning build" fetches it and can look like a dead hang (no output, no compile activity for minutes). It's the network fetch, not a stall. **Do not clear DerivedData between build attempts** or it re-resolves from scratch. `xcodebuild -workspace ios/*.xcworkspace -list` forces the resolve and confirms the package cached. Pod/prebuild commands need `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` (CocoaPods UTF-8 requirement).

## Open thread from P4-1

- The **in-motion live-recording smoke** (Record in progress + backgrounding, live line drawing) was not driven in P4-1 — starting a recording needs a UI tap and Simulator computer-use was denied that session. Low-risk (reuses validated map paths), but worth a 2-minute manual check while you have the app open for terrain testing.

---

### Copy-paste kickoff prompt

> Start in plan mode. Read `dev-log/rework-phase4-03-sdk56-maplibre-v11.md` and `dev-log/rework-phase4-04-handoff-3d-terrain.md`, then `planning/rework/phase4-session-playbook.md` (the P4-2 session), `planning/rework/research/routes-implementation.md`, `planning/rework/tabs/map-tab.md`, `src/components/mapLibre.ts`, `src/components/MapSurface.tsx`, `src/components/RouteMap.tsx`, and `src/lib/config.ts`.
>
> This branch (`chore/sdk56-maplibre-v11`) already has MapLibre v11 + the New-Arch flip. Build **3D terrain** on the on-brand MapTiler style: a terrain-RGB `RasterDEMSource`, the style-spec `terrain` + `sky` blocks, and `Camera` `pitch`/`bearing` (add those two to the `mapLibre.ts` adapter type). Add hillshade if it reads well. Keep the polyline drawing over terrain, keep the honest fallbacks, keep the tiny-route branch. Single-concern commits; flag (⚑) anything ambiguous. **First: ask me whether to merge P4-1 to main or stack P4-2 on this branch.** Finish with full jest, tsc LAST, /code-review, sim smoke (terrain + pitch + polyline-over-terrain + fallbacks), then status-sync + dev-log-closeout. Do not push without asking me.
