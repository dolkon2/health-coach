# Forecast F3 — Windgram / Meteo panel

**Session:** 2026-07-16 · branch `main` · commits `b5a20f5` → `a612650` (5 feature + 4 review-fix)
**Verification:** 153 suites / 1566 tests green · `npx tsc --noEmit` clean · `/code-review` high effort (33 candidates across 8 angles, 10 findings survived, 8 fixed this session, 2 deferred as cleanup) · sim smoke test PASSED (screenshots below)

## What was built

The Meteo panel — the wxtofly-style windgram — is real. Any spot that opts in (the Meteo chip in the existing Configure picker) gets a daylight-hours × altitude chart built honestly from Open-Meteo pressure-level data:

- **Data:** new pressure-level fetch (`src/lib/conditions/openMeteoWindgram.ts` + pure parser/physics in `core/src/conditions/windgram.ts`). Nine levels 1000→600 hPa (Open-Meteo has no 650), six variables per level plus BL height, CAPE, freezing level, surface wind, daily sunrise/sunset. Inside CONUS one call requests **HRRR 3 km + GFS together**; each hour is attributed to exactly one model (HRRR only when it carries a full height column — never mixed within an hour). Outside CONUS, GFS only. Verified against live API responses; trimmed real fixtures checked in.
- **Chart:** `WindgramChart` in react-native-svg, house pattern (exported pure geometry builders, fixed y-axis + horizontal scroll strip, one strip with day separators). Wind arrows per level, weight-stepped at 8/13/21 kt with the top step tinted rust; lapse-rate shading between adjacent levels in four buckets; solid BL-top line; dashed freezing line; per-level cloud slivers; grid-elevation floor with underground levels clipped, never faked.
- **Honesty stamps:** model + resolution + run time on every render (`HRRR 3 km + GFS · run Jul 16 22Z · fetched …`); run time from HRRR's static meta endpoint, "run n/a" when unknown; HRRR→GFS downgrade boundary drawn as a dashed rule with a `GFS →` label at the parser's horizon; the card captions that altitudes are vs. the model's **grid elevation, not the launch**. No thermal W\*, no derived soaring numbers — CAPE is shown only as the raw API value (absence over invention).
- **Wiring:** `'meteo'` joined `RENDERABLE_FORECAST_PANELS`; the spot screen fetches the windgram only when the spot opted in and has coords, on its own seq-ticketed state machine (loading = card absent; failed = quiet unavailable; every enable fetches fresh; racing writes discarded). No migration; config rides `spot.meta.forecastPanels` as before.

## Decisions resolved this session (Dylan, in-chat)

1. **"E7" / windgram default → OPT-IN EVERYWHERE.** The spec's "Meteo is never a default" line stands; no `defaultForecastPanels` change. Note: there is no flag literally named E7 in the repo — this resolves the unnumbered **"New — meteo-panel cost"** flag in `forecast-tab.md` §8.
2. **Color exception (amends the monochrome-data rule, this chart only).** Lapse shading uses the element hues as a warm→cool data ramp — rust `elementBody` (unstable), ochre `elementEarth` (conditional), sky `elementSky` (stable), sky + hatch (inversion) — and the ≥21 kt arrow tier is tinted rust. No new colors, still no green. The F1 dev-log's design-tension flag about exactly this collision is hereby resolved; `tokens.ts`'s no-green/red rule is otherwise untouched.

## Sim smoke test

iPhone 17 sim, real dev-build DB, seeded `Cliffside (F3 smoke)` (paragliding, 45.7016/-121.2894, panels `["wind","meteo"]`) via direct SQLite insert, deep-linked with `simctl openurl`. Screenshots in the session scratchpad (`f3-windgram-mid.png` is the keeper). The render was the physically-expected picture for a strong WNW Gorge day and internally consistent with the Wind card's live station line (The Dalles Municipal Airport, 32 kt gust, 13.3 km, 21 min old): rust ≥21 kt arrows in the afternoon low levels pointing ESE (wind FROM ~288°), BL line climbing to ~1.2 km midday, stable/conditional layering, hatched morning inversions, freezing level ~4.2 km, hour labels in spot-local time, CAPE row 0 (honest — stable day). Grid elevation stamped 81 m vs the ~500 m launch — the grid≠launch caveat visible in the wild on day one. No JS errors in device logs.

