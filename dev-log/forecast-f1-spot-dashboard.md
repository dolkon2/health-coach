# Forecast F1 — Spot Forecast dashboard

*2026-07-15. Branch: `main` (local, not pushed — 6 commits ahead of `origin/main`,
all six this pass, plus the docs-landing commit for the R7 research + spec).*

## What was built

Per `planning/rework/tabs/forecast-tab.md` (F1, "highest daily-use-per-effort item
on this whole page") and the ground rules in `phase4-session-playbook.md`:

- **`fetchForecast({lat, lng})`** (`src/lib/conditions/openMeteoForecast.ts`) — the
  Open-Meteo client extended from current-conditions to hourly (8-day) + daily
  forecast, keyed on bare coordinates (not a `Spot`) per the spec's §2b
  architectural note: the same call will later serve the ad-hoc map-tap sheet
  (F4). Same contract as the existing wind client: `windspeed_unit=kn` asserted,
  `timeformat=unixtime&timezone=UTC`. Pure parser in
  `core/src/conditions/forecast.ts` (fixture + crafted-body tested, same
  null-honest rules as `openMeteo.ts`'s wind parsers). Extracted a shared
  `fetchJson` timeout/abort helper (`src/lib/conditions/fetchJson.ts`) used by
  the new client, `openMeteoClient.ts`, and (after the review pass) `usgsClient.ts`.
- **`spotForecastPanels(spot)`** (`core/src/spot.ts`) + **`defaultForecastPanels(sport)`**
  (`core/src/conditions/feedForSport.ts`) — `spot.meta.forecastPanels` (no
  migration, same JSON-column trick as `spotRequiresUshpaMembership`), falling
  back to a sport-derived default (gauge-family → Gauge, wind-family + surf's
  honest swell-interim → Wind, everything else/untagged → Rain/Shine, Meteo
  never a default).
- **`ForecastPanelPicker`** — a multi-select chip picker (ChipSelect itself is
  single-select) writing `spot.meta.forecastPanels`. Only offers Wind/Rain-Shine
  (the two panel types this pass renders) via a new
  `RENDERABLE_FORECAST_PANELS` constant — Meteo (F3) and Gauge (already covered
  by the live Conditions card) are deliberately left off rather than shipping a
  dead toggle.
- **`WindForecastCard` / `RainShineForecastCard`** (`src/components/ForecastPanelCard.tsx`)
  — Wind: nearest-hour avg+gust header (direction spoken as *from*; explicitly
  NOT the lull/avg/gust three-number convention, which is F2's observed-data
  territory), a two-trace hourly chart, gust emphasis via ink weight past a
  Windy-Bingen-screenshot threshold (13/21 kt — flagged as read off one
  reference screenshot, not a documented rule). Rain/Shine: daily rows with
  probability AND accumulation together (Wunderground convention), a windowed
  headline ("X.X in in the next 24 h"), a temp/feels-like hourly chart, >72h
  daily rows faded. Both stamp model + fetch time and fold a failed/absent
  fetch to a quiet "Forecast unavailable" line.
- Wired into `app/spot/[id].tsx` as a "Forecast" section below the existing
  live-conditions Card — visually separate (live = now, forecast = ahead,
  never merged into one number).

**No migration** (meta rides the JSON column). **No map work.** **No
notifications** (E3 stays deferred, untouched). **No windgram** (F3).

## Design-system tension flagged, not overridden

The spec's Wind panel calls for the Windy Bingen convention: gust cells
color-stepped green→amber. This app's shipped design system is *deliberately*
monochrome with an explicit no-green/red rule repeated verbatim in
`tokens.ts`, `BenchmarkStatusCard.tsx`, and `StimulusLedger.tsx`. Rather than
break that rule or silently drop the community convention, `gustStep()`
(`src/lib/forecastPanels.ts`) returns a *step* ('calm'/'building'/'elevated'),
and the UI renders it as ink-weight emphasis (bold text), never a new hue. The
13/21 kt thresholds themselves are a placeholder read off one reference
screenshot — ⚑ real thresholds are a design call, not something to invent here.

## Verification

- **jest:** 135 suites / **1399 tests** pass (all new: `conditionsForecast.test.ts`,
  `openMeteoForecast.test.ts`, `forecastPanels.test.ts`, `ForecastPanelCard.test.ts`,
  plus extensions to `feedForSport.test.ts` and `spot.test.ts`).
- **tsc --noEmit:** 0 errors.
- **`/code-review` (high effort, 8 finder angles + 1-vote verify):** 7 candidates
  survived verification, 6 confirmed + fixed:
  - The hourly dual-trace chart positioned points by array index, so an hour
    missing only the secondary field (gust/feels-like) was dropped and the
    remaining hours compressed into a falsely smooth, gapless line — rewrote
    to position by real time offset and break each series into its own
    subpath at a hole, never bridging across one.
  - `app/spot/[id].tsx`'s `reload()` awaited the current-conditions and
    forecast fetches in series; parallelized via `Promise.all`.
  - The Forecast section rendered nothing during the fetch window
    (`forecast` still `undefined`) — added a "Loading forecast…" branch.
  - The renderable-panel list was hardcoded independently in three places
    (screen filter, screen card-branches, picker options) — centralized as
    `RENDERABLE_FORECAST_PANELS`.
  - `usgsClient.ts` still had its own copy of `fetchJson` after this same diff
    extracted a shared one specifically to stop that duplication — consolidated.
  - `ForecastPanelPicker`'s chip style was copy-pasted from `ChipSelect` —
    extracted a shared `chipStyle()` helper, used by both.
  - One candidate (spotForecastPanels's empty-array-means-unconfigured
    fallback) was **PLAUSIBLE, not fixed** — see flags below.
- **Sim (iPhone 17 simulator, real device DB, computer-use tap-through):**
  SQL-seeded 3 test spots — a kayak spot with `gaugeSiteId` (gauge default,
  no renderable panel until configured; picker round-trip verified — toggled
  Wind + Rain/Shine on, both rendered live real Open-Meteo data, **persisted
  across a full app relaunch**), a kitesurf spot (Wind auto-defaulted, no
  picker interaction needed), and an untagged spot (Rain/Shine auto-defaulted,
  full 8-day view rendered, **>72h fade visibly confirmed** on the daily rows
  starting Sun Jul 19). One transient network timeout on first load folded to
  "Forecast unavailable" exactly as designed; a retry succeeded cleanly — no
  bug, the honest-failure path doing its job. Test spots deleted after,
  confirmed Home back to its original single-spot state.

## ⚑ Flags

- **⚑1 — Gust color-step thresholds (13/21 kt) are a placeholder.** Read off
  the Windy Bingen reference screenshot description, not a documented
  app-wide rule. Confirm the real thresholds (or that these are fine) before
  this becomes load-bearing for anything else.
- **⚑2 — Can a user ever configure a spot to show zero forecast panels?**
  `spotForecastPanels()` treats a saved empty `forecastPanels` array the same
  as "never configured" and falls back to the sport default — deliberate (an
  empty array from a malformed/legacy write shouldn't silently blank a
  spot's forecast), but the practical effect is a user who deselects every
  chip in the picker can't actually persist "show nothing here"; the chips
  re-select on the next render. Not fixed — this is a product question
  (should "none" be a real, persistable state?), not a bug in the guard
  itself. A `/code-review` verifier confirmed the guard works as coded but
  flagged the resulting UX gap as PLAUSIBLE-worth-a-look.
- **⚑3 — Meteo/Gauge panels exist in the `ForecastPanel` type but have no
  card yet.** `spotForecastPanels`/`defaultForecastPanels` can resolve to
  `'gauge'` or (never as a default, but a future config could record) `'meteo'`
  — the Forecast section legitimately renders nothing extra for those
  (absent, not empty; the live Conditions card already covers gauge). F3
  (windgram) is the pass that gives Meteo a real card.
- **⚑4 — Forecast has no TTL cache**, unlike `current.ts`'s 10-minute cache
  for live conditions. Every screen focus re-fetches the full 8-day forecast.
  Not fixed this pass (not flagged by review as urgent — this screen's
  refocus frequency is low) but worth adding if F4's map-tap sheet reuses
  `fetchForecast` at higher frequency.

## Not done / deferred

- F2 (NOAA direct observations), F3 (windgram/Meteo panel), F4 (Forecast map
  mode), F5 ladder (days-like-this, swell panel, etc.) — see the handoff
  prompt for F2 below.
- ⚑2's product question (persistable "zero panels" state).
- ⚑4's caching.
- Push/merge — not requested this session; `main` is 6 commits ahead of
  `origin/main` for this pass (11 total including the prior docs-landing commit).

## Safe to leave as-is?

Yes. Branch is green (jest/tsc clean), `/code-review` findings applied and
re-verified, sim-tested on all three sport-default buckets with live network
data and a real persistence round-trip, sim left in its original state
(single "White Slmon" spot, screenshot-verified identical to before testing).
The three open flags are documented judgment calls / forward-looking notes,
not regressions.
