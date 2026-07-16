# Forecast — consolidated spec (v1 draft)

*2026-07-15. Companion to `tabs/map-tab.md` (Explore/M5 stays that spec's) and
`research/explore-forecasting-research.md` (the R7 research this spec applies — read that
first; this file is its build-ready distillation, not a restatement). Authority for
per-spot config, the forecast data stack, and the F1–F5 build ladder. Explore (spots/
routes/traces browsing) is NOT this spec — see map-tab.md §2/§7 M5.*

## 1. Purpose & constitution alignment

Forecasting answers "what's it going to do, at the places I care about" — the mirror
pointed forward instead of backward. It stays inside the constitution the same way every
other surface does: **descriptive, never prescriptive.** A forecast is a probability, shown
as a probability, labeled with its model and its age — never smoothed into false
confidence, never a push notification claiming to know your day for you (push stays a
flagged, sparingly-earned exception — §8 E3).

**The spine, per Dylan (2026-07-15): the pinned spot is the unit, not the map.** A spot
already exists as a named place with a sport tag and coordinates (`core/src/spot.ts`).
Forecasting's core move is turning that spot into a **configurable dashboard** — the user
picks what that spot shows: rain/shine for a hike, wind for a kite launch, the full
windgram for a paragliding site, a river gauge for a kayak run. The Forecast **map mode**
(tap-anywhere, color overlay, timeline) is the browse/discovery layer built on the same
data, for "where should I go" rather than "what's my spot doing" — genuinely useful, but
secondary to the spot dashboard.

## 2. Information architecture

### 2a. Spot detail gains a Forecast section (the primary surface, F1)

`app/spot/[id]` already renders live current-conditions (`src/lib/conditions/current.ts`).
This spec extends that screen with a **Forecast card stack**, one card per enabled panel,
above or below the live-conditions card (live = "right now", forecast = "ahead" — kept
visually distinct, never merged into one number).

**Panel types (v1):**
- **Wind** — avg + gust two-number header and two-trace hourly graph, direction spoken
  as *from*. Gust cell color-coded green→amber past a threshold (Windy Bingen screenshot
  convention — the number that picks kite/wing size). **Honesty note: a model forecast
  has no lull** — lull is an *observed* quantity; the community's three-trace
  lull/avg/gust encoding (iKitesurf convention) applies to F2's live-station observed
  readings, and is never fabricated onto model output. Forecast = avg+gust; observed =
  lull/avg/gust.
- **Rain/Shine** — Wunderground convention: **probability AND accumulation together**
  per hour/day ("41% / 0.00 in"), temp + feels-like dual line, a windowed headline
  ("0.6 in in the next 24 h").
- **Meteo (full)** — the windgram/airgram: hours × pressure-level altitude grid, wind
  barbs, lapse-rate shading, boundary-layer-height line, freezing-level line, cloud
  glyphs. This is the wxtofly/Windy-Airgram equivalent, built on Open-Meteo pressure
  levels (research §1, feasibility verified). Reserved for Sky spots and anywhere the
  user explicitly enables it — expensive to render, not a default.
- **Gauge** — the existing river-gauge card, already shipped for `gaugeSiteId` spots;
  this spec adds nothing here except listing it as a config-able panel alongside the
  weather ones.

**Panel config storage — `spot.meta`, no migration.** `Spot.meta?: Record<string,
unknown>` already exists and is the documented home for dimension-specific facts read
through typed helpers returning `undefined` for the unrecorded case (`spotRequiresUshpaMembership`
is the precedent). Add `forecastPanels?: string[]` to `meta`, read through a new
`spotForecastPanels(spot): ForecastPanel[]` helper in `core/src/spot.ts`, alongside the
existing pattern.

**Default panel set — obvious call, derived not asked.** Extend
`core/src/conditions/feedForSport.ts`'s sport→feed mapping into a sport→default-panels
mapping (same file, same activity-id sets it already tracks): wind-family sports
(kitesurf/windsurf/wingfoil/paragliding/hikeAndFly…) default to **Wind**; gauge-family
(kayak/whitewater) default to **Gauge**; swell (surf) defaults to **Wind** (swell forecast
is a post-MVP panel type, not v1 — surf gets wind as the honest interim); everything else
(hike/run/ride/climb/ski, untagged spots) defaults to **Rain/Shine**. **Meteo is never a
default** — it's the expensive, pilot-specific panel a user opts into per spot (a Sky spot
gets a one-tap "add windgram" affordance, not an auto-render). The user can add/remove any
panel regardless of default; the default only decides what an unconfigured spot shows.

