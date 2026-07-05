# Sport-specific mapping research — data layers, not renderers

*Research date: 2026-07-04. Companion to `mapping-systems-research.md` (the platform/renderer
choice — MapLibre RN, already settled). This pass asked a narrower question: for each
GPS-shaped sport in the New Training Database, what open data layers and algorithmic
patterns do the peak apps use, and what can we legally reuse?*

*Method: 24 sources fetched, 54 claims extracted, top 25 adversarially verified (3-vote
panels) — 24 confirmed, **1 refuted**, 6 dropped for budget. Coverage is uneven — see §6.*

**The one clear finding across every sport:** rendering is the solved part (MapLibre RN,
per the other doc). The differentiating value everywhere is (a) sport-specific **data
layers** laid on top of a generic map, and (b) **algorithms over the raw GPS track**
(run/lift detection, thermal inference) — not map data at all. Build effort should go there,
not into the map widget.

---

## 1. Free flight (paragliding) — airspace + thermal heatmaps, both reusable-ish

Matches your Notion row: `Flight-track` capture model, `IGC` import, `Wind aloft` freeze,
peak apps SeeYou Navigator / XCTrack / Flyskyhy / Gaggle / Burnair.

**thermal.kk7.ch — the "Strava heatmap" of paragliding.** **Verified (high):** four
crowd-derived raster layers — Skyways (all flight tracks stacked, i.e. literally a personal
heatmap of everyone's tracks), Thermals (probability), Hotspots (vector points), Certainty
(data density). Served as plain PNG tiles, TMS/flipped-y orientation, at
`https://thermal.kk7.ch/tiles/{layer}/{z}/{x}/{y}.png`, requiring a `src=[hostname]` query
param on every request. **SeeYou Navigator itself ships these as toggleable overlays** —
this is not a hypothetical, it's literally what "see you" was asking about.

**⚠️ Licensing landmine (verified, high confidence):** thermal.kk7 is **CC BY-NC-SA
4.0 — NonCommercial.** Cannot be embedded in a commercial app without contacting the
maintainer (Michael von Känel) directly; the site's own docs invite exactly that
negotiation for heavier use. Since your app's personal-first, non-commercial framing may
make this a non-issue — worth a direct email if you want it.

**OpenAIP — airspace, cleanly reusable.** **Verified (high):** Gaggle refreshes its airspace
layer daily from OpenAIP; it has a documented public API (docs.openaip.net). This is the
correct source for the airspace layer your `wearable-ingestion-spec.md`/training-logging
world hasn't touched yet — a real, no-asterisks-found-yet open source.

**Table stakes (verified):** offline tile + airspace caching. Every peak app (XCTrack, SeeYou
Navigator, Gaggle) does it because you fly without signal. For a personal app, this can be
much lighter than a full region-download system.

**Not verified this pass (dropped/no source survived):** XContest internals (no API, per
your own Notion note), IGC format parsing specifics, Burnair/Gaggle's 3D flight replay
rendering. IGC parsing itself is trivial (plain-text B-records: time, lat/lon, GPS alt,
baro alt) — your Notion note already says "trivial JS parser," which checks out.

**What to reuse vs. build:** reuse OpenAIP airspace outright; treat kk7 skyways/thermals as
"ask permission" or **build your own mini version** — a personal Skyways layer is literally
just *your own* historical tracks rasterized the same way Strava's heatmap works (see the
other doc), no license issue at all since it's your data.

## 2. Whitewater kayaking — gorge is a gift, the app code is not

Matches your Notion row: `River CFS` freeze, `USGS waterdata OGC API` note, peak apps
RiverApp / whitewater.guide / American Whitewater / Paddle Logger.

**gorge — directly reusable (verified, high confidence).** MIT-licensed, actively
maintained Go service (v3.14.3) that harvests river discharge/level data on schedule from
**~24-28 national/regional hydrology sources** (USGS included) behind one uniform REST API
(list gauges, harvest, latest measurement). Ships as Docker + Postgres/SQLite, has TS type
defs on npm (`@whitewater-guide/gorge`). This is exactly the "adapter" your Notion note
flags as urgent (USGS legacy IV API dying Q1 2027) — gorge is either a drop-in replacement
or at minimum the reference implementation to copy for the USGS-specific adapter.

