# Dimension: Water — Session Orientation

> Water = the medium moves, not just you. Current, swell, wind — the conditions ARE the session's meaning.
> Water sports are the purest conditions-freeze dimension.

**Worktree:** `~/Projects/health-coach-water` (branch `dimension/water`)
**Branched from:** main @ `e68e473` (2026-07-05)

## Sports in this dimension (3)

| Sport | Surface today | Build status | Capture model | Conditions freeze |
|-------|--------------|-------------|---------------|-------------------|
| Swimming | Bespoke | **Live** | Pool laps | None |
| White Water Kayaking | Bespoke | Planned | GPS envelope | River CFS |
| Wind (wing/kite) | Bespoke | Planned | GPS envelope | Wind aloft |

## Canonical spec source

The **Notion "New Training Database"** is the most up-to-date spec. Read the Notion pages fresh at session start — they're ahead of any planning/ docs in the repo.

## What's already built (code on main)

### Swimming surface (Live)
- `SwimmingBlock[]` on `SessionPayload` — pool distance = laps × length (fidelity 0.85) vs open-water estimate (0.5). Contributes energy-system minutes to the ledger.
- Activity: `swim` → swimming surface.
- **Missing vs Notion spec:** HealthKit per-lap ingestion (stroke style, SWOLF, stroke count), set structure by rest-gap clustering, drill/kick tagging, lap editing, pace/100 trends.

### GPS spine (shared, available for Whitewater + Wind)
- Native GPS capture, MapLibre RouteMap, elevation profile, splits, GPX import — all built. See Earth orientation doc for details.
- `EnduranceBlock.gpsPath?: GeoPoint[]` — all GPS sports share this.
- Activities registered: kayak, whitewater, sup, canoe, sail, windsurf, kitesurf, paddle, surf, wingfoil → all route to GPS surface.

### NOT built
- **HealthKit swim ingestion** — per-lap events, `SwimmingStrokeStyle`, SWOLF (watchOS 9+), pool-vs-open-water, `HKWorkoutActivity` intervals. Stub exists.
- **FIT file parser** — needed for Garmin swim per-length data.
- **Conditions freeze adapters** — USGS waterdata OGC API (whitewater), Open-Meteo wind (wind sports). All specced, none built.
- **Gear/quiver entity** — boats (whitewater), kites/wings by size, boards by volume, foils by area.
- **Spot/place primitive** — blessed concept (id + name + lat/lng + condition sources). Four Water sports want it.

## Per-sport detail

### Swimming (Live — needs HealthKit ingestion layer)
- **HealthKit is THE universal bus** — per-lap events + `SwimmingStrokeStyle`, stroke count, SWOLF (watchOS 9+), pool-vs-open-water + lap length, `HKWorkoutActivity` per-interval stats. Apple Watch + FORM + Garmin all arrive through it.
- **Auto ingest, manual annotation** — swimmers want ZERO manual capture. The manual layer is drill/kick tagging + lap editing where watches fail.
- **Set structure** — derive sets by rest-gap clustering from per-length rows.
- **Manual pool logging** — set-based logger reskinned: distance × reps @ stroke @ interval (e.g. 10×100 free on 1:40).
- **Analytics:** SWOLF trends, pace/100 by stroke, stroke-count creep as fatigue signal, CSS tracking.
- **Open water** = GPS surface from HealthKit `.swimming` + `HKWorkoutRoute`.

