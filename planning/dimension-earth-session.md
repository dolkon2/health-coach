# Dimension: Earth — Session Orientation

> Earth/Sky/Water are domains you move *through*; Body is the instrument.
> Earth = rock, trail, snow, dirt. The terrain IS the session.

**Worktree:** `~/Projects/health-coach-earth` (branch `dimension/earth`)
**Branched from:** main @ `e68e473` (2026-07-05)

## Sports in this dimension (7)

| Sport | Surface today | Build status | Capture model | Conditions freeze |
|-------|--------------|-------------|---------------|-------------------|
| Climbing | Bespoke | Partial | Session | None |
| Running | Shared (GPS) | Partial | GPS envelope | Elevation/weather |
| Cycling/Biking | Shared (GPS) | Partial | GPS envelope | Elevation/weather |
| Hiking | Shared (GPS) | Partial | GPS envelope | Elevation/weather |
| Mountain Biking | Shared (GPS) | Partial | GPS envelope | Elevation/weather |
| Trail Running | Shared (GPS) | Partial | GPS envelope | Elevation/weather |
| Skiing | Bespoke | Planned | GPS envelope | Snow/SNOTEL |

## Canonical spec source

The **Notion "New Training Database"** is the most up-to-date spec. Each sport page contains: tagline, peak apps + pricing, Strava gap, integrations/APIs (with dead ones flagged), community-sourced user wants, concrete build path, and notes. Read the Notion pages fresh at session start — they are ahead of any planning/ docs in the repo.

## What's already built (code on main)

### GPS spine (shared by 6 of 7 Earth sports)
- **Native GPS capture:** `src/hooks/useGpsTracker.ts` — foreground-only, records `GeoPoint[]` {lat, lng, tsSec, eleM?}. Fidelity 0.7 (phone trace). No background tracking yet.
- **MapLibre:** `src/components/RouteMap.tsx` — v10.4.2 (pinned; v11 breaks SDK 53). MapTiler outdoor tiles. GeoJSON LineString from GeoPoint[]. Lazy-loaded. Verified on sim with real tiles.
- **Elevation profile:** `src/lib/elevationProfile.ts` → `src/components/ElevationProfile.tsx` — SVG area chart, gain+min/max.
- **Splits:** `src/lib/splits.ts` → `src/components/Splits.tsx` — per-km/mi rhythm bars. Pace interpolated at unit boundaries.
- **GPX import:** `src/lib/gpxImport.ts` — `fast-xml-parser`, prefers tracks, computes distance/elevation/duration. File picker in `app/log-session.tsx`.
- **Data model:** `EnduranceBlock.gpsPath?: GeoPoint[]` in `core/src/observation.ts`. All GPS sports share this — no per-sport branching yet.

### Activity registry
- `src/lib/activity.ts` — 37 activities already registered. Earth sports mapped: gym→gym surface, run/ride/hike/trail-run/mtb/ski→gps surface, climb→climbing surface.
- Adding a new activity = one line in the ACTIVITIES array (identity layer), no code change.

### Climbing surface
- `ClimbingData` on `SessionPayload` — session-level only (level 1 of the granularity ladder). No sends summary, no per-climb/attempt logging, no grades.

### NOT built (specced or researched only)
- **Layer 2 track normalization** — outlier rejection, elevation source tiering (`eleSource: 'barometric'|'gps'|'dem'|'none'`), RDP simplification. Specced in `mapping-architecture-spec.md` Layer 2.
- **Layer 5 sport overlays** — avalanche.org GeoJSON (skiing), DEM slope angle, OSM trail network.
- **Layer 6 sport algorithms** — run/lift detection (skiing), climb/descent segmentation (MTB), thermal detection.
- **FIT file parser** — not installed. Needed for Garmin running dynamics, MTB Grit/Flow/jumps, swim per-length.
- **HealthKit route ingestion** — stub at `src/lib/healthkit/reader.ts` (`notImplemented('Phase 3 Pass 3')`).
- **Conditions freeze adapters** — Open-Meteo (weather), SNOTEL (snow), USGS (elevation). All specced, none built.
- **Route as entity** — `gps-mapping-spec.md` defers this to Phase 6.
- **Gear/quiver entity** — shoes (running), bikes+components (cycling/MTB), skis (skiing). Same entity across all. Not built.