**⚠️ Per-source license diligence still required (verified):** gorge's *code* is MIT, but
each upstream hydrology source carries its own license — UK/SEPA/Tirol/Finland are
OGL/CC-BY (fine), Norway/Switzerland/Quebec are email-consent-based, NZ's NIWA is CC
BY-**NC** 4.0, several (Chile, Ecuador, Russia) are unresolved. USGS itself is US
government data — public domain in practice. Bottom line: reusing the *code* is clean;
reusing *specific non-US gauge data* needs a per-source check, same diligence your own note
already implies for the AW ("unofficial JSON — cache hard") source.

**whitewater.guide the app — instructive architecture, not reusable code.** **Verified
(high):** it's React Native, rendering with `@rnmapbox/maps` v10 (Mapbox, not MapLibre) —
but the GL style-spec patterns (sources/layers/camera/symbol-line for river reaches) port
almost directly to MapLibre; only the offline-pack API differs. **However** the app source
and mobile apps are themselves **CC BY-NC-SA 4.0** — read the architecture for ideas, don't
copy code.

**Not verified this pass:** American Whitewater's own hazard/rapid database terms
(deprioritized — your Notion note already flags AW as "unofficial JSON, cache hard"),
OpenSeaMap (wing/kite-adjacent, see below).

**What to reuse vs. build:** reuse gorge's *architecture* (and possibly its code directly,
MIT) for the USGS-successor adapter your kayaking page already calls urgent; build your own
rapid/hazard layer per-river as you log sessions rather than depending on AW's closed API.

## 3. Skiing — avalanche.org is turnkey, terrain layers are self-producible, run detection is pure algorithm

Matches your Notion row: `Snow/SNOTEL` freeze, peak apps Slopes / Ski Tracks / Carv
(FATMAP dead, confirmed independently in the earlier research pass too).

**avalanche.org — as turnkey as data gets (verified, high confidence).** The National
Avalanche Center's public API (`api.avalanche.org/v2/public/products/map-layer`) returns
**all US forecast zones as a single GeoJSON FeatureCollection** that MapLibre consumes as a
`geojson` source with zero conversion. Each feature ships pre-styled: `danger_level`
(-1..5), color hex, stroke, font color, travel advice, warning object, forecast link — the
API effectively hands you the choropleth styling. This is about as close to "just point
MapLibre at it" as sport data gets. Matches your Notion note exactly.