### White Water Kayaking (conditions-freeze IS the log)
- **The purest conditions-freeze sport** — "I've run the Gauley" is meaningless without "at 2,800 cfs."
- **USGS waterdata OGC API** (free, no key): discharge cfs (00060) + gage height (00065). **Legacy API dies Q1 2027** — build against `api.waterdata.usgs.gov` OGC API NOW, behind an adapter.
- **American Whitewater unofficial JSON** — append `.json` to routes for reach beta, class, runnable ranges. Unstable — cache aggressively.
- **Bespoke fields:** river + section, gauge site ID + reading + unit + timestamp (IMMUTABLE snapshot at save; user picks home gauge per river once), section class (I-V+), boat from quiver, optional water temp / hazards / swim-roll count.
- **Manual gauge entry fallback** — covers ungauged creeks day one.
- **HealthKit** `.paddleSports` + `HKWorkoutRoute` for GPS.
- **Open-Meteo** `precipitation_sum&past_days=3` for rain-driven-level context.
- **Progression milestones:** first III/IV/V, days-on-water. Class V consensus = 3-5 yrs of 50+ days/yr.
- **Private-first logs** — hazard reporting carries liability weight.
- Defer: rapid-by-rapid mapping, AW database mirroring, international gauges, community hazard sharing.

### Wind — wing/kite (biggest net-new sport, no logbook benchmark to copy)
- **The conditions-freeze + quiver combo IS the category-defining feature.** Nobody serves "what did I ride last time in these conditions?"
- **Open-Meteo** — `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, current + historical (backdated logs!) — free, keyless, global → the conditions freeze.
- **Bespoke fields:** spot picker (lat/lng), sport sub-type (kite/wing/windsurf/parawing), kite-or-wing size + board/foil from quiver, subjective note.
- **Quiver is central** — kites/wings by size, boards by volume, foils by area. Riders build personal lookup tables ("18kt SW at spot X = 9m + 95L board") in spreadsheets TODAY.
- **Future split point:** kite/wing/windsurf/parawing may each split into separate top-level sports eventually — the sub-sport discriminator is the designed split point (registry entries + bespoke fields per sub-sport), but this build pass keeps ONE Wind surface since the conditions freeze + kit model are identical across all four.
- **Session style (downwind vs. back-and-forth):** riders either do downwind runs/laps (start spot ≠ end spot, shuttle logistics) or ride back-and-forth at one launch. Needs a session-style field on the Wind log. A downwinder wants launch + landing spots (or a named run), not a single spot ref — and GPS interpretation differs too (one-way distance vs. out-and-back).
- **HealthKit:** no kitesurf type — ingest `.sailing` / `.surfingSports` (catches Watch, Garmin, Surfr/Hoolan sessions).
- **WeatherFlow Tempest** — free personal-station token; network-wide is enterprise-gated. Later premium upgrade.
- Defer: jump detection (WOO/Surfr own it; hard with phone-in-drybag), speed-run analytics, tack/jibe segmentation, leaderboards.

## Cross-cutting primitives (shared across Water)
1. **Conditions freeze** — the dimension's defining feature. USGS gauge snapshot (whitewater), Open-Meteo wind snapshot (wind), none for pool swimming. Immutable at save time.
2. **Spot/place primitive** — id + name + lat/lng + condition sources. Used by Whitewater (river + section + gauge) and Wind (launch site + wind direction context).
3. **Gear/quiver entity** — boats (whitewater), kites/wings/boards/foils (wind). Same entity as running shoes / bikes / skis — one type, many sports.
4. **HealthKit paddle/sail ingestion** — `.paddleSports`, `.sailing`, `.surfingSports` + `HKWorkoutRoute`.
5. **GPS route display** — shared MapLibre RouteMap for whitewater runs + wind sessions.

## Direction from Dylan (2026-07-05)
- **Focus on tech integrations and API connections**, not visual UI. Dylan is mid-redesign with a new brand kit.
- **New nav:** 5 bottom tabs — Home, Training, Map, Nutrition, Groups.
- **Fidelity is food-specific.** Don't apply to training.
- **Most Water sports will have a map+logging view** — seeing your track live. Bespoke = the recap/detail (gauge snapshot, quiver selection, conditions).
- **USGS API migration is time-sensitive** — legacy dies Q1 2027. Build the adapter early.
- **Constitution:** descriptive by default, prescriptive only on request. No gamification. Private-first for backcountry/whitewater.