### 2b. Forecast map mode — tap ANY point, no save required (F4's core interaction)

A third mode on the Map tab's switcher (`Record | Explore | Forecast` — map-tab.md §2 as
amended by the research doc §2a), sharing chrome with Explore (same header, same
mode-switcher control) but its own layer set and its own bottom timeline scrubber (Windy
convention: one scrubber owns time for every layer on screen).

**The core interaction is ad-hoc, not spot-gated (Dylan, 2026-07-15).** Tapping anywhere
on the map — a saved spot's pin, or empty water/terrain with no spot there at all — opens
the same lightweight **`PointForecastSheet`**: an ephemeral bottom sheet showing Wind +
Rain/Shine for that exact coordinate, fetched on the fly. **Nothing is written or saved.**
This is the Windy pattern exactly: point → instant read, zero commitment. A "Pin this
spot" button sits at the bottom of the sheet as an *optional* upsell — tapping it hands
off to the existing new-spot flow (`new-spot.tsx`, map-tab.md's long-press door) with the
tapped coordinates pre-filled and the panels the user was just looking at seeded into
`forecastPanels`, so saving is a one-tap "keep this" rather than a form to fill out. If the
tapped point IS an existing pinned spot, the sheet instead opens that spot's full
configured dashboard (§2a) — same sheet surface, richer content because there's a saved
config to read.

**Architectural consequence:** the forecast fetch itself takes a bare `{lat, lng}`, not a
`Spot`. `spotForecastPanels(spot)` (§2a) becomes a thin wrapper that resolves *which*
panels to render for a saved spot; the underlying `fetchForecast({lat, lng, panels})` call
is the same one the ad-hoc sheet uses with a fixed default panel set (Wind + Rain/Shine —
no sport tag exists yet to derive a smarter default from, and Meteo/windgram stays too
heavy for a tap-and-glance preview). One fetch path, two entry points.

- **v1 layers:** wind direction/speed as a coarse arrow grid (sampled Open-Meteo points,
  not a smooth raster — honest about the model's real resolution) + **RainViewer radar**
  (observed precipitation, not model paint — the one "ground truth" layer available free).
- **v2 ladder (research §2d, Dylan's E6):** the smooth wind color-field raster and animated
  particle streamlines (Windy's signature look) — real WebGL/custom-layer work, and a
  genuine false-precision risk at spot-zoom if shipped without the resolution honesty this
  app already commits to elsewhere. Ship v1 arrows-plus-radar first; revisit the color
  field as a dedicated design+build pass once the spot dashboard (the actually-decisive
  surface) is live and used.
- Pinned-spot pins render on this mode same as Explore (shared pin layer) — tapping one is
  just the saved-spot branch of the same tap handler described above.

## 3. Data touchpoints

**Two source families, kept separate and never blended (iKitesurf's core lesson):**

| Source | Role | Access |
|---|---|---|
| **Open-Meteo** (already shipped: `src/lib/conditions/openMeteoClient.ts`, `openMeteo.ts`, `skyOpenMeteo.ts`) | Forecast/model backbone — hourly + daily, **pressure-level fields** (wind speed/dir/temp/RH/cloud, `boundary_layer_height`, CAPE, freezing level) for the Meteo panel, multi-model selection (`gfs_seamless`, `ncep_hrrr_conus` for CONUS high-res, `ecmwf_ifs`) | Free, no key, already the app's conditions client — extend from single-point current-conditions to full hourly/daily/pressure-level calls |
| **NOAA — direct, new integration (this spec's "connect to NOAA" answer)** | **Live observations**, for the cross-check-against-model pattern; never blended into the model line, always shown separately with a visible reading age | **NWS API** (`api.weather.gov`, free, no key) — nearest-station current obs + `snowfallAmount` gridpoints; **Synoptic/MesoWest** (free tier, 5k req/mo) — broader station aggregation (ASOS/RAWS/road-weather) for a "closest live reading" when NWS's own stations are sparse (exactly the Gorge gap the iKitesurf research flagged — free stations get you the airport/highway, never the launch) |
| **RainViewer** | Radar tiles (past 2h + short nowcast) for the map mode | Free, no key, attribution required, personal-scale terms |
| ~~Windy~~ | Reference only | **Not a data source** — API terms forbid weather-app use without a €990/yr Professional license and never include ECMWF; link out to windy.com, never embed (research §1) |
| ~~WeatherFlow/iKitesurf~~ | Reference only | **Not licensable** — Tempest API is personal-use-only; the Gorge launch-side sensors stay a named honest gap, not silently faked via NOAA-substitution |

**Note on "already NOAA" vs "new NOAA":** `ncep_hrrr_conus` and `gfs_seamless` via
Open-Meteo *are* NOAA model output — no new integration needed for forecast/model data.
The new direct connection this spec adds is **observations**, which Open-Meteo doesn't
serve at all (it's forecast-only).

**No migration for any of this pass** — `spot.meta.forecastPanels` (§2a) is the only new
persisted field, and it rides the existing JSON column.

## 4. Components & states

| Component | Notes |
|---|---|
| `ForecastPanelCard` (Wind) | Header avg+gust + direction; hourly 2-trace model graph (lull/avg/gust 3-trace is F2's observed data only — §2a honesty note); gust-cell color threshold |
| `ForecastPanelCard` (Rain/Shine) | Daily cards (prob % + accumulation) + hourly dual temp/feels-like line + windowed headline |
| `WindgramChart` (Meteo) | Time × pressure-level grid, wind barbs, lapse-rate shading, BL-height + freezing-level lines; model/resolution/run stamped on the chart, always |
| `ForecastPanelPicker` | Spot-detail affordance to add/remove panels — reuses the app's existing chip/checklist pattern, writes `spot.meta.forecastPanels` |
| `PointForecastSheet` | Ephemeral, no Spot required — takes bare `{lat, lng}`, renders Wind + Rain/Shine panels (reusing the same `ForecastPanelCard` sub-renderers as the spot dashboard) in a lightweight bottom sheet; "Pin this spot" CTA hands off to `new-spot.tsx` with panels + coords pre-seeded. Nothing persisted unless that CTA is tapped. |
| Map mode: `WindArrowLayer` | Coarse sampled-grid MapLibre symbol layer |
| Map mode: `RadarTileLayer` | RainViewer raster tile source |
| Map mode: timeline scrubber | Shared with Explore's existing bottom-chrome slot pattern if any; otherwise new, Windy-convention bottom bar |

**Empty/honest states:** a spot with zero forecast panels shows nothing extra (absent, not
empty — matches map-tab.md's own convention); a panel whose model call fails shows a quiet
"forecast unavailable" exactly like the existing live-conditions failure fold (never a
fabricated number); anything beyond ~72h visually fades per the skill-honesty convention
research flagged (Windy's own users treat day 9 like day 1 — we don't).

## 5. Interactions & cross-tab flows

- **Spot detail is the entry point** for 90% of use (§2a) — no map interaction required to
  see a spot's forecast.
- **Map Forecast mode → tap a spot pin → same dashboard**, not a separate "map forecast"
  data model. One source of truth per spot.
- **"Days like this" (research §2d F5, later pass, not this spec's scope)**: forecast day →
  match against the conditions already frozen on saved sessions (Water-build
  similar-conditions query, generalized) → "you've flown here on N days like this." Named
  here so the panel architecture doesn't foreclose it — the forecast panels and the
  frozen-conditions store already share the same Open-Meteo field shapes.

## 6. Build passes (ordered; each independently shippable)

1. **F1 (M) — Spot Forecast dashboard.** Extend `openMeteoClient.ts` to hourly/daily
   forecast (currently current-conditions only, per code read 2026-07-15) + the two
   simple panel types (Wind, Rain/Shine). `spot.meta.forecastPanels` + `spotForecastPanels()`
   helper + sport-derived defaults extending `feedForSport.ts`. `ForecastPanelPicker` UI on
   spot detail. **No map work, no migration** — independent of Explore/M5 entirely.
   Highest daily-use-per-effort item on this whole page (Dylan's own framing).
2. **F2 (M) — Direct NOAA observations.** NWS API + Synoptic client (mirrors the shape of
   the existing `usgsClient.ts`), surfaced as a small "live reading (age)" line beside the
   matching forecast panel when a nearby free station exists — never blended into the
   model line.
3. **F3 (L) — Windgram/Meteo panel.** Pressure-level Open-Meteo calls, `WindgramChart`,
   model selection (HRRR inside CONUS, GFS/ECMWF fallback), the honest-gap labeling
   (model + resolution + run time on every chart). Gated on F1's panel architecture.
4. **F4 (M) — Forecast map mode v1.** Third Map-tab mode, wind-arrow grid + RainViewer
   radar + the ad-hoc `PointForecastSheet` tap interaction (§2b — no spot required).
   **Depends only on the mode-switcher control existing, not on M5's full spot/route/
   trace layer buildout** — the switcher itself is a small shared `SegmentedControl`
   amendment (map-tab.md §2), so F4 can land it standalone if M5 hasn't shipped yet
   rather than waiting on Explore's whole scope. Sequence relative to M5 is a scheduling
   choice, not a hard dependency.
5. **F5 (ladder, not scoped here) — wind color-field/particle animation (v2, §2b);
   "days like this" (§5); swell panel type; Smart-Forecast-style good-window highlighting;
   model-compare rows.**

Recommended order: **F1 → F2 → F3 → F4.** F1–F3 need zero map work at all; F4 needs only
the small mode-switcher control, not Explore's full layer set — it can land before, after,
or alongside M5.

## 7. Dependencies

- **Spot primitive** (`core/src/spot.ts`, shipped) — `meta` is the only touchpoint.
- **`feedForSport.ts`** (shipped) — extended, not replaced, for default panels.
- **Open-Meteo clients** (shipped, extended for hourly/daily/pressure-level).
- **map-tab.md** — F4 depends on the `Record|Explore|Forecast` switcher amendment;
  everything else in this spec is independent of Map-tab work.
- **Conditions freeze store** (`conditions_snapshots`, Water-build) — F5's eventual
  "days like this" reads it; nothing here writes to it (forecast panels are display-only,
  same non-mutating rule as `current.ts`).

## 8. 🟥 Flagged concerns (for Dylan)

- **E3 — wind/rain threshold alerts: CONFIRMED DEFERRED, not decided.** Dylan, 2026-07-15:
  "no notifications yet." iKitesurf's most-loved feature ("alert me when Event Site hits
  18+ from the west") is a push notification — same constitutional bar as gear-reminder
  R6. **None of F1–F4 build or depend on it.** The constitutional ruling (may this ever
  notify, and under what earned-sparingly bar) stays open for whenever it's actually
  proposed — not blocking, not scheduled.
- **E1 (carried) — Map tab landing mode** once Explore/Forecast both exist. Affects
  map-tab.md more than this spec, noted for consistency.
- **New — meteo-panel cost.** The windgram (F3) is a heavier render (pressure-level calls,
  a denser chart) than the other panels. Confirm "opt-in per spot, never a default" (§2a)
  is the right cost/value line, or whether Sky spots specifically should default it on.

## 9. Open questions

1. Panel picker UI shape — inline chips on spot detail vs. a dedicated "Configure
   forecast" sub-screen (matters more once 4 panel types exist than at F1's 2).
2. Whether the Rain/Shine panel's windowed-headline convention ("0.6 in next 24h") should
   also appear as a glance line on the spot list, not just spot detail — a Home-tab-style
   surfacing question, deferred to whoever specs that touchpoint.
3. Swell panel type (surf) — real work (wave height/period/direction, a different data
   shape than wind) — parked as a named gap, not designed here.
