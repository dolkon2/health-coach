# Map "Tile" Rework — the locked Figma board, implemented

*Written 2026-07-27. Source of truth for the visual/UX rework of the Map tab's live
surfaces. Design of record: the **"Locked" board** in Figma —
`Avatar-Training` file `fe8fibTDwAkI9z83mtcq5t`, node `176-5054`
(https://www.figma.com/design/fe8fibTDwAkI9z83mtcq5t/Avatar-Training?node-id=176-5054).
Companion to `map-tab.md` (which stays authoritative for *behavior*: modes, Record,
deep links, recovery). This doc owns the *presentation contract* and the session plan.
Session kickoff prompts live in Notion ("Active Work" → the Tile Map Rework hub).*

## What this is (and is not)

Every surface on this board **already exists functionally** on `main`: My Map / Explore
modes, Record with background recording, the Explore-2 route builder, spots, routes,
search geocoding. This rework is a **restyle + interaction-pattern pass over live
pages** — no new entities, no migrations expected (one possible exception: route
privacy, ⚑ below), no behavior reversals. Where the board and `map-tab.md` describe the
same behavior differently, the board wins on presentation, `map-tab.md` wins on
mechanics.

**Decisions locked by Dylan, 2026-07-27** (do not re-open):

1. **Routes sheet = frame "4c · combined concept"** — every saved route renders as a
   full stat card, not a compact row.
2. **Chrome-only.** The terrain look in the mockups *is* the existing keyed MapTiler
   basemap — no style/terrain session in this rework.
3. **Activity picker replaces `ElementPickerSheet` app-wide** — Map arm, route builder,
   and every other usage move to the new picker together. One picker, no divergence.
4. **Runs on `main` now** — does not wait for the water/sky dimension-branch merge.
   The rework owns `app/(tabs)/map.tsx` + map components; the dimension branches don't.

## Shared design language (applies to every screen)

- **Mode switcher**: top-left pill pair `MY MAP | EXPLORE` — active mode is a solid
  black pill with white caps text, inactive is white with dark text. Top-right: a
  circular white icon button with the search magnifier (Explore adds a layers icon
  button beside it). This replaces the current `SegmentedControl` + search-bar chrome.
- **Element dot = identity, selection = monochrome.** Color only ever *names* the
  element (Earth ochre, Sky blue, Water teal, Body red-orange — existing tokens).
  Selected states are black/white, never element-colored.
- **Sheets**: white rounded cards with a grabber handle, lifted over the map; when a
  sheet takes focus the map dims behind it.
- **Stat strip**: the recurring numeric row — large mono figure, small unit beside it,
  caps label beneath (`4.2 mi / DISTANCE · +620 ft / CLIMB · 4 / POINTS`). Becomes a
  shared component; used by route cards, the builder, and the save sheet.
- **Record**: black `RECORD` pill next to an activity pill (`● Water · Kayak ⌄`).
- **Tone**: descriptive labels, no celebration copy anywhere ("Saved to Routes ·
  4 saved" — just the count).

## The four screen groups (board → code delta)

### A · Activity Picker (frames 87:14)

Sheet over the dimmed map: `RECORD` caption, "Choose activity" title, close ×.
`ELEMENT` row — four chips (element dot + caps label), selected chip black. Below,
`{ELEMENT} ACTIVITY` — a 2-column grid of activity buttons (glyph + label), selected
black with a check. Picking an element swaps the activity set in place.

**Delta**: replaces `ElementPickerSheet.tsx` everywhere (both `arm` and `builder`
purposes in `map.tsx`, plus all non-map usages). Element/activity data comes from the
existing `@/lib/activity` registry — the board's grids are illustrative, not a curation
of the registry (⚑ TM2-1).

### B · My Map (frames 79:24, routes = 4c)

1. **Collapsed (default)**: full-bleed map, element-colored spot pins, route traces;
   bottom card holds the activity pill + `RECORD` + a quiet
   `⌃ SWIPE UP · SPOTS & ROUTES` hint.
2. **Expanded**: the bottom card grows into a sheet — activity pill + `RECORD` stay as
   the header, then a `SPOTS | ROUTES` segmented pill row, then the list.
   - **Spots**: `4 PINNED` count caption; each row = element dot, name, condition
     sub-line (`flowing · runnable`, `SW 12 mph · thermic 11a`), and one right-aligned
     hero stat (`2,140 CFS`, `64° SUN`, `58° TEMP`) + chevron into spot detail.
   - **Routes (4c)**: `3 SAVED` caption; each route is a **full stat card** — dot +
     name + chevron header, then a stat strip (`4.2 mi DISTANCE · Class III RAPIDS ·
     -210 ft DROP`, or `8.1 mi · +1,240 ft CLIMB · 58°` — stats are per-sport).

**Delta**: restructures `map.tsx`'s My Map layout into the collapsed-card /
expanded-sheet pattern; `SpotCard`/`RouteCard` restyle; the current layer-toggle row is
absent from the board (⚑ TM3-1).

### C · Explore (frames 82:463)

1. **Reticle**: fixed center crosshair (existing), bottom black pill
   `📍 PIN THIS LOCATION`.
2. **New-pin card**: `NEW PIN · SUGGESTED NAME` caption, editable name pre-filled from
   reverse geocoding ("Chenoweth Ridge"), coordinate + elevation line, a
   `TEMP · PRECIP · WIND` mini stat row (live conditions for that point), then
   `SAVE SPOT` (primary) and `BUILD FORECAST | BUILD A ROUTE` (secondary pair).
3. **Search branch** (magnifier, both modes): a full search field lifts over the map
   with `CANCEL`.
   - **S1 · focused**: `YOUR SPOTS` (element dot + name + live sub-line) then
     `RECENT` searches.
   - **S2 · typing**: live-filtered `YOUR SPOTS`, then `PLACES` (geocoder results,
     name + region), then `⊕ Search this map area — re-run near the current view`.

**Delta**: Explore's current pin/forecast flow gets the new-pin card (the
`BUILD FORECAST` action opens the existing `PointForecastSheet`); the current
submit-triggered search bar becomes the S1/S2 overlay with spots-first results and
recents (⚑ TM5-1).

### D · Build a Route (frames 115:14 — 8 states)

Header card replaces the current builder chrome: activity pill (glyph + name + ⌄ + ×)
over a `SNAP TO {TRAILS|RIVER} | FREE-LINE` segmented pill — the snap label derives
from the activity's element (existing `routingModeForActivity`), never chosen
separately. The crosshair labels the nearest network segment and offset
(`LABYRINTH TRAIL · 12 M`).

Bottom panel: stat strip (`DISTANCE · CLIMB/DROP · POINTS`), a one-line status with
element dot (`● Following Labyrinth → Coyote Wall · 3 trail segments`,
`Free-line · straight legs, no trail network`,
`Put-in → take-out follows the centerline · Class III at mi 1.8`), then
`UNDO | + ADD POINT`, then a single primary `SAVE ROUTE` (disabled/grey until the
route is saveable). Off-network: the leg renders dashed and a hairline notice states it
(`No trail within 240 ft — leg 3 drawn free`) — nothing blocks, nothing scolds.

**Save sheet**: `NAME` (suggested), identity dropdown (`● Earth · Trail run`), privacy
dropdown (`Private`), stat strip, provenance line (`Snapped to trails · 0.2 mi drawn
free`), `UNDO | KEEP EDITING`, `SAVE ROUTE`. **Saved**: toast-style banner
(`● Saved to Routes — 4 saved`), landing on My Map's Routes sheet; snap mode reads as
a stat on the route card (`snapped LINE`).

**Delta**: full restyle of `RouteBuilderOverlay.tsx` + its `map.tsx` harness onto the
header-card/stat-strip pattern; builder mechanics (`useRouteBuilder`, snapping,
undo) unchanged. Privacy dropdown is the one possible schema touch (⚑ TM6-1).

## Phases & sessions

Sessions run in order within a phase; full prompts (model + effort + skills + 🟥 flags)
live in Notion. Every build session ends the standard way: jest, `tsc` last,
`/code-review`, `sim-smoke-test` vs the Figma frames, `dev-log-closeout`,
`status-sync`, handoff.

**Phase 1 — Foundations**

| # | Session | Size | Model / effort |
|---|---------|------|----------------|
| TM1 | Shared map chrome primitives — mode pill pair, circular icon buttons, sheet card + grabber, `StatStrip`, segmented pill | S–M | Sonnet 5 · medium |
| TM2 | Activity Picker sheet, app-wide `ElementPickerSheet` replacement | M | Sonnet 5 · medium |

**Phase 2 — My Map & Explore**

| # | Session | Size | Model / effort |
|---|---------|------|----------------|
| TM3 | My Map collapsed card + expanded Spots/Routes sheet (4c cards) | M–L | Opus · high |
| TM4 | Explore new-pin card (conditions preview + 3 actions) | M | Sonnet 5 · medium |
| TM5 | Search branch S1/S2 (spots-first, recents, search-this-area) | M | Sonnet 5 · medium |

**Phase 3 — Builder & closeout**

| # | Session | Size | Model / effort |
|---|---------|------|----------------|
| TM6 | Route builder rework — header card, status lines, save sheet, saved landing | L | Opus · high |
| TM7 | Full-board polish sweep — sim comparison against every frame, flag resolution, status sync | S–M | Sonnet 5 · medium |

Dependency notes: TM1 feeds everything; TM2 is independent after TM1; TM3's search
icon opens TM5's overlay (until TM5 lands it opens the current search bar); TM6 sits
on TM1+TM2; TM7 is last.

## ⚑ Flags (answered at the top of each Notion session page)

- **TM2-1** — Are the board's activity grids the full `@/lib/activity` registry per
  element, or a curated subset? (Earth shows trail run/climb/hike/MTB/boulder — no
  road run/ride. Constitution says the data bucket stays inclusive.)
- **TM2-2** — Body in Record contexts: routing follows the logging surface (map ⚑6) —
  confirm what picking Body does in each picker context after the redesign.
- **TM3-1** — The layer-toggle row (`visibleLayers`) isn't on the board's My Map.
  Retire it, or move it behind Explore's layers icon?
- **TM3-2** — Spot-row hero stat: which single condition wins per spot (CFS for river
  sections, wind for sky, temp otherwise)? Needs a per-spot-kind rule.
- **TM4-1** — `SAVE SPOT` from the new-pin card: save immediately with the suggested
  name, or route into the existing new-spot flow?
- **TM5-1** — Recent-searches persistence: where do recents live (settings JSON vs a
  tiny table)? How many kept?
- **TM6-1** — The save sheet's privacy dropdown: routes have no privacy field today.
  Add the field now (visibility-as-permission per the constitution's Ring-4 forward
  reference), or hide the dropdown until the social ladder reaches routes?

## Out of scope

Basemap/terrain styling (decision 2), any routing-engine change, offline tile packs
(stays ⚑R8/map⚑4), the cohort/world map, and anything on the board's margins that
isn't one of the four groups.
