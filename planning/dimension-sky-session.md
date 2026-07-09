# Dimension: Sky — Session Orientation

> Sky = Air. The only dimension where HealthKit is NOT the ingest path.
> One sport. The deepest bespoke build in the database.

**Worktree:** `~/Projects/health-coach-sky` (branch `dimension/sky`)
**Branched from:** main @ `e68e473` (2026-07-05)

## Sports in this dimension (1)

| Sport | Surface today | Build status | Capture model | Conditions freeze |
|-------|--------------|-------------|---------------|-------------------|
| Paragliding | Bespoke | Planned | Flight-track | Wind aloft |

## Canonical spec source

The **Notion "New Training Database"** Paragliding page is the most up-to-date spec. Read it fresh at session start.

## What's already built (code on main)

### Activity registry
- `paraglide` registered in `src/lib/activity.ts` → routes to GPS surface currently.
- But Paragliding should NOT use the standard GPS surface — it needs its own flight-track surface with IGC ingest, not HealthKit.

### GPS spine (partially reusable)
- MapLibre RouteMap, elevation profile, splits — all built. The map display layer IS reusable for showing a flight track.
- `GeoPoint[]` data model works for IGC B-records (lat/lng/tsSec/eleM maps directly).
- GPX import exists but IGC is the real format here.

### NOT built (everything bespoke)
- **IGC file parser** — FAI standard (1995→), plaintext B-records (UTC + lat/lon + pressure & GNSS alt). Pure JS, trivial to write. THE ingest path.
- **Flight-track surface** — per-flight: site (name+coords), wing (running hours), harness/reserve (repack date), airtime, max altitude, max climb rate (derived from B-record deltas), XC distance.
- **Auto takeoff/landing detection** — from groundspeed + altitude thresholds in the B-record. Easy win.
- **Wind-aloft freeze** — Open-Meteo pressure-level API (850/700hPa ≈ 1,500/3,000m wind). Free, keyless.
- **USHPA-style hours/flights/days ledger** — P3 requires 30 flying days / 90 flights / 20 hrs solo; P4 more; some instructors require ≥3 sites. This is a genuinely new benchmark family: count-based compliance, not performance.
- **Gear hours per wing** — porosity/trim checks are hours-based. Reserve repack date reminders.
- **WeGlide integration** — public READ (60 req/day) but upload is trusted-partners-only.
- **Conditions freeze adapters** — Open-Meteo 850hPa wind aloft + surface conditions.

## Paragliding — full build spec from Notion

### Peak apps
- **XCTrack** (Android, free) — de-facto in-flight standard, one-tap XContest upload
- **Flyskyhy** (iOS, $8.99) — actively maintained, Watch companion
- **SeeYou Navigator** (~€59/yr) — thermal assistant, cloud logbook
- **Gaggle** (free tier, 3D IGC replay paid)
- **Burnair** (Alps planning)

### The whitespace
Pilots run a parallel stack: XContest for scoring, a logbook app for hours/gear, Strava for social. **A HealthKit-adjacent tracker treating a flight as a first-class session with conditions** — this doesn't exist on iOS.

### Integrations / APIs
- **IGC file = THE standard** (FAI, 1995→): plaintext B-records, pure-JS parser is trivial → ingest via Files/email import
- **XContest:** NO public API
- **WeGlide:** public READ (60 req/day) but upload is trusted-partners-only OAuth
- **Wind aloft:** Open-Meteo pressure-level API (850/700hPa) — free, keyless → conditions freeze
- **LiveTrack24** has a documented API; PureTrack.io aggregates — defer

### What users want (paraglidingforum, USHPA)
- **Compliance-driven logging** — USHPA P3/P4 certification requires specific counts. Pilots keep Google Sheets for this TODAY.
- **Gear hours per wing** (porosity/trim checks are hours-based) + reserve repack date reminders
- **Conditions journaling** (why the day worked)
- **Altitude PBs**
- **Per-site logs** (some instructors require ≥3 sites)

### Build path
1. IGC import + parse → per-flight record
2. Per-flight: site (name+coords), wing (running hours from quiver), harness/reserve (repack date), airtime, max altitude, max climb (derived from B-record deltas), distance
3. Auto takeoff/landing from groundspeed + altitude thresholds
4. Launch-time freeze: Open-Meteo surface + 850hPa wind
5. **USHPA-style hours/flights/days ledger** — the compliance benchmark family

### Defer
- 3D replay (WebGL-heavy)
- Thermal/circling detection
- XContest/WeGlide submission
- Live tracking

## Cross-cutting primitives
1. **Gear/quiver entity** — wings with running hours, harness/reserve with repack dates. Same entity type as shoes/bikes/skis/boats.
2. **Conditions freeze** — Open-Meteo wind aloft (850/700hPa). Same adapter pattern as SNOTEL (skiing) and USGS (whitewater).
3. **Spot/place primitive** — launch sites with coords. Same entity as whitewater put-ins and wind launch spots.
4. **IGC file parser** — unique to Sky. Trivial (plaintext B-records).
5. **Compliance benchmark family** — count-based (flights, days, hours, sites). New benchmark shape, reusable for any count-compliance sport.

## Notes on scope
- This is the **only sport in the DB where HealthKit is NOT the ingest path** — IGC files are.
- The certification ledger (USHPA P3/P4 hours/flights/days/sites) is a genuinely new benchmark family.
- Despite being only 1 sport, this is one of the deeper bespoke builds because nothing from the existing surfaces transfers except the map display.
- The IGC B-record format maps cleanly to `GeoPoint[]` (lat/lng in degrees, timestamps, pressure+GNSS altitude). The parser is trivial — the value is what we do with the parsed data.

## Direction from Dylan (2026-07-05)
- **Focus on tech integrations and API connections**, not visual UI. Dylan is mid-redesign.
- **New nav:** 5 bottom tabs — Home, Training, Map, Nutrition, Groups.
- **Fidelity is food-specific.** Don't apply to training.
- **Map view is central** — flight tracks on the map ARE the product for paragliding.
- **Constitution:** descriptive by default, prescriptive only on request. No gamification. Flag-once-then-override.