**Needs human tap-through:** the horizontal swipe through days 2–4 (headless mouse-drag wouldn't register on the nested ScrollView — the multi-day layout and boundary placement are unit-tested but not eyeballed). The seeded Cliffside spot is LEFT IN the sim DB for that; delete it after (`DELETE FROM spots WHERE id='f3-smoke-cliffside';` or via the app when spot-editing lands). A live side-by-side against wxtofly's actual Cliffside page also wasn't possible from this session (site navigation denied) — worth one manual glance.

## ⚑ Flags (open — for a flag-resolution pass)

1. **Lapse bucket cutoffs are placeholders:** ≥9.5 unstable / 6.0–9.5 conditional / 0–6.0 stable / <0 inverted °C/km (anchored on dry ≈9.8, moist ≈6 adiabats). Documented at the constants; not validated against RASP/soundings.
2. **Arrow steps are placeholders:** floor 8 kt is this chart's own call; 13/21 kt are the (already-flagged) `GUST_*` placeholders, now shared by import so one retune reaches both panels.
3. **ECMWF fallback not wired.** The spec said "GFS/ECMWF seamless"; v1 ships GFS-only outside CONUS (GFS is global; a second fallback family doubles the per-hour attribution/stamp surface for no coverage gain). Deliberate scope call — confirm or schedule.
4. **GFS run stamp unavailable:** `gfs_seamless` is a virtual model with no meta.json (verified 404). GFS-only windgrams stamp "run n/a". Acceptable under absence-over-invention, but if a real GFS run stamp matters, `ncep_gfs013`'s meta endpoint exists.
5. **Grid-elevation axis label renders clipped** ("▲81m" collides with the baseline at low elevations) — cosmetic; the card caption carries the number regardless.
6. **F1's no-TTL-cache flag now bites harder:** every screen focus refetches the ~150 KB dual-model payload for meteo-enabled spots. Carried, not fixed — a TTL cache is a small F4-adjacent task.
7. **Review findings deferred as cleanup (not bugs):** shared broken-line path helper (dualLinePaths vs lineAcross duplicate the hole-breaking idiom), hour/day formatters vs `date.ts`, `LegendSwatch` vs StimulusLedger's swatch row, `runStampLabel` living in the card file, per-hour key rebuilding in `buildHour` (parse-time perf), `levelY`'s defaulted geometry params, and the pre-existing stale-data window when a spot screen instance is reused for a different id (shared with forecast/current since F1).
8. **Working tree carries uncommitted planning-doc edits** (`forecast-tab.md`, `map-tab.md`, `explore-forecasting-research.md`) that predate this session — left untouched, not mine to commit.

## Not done / deferred

- F4 (map mode / ephemeral point forecast on the Explore map) — next pass, handoff below.
- Windgram on the map-tap PointForecastSheet — F4 decision (heavy call on an ephemeral surface; probably link-to-spot instead).
- Forecast TTL cache (flag 6). Gauge forecast card (unchanged since F1).

## Handoff prompt for Forecast-4 (map mode)

```
Start in plan mode. Read planning/rework/phase4-session-playbook.md,
planning/rework/tabs/forecast-tab.md (§2b map mode, §6 F4),
planning/rework/tabs/map-tab.md (Explore surface), the latest handoff in
dev-log/ (forecast-f3-windgram.md — carries open flags incl. the forecast
TTL-cache one), src/components/PointForecastSheet.tsx (the existing
map-tap sheet), and the F1–F3 forecast stack (openMeteoForecast/
openMeteoWindgram clients, ForecastPanelCard).

Build F4, forecast map mode: the Explore map's tap-anywhere point
forecast, finished — wire the PointForecastSheet into the current Map
tab surface (My Map | Explore reframe), spot-ify affordance ("save as
spot" from a tapped point), and decide (flag ⚑, don't build without
asking) whether the sheet offers the windgram or links to a saved spot
instead. Respect: no blending model and observed; model + fetched stamp
on everything; heavy calls never speculative. Consider the F3 flag: a
short TTL cache for fetchForecast/fetchWindgram if the map surface
re-triggers fetches aggressively.

Single-concern commits; flag (⚑) don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test on the map
surface, then status-sync + dev-log-closeout skills, and a handoff
prompt for the next pass. Do not push without asking me.
```

## Status block

- **Pass:** Forecast F3 (windgram/Meteo panel) · `main` @ `a612650`, 44 commits ahead of origin (not pushed)
- **Tests/tsc:** 153 suites / 1566 tests green · tsc clean
- **Flags:** 8 open (above) · 2 resolved in-session (E7 opt-in; color exception)
- **Deferred:** F4 map mode, TTL cache, ECMWF, gauge card
- **Safe to leave as-is.** Human follow-ups wanted: swipe days 2–4 on the seeded sim spot, one manual wxtofly side-by-side, then delete the seeded test spot.