## Per-sport bespoke primitives needed

### Climbing (biggest unlock — decision needed)
- **Granularity ladder:** session → sends-summary chips ("3×V4, 1×V5") → per-climb/attempt for projects
- **OpenBeta CC0** routes + `@openbeta/sandbag` npm (grade conversion, works in RN)
- **8a.nu CSV + BoardLib CSV** imports — two parsers cover most power users
- **Hangboard** reuses the gym set logger (edge mm / added kg / hang s / rest)
- Decision: bless all 3 levels of the ladder, or session-only?

### Running
- **Shoe mileage** via gear/quiver entity (shared with hiking boots, cycling components, ski quiver)
- **GAP** (Grade Adjusted Pace) in splits — needs elevation per split point
- **Post-run page** in the Strava shape: map / stats / splits / charts / honest load
- **Strong CSV import** analog: Garmin FIT parse for running dynamics

### Cycling/Biking
- **Power metrics** — HealthKit iOS 17 `cyclingPower`/`cyclingCadence`/`cyclingSpeed`
- **NP** (Normalized Power) labeled "estimated" when derived — constitution fit
- **Bike + component mileage** with wear thresholds (chain, tires, etc.) — quiver entity
- **Indoor flag** — separate Zwift rides from outdoor

### Hiking
- **Pack weight** — nobody tracks this alongside effort; ~1 kcal/kg is defensible
- **Trail name** (free text) + one-tap conditions note (mud/snow/heat)
- **Boot mileage** — quiver entity reuse
- **Elevation source labeling** — barometric vs GPS-recomputed, "say which source" per Notion spec

### Mountain Biking
- **Descent segmentation** — climb/descent coloring on elevation profile, computed from route
- **Descent stat block** — descent count/laps (route clustering + elevation reversal), vertical descended, max/avg descent speed, lift detection
- **Suspension service intervals** — per-bike hours/distance vs user-set intervals (quiver entity)
- **Garmin FIT Grit/Flow/jumps** — developer fields HealthKit drops

### Trail Running
- Shares the Running GPS surface entirely. The distinction is terrain/community, not metrics.
- Elevation/vert emphasis over pace. No new code needed beyond what Running builds.

### Skiing
- **HealthKit `.downhillSkiing`** with NATIVE per-run workout segments — runs + vert come free. Do NOT build run/lift detection (Apple Watch does it).
- **SNOTEL REST** (900+ stations, SWE/depth/new snow) + `avalanche.org` GeoJSON danger ratings + Open-Meteo snowfall → conditions freeze
- **Quiver** — which ski per day, per-ski day counts
- **Resort vs backcountry flag** — backcountry = private by default
- **Snow-conditions picker** (powder/groomer/ice/crud) + subjective quality

## Cross-cutting primitives (shared across Earth)
1. **Gear/quiver entity** — shoes, bikes+components, skis, boats. Hours/distance → service thresholds. One entity, many sports.
2. **Conditions freeze** — Open-Meteo weather (all), SNOTEL snow (ski), elevation DEM correction.
3. **Elevation source labeling** — `eleSource` on GeoPoint (barometric > GPS > DEM > none).
4. **HealthKit route ingestion** — `HKWorkoutRoute` covers run/ride/hike/ski/swim out of the box.
5. **FIT file parser** — Garmin running dynamics, MTB Grit/Flow, swim per-length.

## Direction from Dylan (2026-07-05)
- **Focus on tech integrations and API connections**, not visual UI. Dylan is mid-redesign with a new brand kit (Columbia River Gorge palette + new typography). Mockups are ahead of code.
- **New nav:** 5 bottom tabs — Home, Training, Map, Nutrition, Groups. Reflect/Settings/Benchmarks/Templates are tap-in surfaces.
- **Fidelity is food-specific.** Training sessions don't carry fidelity — if you showed up, it's a fact. Don't apply the nutrition fidelity system to training.
- **Most sports will have a map+logging view** — seeing your track live while logging. Bespoke = often the recap/detail view, not the capture flow.
- **Constitution:** descriptive by default, prescriptive only on request. No gamification. No streaks. Flag-once-then-override.
