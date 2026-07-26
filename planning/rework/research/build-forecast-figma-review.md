# Build Forecast (Figma) — feasibility review

*2026-07-26. Review of the `Build Forecast` section on the `Flows — Map` page of the
Avatar Training Figma file (node `116:3530`). Reviewed against the shipped conditions
stack (`src/lib/conditions/`, `core/src/conditions/`) and the data terms recorded in
`tabs/forecast-tab.md` §3 and `research/explore-forecasting-research.md` §1.*

*Annotations live in the file: a review rail section (`⚑ Build review — feasibility flags`)
sits to the right of the design, and numbered badges on the canvas point into it. The
numbering below matches the badges.*

---

## 1. What this design actually is

The design is a bigger idea than the spec it descends from. `forecast-tab.md` describes
four fixed panel *types* (Wind, Rain/Shine, Meteo, Gauge) chosen by a sport→default
mapping. The Figma replaces that with an **element-tagged module system**: the spot is
tagged Sky / Water / Earth / Body, the tag decides which readings exist, and the user
assembles a dashboard from ~19 modules with per-module thresholds.

That is a better model and it is the one worth building. It also has two consequences the
spec does not yet account for — §4 below.

Three assembly sequences are drawn (A wizard, B edit-in-place, C preset-first) plus a
component library at real width, element-tagging variants, and the Home spot-list landing.

## 2. Feasibility by module

Verdicts are against **free, licensable** sources only (Open-Meteo, USGS, NWS, Synoptic,
RainViewer). WeatherFlow/iKitesurf and Windy remain unlicensable — unchanged since R7.

### Already shipped — no new work

Windgram (F3), wind speed + direction, rain/shine, sky & temp, river gauge, river flow,
point-forecast sheet, live station observations with reading age (F2).

### Free today, from fields already in the response

Gust spread, direction arc, daylight window. Pure presentation on data we already fetch —
the cheapest items on the board and the right place to start design work.

### Doable, needs a field or derivation we don't have

| # | Module | What's missing |
|---|---|---|
| 10 | Cloudbase & lift band | LCL from `temperature_2m` + `dew_point_2m` (~400 ft/°C spread). `dew_point_2m` is not currently requested; nothing derives cloudbase today. Top of lift ≈ `boundary_layer_height`, already wired. |
| 11 | Thermal cycle window | BL-height threshold crossing + `shortwave_radiation` — the approximate-W* branch the research doc already sanctioned. Round to the half hour; "10:40a–5:20p" claims resolution a 3 km model lacks. |
| 12 | Snow line | Freezing level is wired, but snow *level* sits a few hundred–1,000 ft below freezing *level*. Same data, correct name, stated offset. Route profiles already carry elevation. |
| 3 | "Gorge gradient, hourly" | Buildable from Synoptic's ODOT/WSDOT + airport stations — but those are **observations**, so it can't be an hourly forward trace. Label it live or drop "hourly". |

### Can't do as drawn

| # | Module | Why |
|---|---|---|
| 1 | Swell — wind against current | No wave model covers the Columbia. Open-Meteo Marine is ocean-only; nothing forecasts river fetch. "2.4 ft faces, 3–4 s" would be an invented formula with no observations to calibrate against and no statable error band. **Keep the card, drop the numbers** — the qualitative sentence is true and still justifies multi-element tagging. |
| 2 | Precip — basin, 72h | A basin is not a point. Needs the upstream watershed polygon (USGS NLDI/StreamStats) plus a sampled grid inside it — a real hydrology integration, its own pass. Interim: precip *at the gauge*, labelled as such. |
| 5 | Rock dry-out | Hours-since-rain is fine. The "needs 36" constant and "dry by 6p" prediction have no dataset behind them. Show the inputs, not the verdict. |
| 6 | "the sets other pilots read here" | We have no other pilots, and per the social spec we wouldn't harvest private spot configs to get them. Copy fix: "Common sets for a SW-facing launch." |
| 9 | "Melt pulse expected Sat–Sun" | Freezing level is solid and wired. A runoff pulse needs snowpack water equivalent, aspect, and basin routing. Keep the level and its trend; drop the pulse. |

### Shouldn't do — constitution, not capability

| # | Module | Reasoning |
|---|---|---|
| 7 | Surface — "Tacky" | Four-state ground verdict inferred from 48h precip, with no soil type, aspect, drainage, or freeze-thaw. The design's own caption asks whether the app is allowed to make this call; the answer is no (rule 1). Show "0.2 in over 48 h · last rain Tue 4p" and let the reader classify. |
| 4 | Water temp → "4/3 full suit" | Two problems. Coverage: USGS water temp (param `00010`) exists on a minority of gauges; our client pulls `00060`/`00065` only, so unavailable is the common case. And the wetsuit call is the app instructing on an unrequested surface. Mirror version: "54° — you wore a 4/3 last time it was 55°." |
| 8 | Heat band inversion | Shading means "your band" everywhere else and "avoid" here. One rule instead: shading always marks hours matching the band you set; for heat the band is "under 75°". No inversion, no exception to learn. |

**Not flagged, and worth saying:** the design refuses threshold *alerts* outright
("It doesn't judge the day and it doesn't notify you"). That holds the E3 line from
`forecast-tab.md` §8 without being asked to. The band-summary line
("Composed from every threshold you set · never a score") is the strongest line in the
file and should stay structurally incapable of becoming a score.

## 3. The two honest gaps, unchanged

- **No free feed reads the wind at the launch itself.** The Sky cards correctly show
  avg + gust; a model forecast has no lull, and the gust-spread card is the honest way to
  say the rest. Lull/avg/gust stays observed-only (F2).
- **Model resolution.** Anything beyond ~72h fades, per the existing skill-honesty
  convention.

## 4. Architecture consequence — ⚑ for Dylan

**`spot.meta.forecastPanels` as `string[]` does not survive this design.**
`forecast-tab.md` §2a stores enabled panels as a list of names, deliberately, to avoid a
migration. Nearly every module here carries configuration: the band (8–15 kt), the
direction arc (202°–270°), the gust ceiling, rock type, which gauge and how far, the route
profile it reads against. It wants `Array<{type, config}>`.

Worth deciding **before** any of routes A/B/C is built — all three write to it, and the
spec currently records "no migration needed" (§3, §7).

Second, smaller: `feedForSport.ts`'s sport→default-panels mapping becomes
element→available-modules plus sport→default-modules. Extension, not replacement, but a
wider one than §2a describes.

## 5. Sequencing recommendation

**B (edit in place) first.** It reuses the shipped spot dashboard and adds no new screens —
the least new surface for the most understanding, and you are looking at real data while
choosing. **C (preset) second**, as the door for a spot type the user hasn't set up before;
its "tune it" hands off to B, as the design already notes. **A (wizard) last, or never** —
most screens, least reuse.

The design's own note that these aren't mutually exclusive is right; the build order is the
only thing this adds.

## 6. Open questions for the next pass

1. Does the element tag live on `Spot` proper or in `meta`? It is now load-bearing enough
   (it decides the whole module inventory) that `meta` may be the wrong home.
2. Body-tagged spots correctly show "no location readings — nothing to forecast." Confirm
   that means a Body spot never offers a forecast build at all, rather than offering an
   empty one.
3. Swell as a *qualitative* module (§2, flag 1) — worth designing, since the honest version
   is the only version.