**Slope-angle shading — reproducible from open DEMs, not licensed.** **Verified (medium —
see caveat):** the industry-standard CalTopo-style slope-angle layer (plus contours,
hillshade, Terrain RGB) is generated from public-domain USGS 3DEP DEMs via open GDAL/
tippecanoe pipelines (`nst-guide/terrain` is one worked example — MIT). Downgraded to medium
confidence only because that specific repo is unmaintained since 2020 (US-centric, "roughly
matches" CalTopo rather than exact) — the underlying `gdaldem`-based technique is still the
current standard, just don't copy that repo verbatim without updating tooling.

**Run/lift detection is 100% algorithm, not map data (verified, high confidence).** Slopes'
signature feature — automatic lift/run segmentation with real-time stats — works from phone
GPS alone; resort/OSM data is only used to *name* the segments afterward. This is the
clearest confirmation in the whole research set of the "build the algorithm, reuse the
basemap" principle: **the detection logic is where Slopes' actual moat is**, and it's the
same shape of problem as your stimulus-ledger movement-pattern inference.

**⚠️ Correction to my earlier claim:** in the first research pass I didn't cover ski
specifics; here, the claim "Slopes renders with Mapbox" was **tested and refuted (1-2
vote)** — Mapbox's own showcase page describes the *feature*, not necessarily the current
renderer. Treat Slopes' engine as genuinely unknown; don't repeat "Slopes uses Mapbox" as
fact.

**Not verified this pass:** OpenSkiMap/OpenSnowMap coverage and license (searched, no claim
survived) — worth a direct look since OSM already tags ski infrastructure (`piste:*` keys)
and it's likely CC-BY-SA/ODbL like the rest of OSM, but that's an assumption, not a
verified finding here.

## 4. Wind/kite/wing sports — the honest gap

Matches your Notion row: `Wind aloft` freeze, peak apps WOO Sports / Surfr / Waterspeed /
Hoolan / WindGuru. **Nothing survived verification for this vertical** — WOO/Surfr/
Waterspeed's own sites were flagged unreliable/inaccessible during fetch, and no claim
about their mapping stack, jump-detection algorithm, or wind-overlay sourcing was
confirmed. Your own Notion note already flags both WOO and Surfr as "no APIs" — consistent
with what little signal came through. Likely reusable pieces by inference (not verified):
Open-Meteo wind-aloft data (already your chosen freeze source) is the natural map overlay;
jump/session detection is almost certainly GPS-accelerometer algorithm work analogous to
Slopes' run detection, i.e. build, not reuse. **This vertical needs its own follow-up pass**
if you want it verified rather than inferred.

## 5. Hiking/MTB — also thin this pass (already well-covered by your own Notion research)

Peak apps AllTrails / Gaia GPS / Komoot / onX / CalTopo / Trailforks. **No claims about
these apps' rendering engines or OSM trail-tagging schemas (`sac_scale`, `mtb:scale`)
survived verification** — sources were fetched but didn't yield confirmed claims this pass.
Your own Notion rows already correctly note AllTrails/Gaia/Komoot have **no public APIs**
(deep-link only) and Trailforks' API is closed — that matches the shape of what little
came through. The terrain-layer pipeline from §3 (self-produced hillshade/contour/slope
from open DEMs) applies identically here and is your best verified lever, since the trail
network itself is OSM data (ODbL) regardless of which peak app you're comparing against.

## 6. Coverage gaps — be honest about what this pass didn't nail down

This was a thinner pass than the platform research (24 sources, several sites were
proxy-blocked during verification and confirmed via search-index text rather than live
fetch). Explicitly unverified:

- Wind/kite sports, essentially entirely (§4)
- Hiking/MTB peak-app rendering engines and OSM trail-tag schema details (§5)
- OpenSkiMap/OpenSnowMap coverage and license
- OpenSeaMap (relevant to any water-sport wind/marine layer)
- XContest internals and exact IGC format parsing details
- OpenAIP's exact commercial-embedding terms and rate limits
- Live-endpoint confirmation for avalanche.org and whitewater.guide/graphql (verified via
  docs/code, not a live request, due to sandbox proxying)

If you want these closed, say so and I'll run a second, narrower pass targeting exactly
those five gaps rather than re-covering ground this pass already nailed.

## 7. What this changes about the recommended stack

Nothing changes at the renderer layer — `mapping-systems-research.md`'s MapLibre RN + tile
provider recommendation stands, now reinforced: `maplibre-react-native` ships a built-in
`OfflineManager` (declarative `createPack({mapStyle, bounds, minZoom, maxZoom})`), which is
exactly the offline-region pattern every peak app in every one of these sports treats as
non-negotiable. One real caveat: offline packs only capture what's *referenced in the style*
— so any sport overlay (OpenAIP, a self-produced slope layer, avalanche.org GeoJSON) has to
be wired in as a style source, not fetched ad hoc, if it needs to work offline.

The per-sport build list, ranked by "reuse available today":

| Sport | Reuse today | Build |
|---|---|---|
| Free flight | OpenAIP airspace (open API) | Personal skyways/thermal heatmap from own tracks (same recipe as Strava's, no license issue since it's your data) |
| Whitewater | gorge (MIT) for gauge harvesting/USGS successor | Rapid/hazard annotations per river as you log |
| Skiing | avalanche.org GeoJSON (turnkey styling); DEM-derived slope/hillshade/contour | Run/lift detection algorithm over GPS |
| Wind/kite | Open-Meteo wind-aloft (already chosen) | Jump/session detection algorithm; everything else unverified — spike needed |
| Hiking/MTB | OSM trail network + DEM terrain layers | Nothing sport-specific beyond what §3's pipeline already gives skiing |

## Key sources

- [thermal.kk7.ch](https://thermal.kk7.ch/) (primary, CC BY-NC-SA 4.0)
- [Naviter KB — KK7 layers in SeeYou Navigator](https://kb.naviter.com/en/kb/kk7-map-layers-skyways-and-thermals/)
- [Gaggle — paragliding map](https://flygaggle.com/solutions/paragliding-map/) (OpenAIP sourcing)
- [`whitewater-guide/gorge`](https://github.com/whitewater-guide/gorge) (primary, MIT)
- [`whitewater-guide/whitewater-guide`](https://github.com/whitewater-guide/whitewater-guide) (mobile app, CC BY-NC-SA 4.0)
- [National Avalanche Center public API docs](https://github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs) (primary)
- [`nst-guide/terrain`](https://github.com/nst-guide/terrain) (MIT, unmaintained since 2020 — technique still valid)
- [Mapbox showcase — Slopes](https://www.mapbox.com/showcase/slopes) (run/lift detection confirmed; rendering-engine claim refuted)
- [`maplibre/maplibre-react-native` OfflineManager docs](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/) (primary)
