# Pinned Spots — build spec

v1 — specced with Dylan 2026-07-10. Supersedes the "Routes & Sections" framing in the Notion
Features DB. Codebase facts below verified against main (HEAD `17e252f`) on 2026-07-10.

## What it is

**A watchlist of your go-to places.** Each spot is a pinned location with a title and one sport
tag, showing live conditions — generic weather always, plus a sport-specific feed when the sport
maps to one (kayaking → river gauge) — with your session history at that place beneath it.

The daily-driver behavior: open it in the morning, see "is the White Salmon runnable, is the
launch windy," decide whether to go.

**What it is NOT:** saved route geometry. Tracks/routes stay in session payloads and on the
future Map tab. A Spot is a point, not a line. It is also not planning/goals — that's
benchmarks. This is place + current conditions only.

**Where it lives:** second mode of the Training tab, opposite Templates, behind a top-of-tab
swap. The tab shell itself is OUT OF SCOPE for this build (pending the all-tabs research), but
every surface below must assume it will eventually mount inside a tab that has a top mode-swap:
no full-screen headers of its own, content is one scrollable region, navigation to detail is a
push (tap-in), not a mode change.

## Decisions locked (Dylan, 2026-07-10)

- **Name:** Pinned Spots (was "Routes & Sections").
- **Spot = pinned location + title + ONE sport tag.** No multi-sport per spot for now.
- **Sport tag auto-resolves the conditions feed.** Tag a spot "kayaking" and the gauge section
  appears. The user never picks condition cards manually.
- **Generic weather (temp / precip / sky) on every spot** regardless of sport. Forecast is a
  later layer on the same location — post-MVP.
- **MVP sport-specific feed: river gauge only.** Wind next; swell later (no adapter exists yet).
- **Spot detail tap-in at MVP: conditions + session log.** The log-beneath-the-spot lives inside
  the tap-in, not on the list.
- **Two creation paths:** (a) long-press pin on a map → name + sport; (b) "save as spot" from a
  logged session in the logbook, with sport pre-filled from the session's activity.
- **Organization is by place, not dimension.** One list; filter/group by sport tag.

## Existing foundation (verified 2026-07-10)

Most of the plumbing already shipped with the dimension merge. This build is mainly a
surfacing layer.

| Piece | Where | State |
|---|---|---|
| `spots` table (canonical, migration 014) | `src/storage/migrations/014_dimension_unify.ts:61-77` | `id, name, lat?, lng?, kind, meta, riverName, sectionName, gaugeSiteId, notes, createdAt, updatedAt` |
| Spot type + CRUD | `core/src/spot.ts:20-37`, `src/storage/spots.ts` | create/list/get/update(overloaded)/delete, tested |
| Gauge search + link | `src/lib/conditions/usgsClient.ts:165` (`searchGaugeSitesByName`), `SpotPicker.tsx` | shipped — inline spot creation during Water/Wind logging already links `gaugeSiteId` |
| Gauge readings (USGS OGC, keyless) | `usgsClient.ts:99` `fetchGaugeSnapshot(siteId, whenUtcSec)` | shipped; the ≤2h "recent" branch already hits `latest-continuous` — i.e. a **live** reading path exists, just keyed by session time |
| Gauge trend | `core/src/conditions/gaugeTrend.ts` | shipped (6h series → trend) |
| Generic weather (Open-Meteo, keyless) | `src/lib/conditions/openMeteo.ts:61` `fetchWeatherAt({lat,lng,atIso})` | shipped (temp, apparent, precip, snowfall, wind, cloudcover) |
| Wind snapshot (post-MVP feed) | `src/lib/conditions/openMeteoClient.ts:106` | shipped, freeze-path only |
| MapLibre map render | `src/components/RouteMap.tsx`, `@maplibre/maplibre-react-native@10.4.2`, MapTiler via `EXPO_PUBLIC_MAPTILER_KEY` | shipped; **no press/long-press gesture exists anywhere yet** |
| Session ↔ spot links | `core/src/observation.ts` — `spotId`/`spotName` on wind + whitewater blocks (:361, :381-387), `SkySegment.spotId` (:514) | shipped |
| "Promote pin → Spot" | `core/src/observation.ts:298-302` (`ClimbingBlock.location` comment) | explicitly anticipated — save-as-spot fulfills this TODO |
| Session detail screen | none — `app/log-session.tsx` doubles as create/edit/detail via `editId` param | save-as-spot affordance goes here |
| Sky freeze table `conditions_snapshots` | migration 014 + `src/storage/conditions.ts` | insert-only session-freeze store. **Do not touch** — live display never writes here |

Constraint carried from the merge: migration numbers **010–013 are burned** (registry jumps
009 → 014). **The next migration is 015.**

## Data model (Pass 1)

**Migration 015 `spots_sport`:**

```sql
ALTER TABLE spots ADD COLUMN sport TEXT;   -- nullable
```

Backfill in the same code migration, conservative — only where unambiguous:
- `kind = 'river-section'` → `sport = 'kayak'`
- `kind = 'flying-site'`  → `sport = 'paraglide'`
- `kind = 'launch'` → leave NULL (Water's wind spots — could be wing/downwind; ambiguous).
  Untagged spots surface in the list under an "untagged" group with a one-tap tag prompt.

Type changes (no migration needed — payload JSON):
- `Spot.sport?: string` — values are **activity ids from the existing registry**
  (`src/lib/activity.ts`), not a new enum. Icons come free from the activity iconography.
- `ClimbingBlock.spotId?: string` and `EnduranceBlock.spotId?: string` — optional backlinks so
  save-as-spot can link the originating session (water/wind/sky already have them).

`kind` stays as-is: it remains the structural discriminator the existing SpotPicker flows key
on. New spots set both (`sport` → `kind` via a small map). ⚑ flag: collapse the two fields
eventually.

## Sport → feed mapping (Pass 1)

New pure module `core/src/conditions/feedForSport.ts`:

| Sport family (activity ids) | Feed | MVP? |
|---|---|---|
| kayak / whitewater family | `gauge` (requires `gaugeSiteId`) | **yes** |
| wing / windsurf / downwind, paraglide / hike-&-fly | `wind` | post-MVP (adapter exists, display card doesn't) |
| surf family | `swell` | far future (no adapter) |
| everything else (run, hike, ride, climb, …) | none | weather-only |

Weather card renders for every spot unconditionally. A kayak spot without a linked gauge shows
a "link a gauge" affordance instead of the gauge card.

## Live conditions layer (Pass 1) — the one genuinely new lib piece

Everything today is a backdate-correct **freeze** keyed on session time. Pinned Spots needs a
**display** path: current readings, never persisted.

New `src/lib/conditions/current.ts`:
- `fetchCurrentForSpot(spot): Promise<{ weather: WeatherConditions | null, gauge: GaugeSnapshot | null }>`
  - gauge: reuse `fetchGaugeSnapshot(spot.gaugeSiteId, nowSec)` — the existing ≤2h branch
    already resolves to `latest-continuous`, so no new USGS code.
  - weather: reuse `fetchWeatherAt({ lat, lng, atIso: nowIso })`.
- In-memory TTL cache (~10 min) keyed by spot id; pull-to-refresh bypasses it. No disk cache.
- Offline / timeout → `null` per feed (both clients already fold errors to null); UI renders
  "—" with a last-updated stamp when a previous fetch is cached.
- **Never writes** to `conditions_snapshots` or session payloads — those are freeze stores.

⚑ "rain/shine" iconography: `fetchWeatherAt` doesn't currently request `weather_code`. Either
add it to `HOURLY_COMMON` (touches the freeze path too — keep additive) or derive an icon from
cloudcover + precipitation. Decide in Pass 1; derivation is the safer default.

## Surfaces

### 1. Spots list (Pass 2) — the mode home
- MVP mount: a **"Spots →" header link on the Training tab**, alongside the existing
  Benchmarks/Library/Progress/Import links (`app/(tabs)/training.tsx:108`). Deliberately thin
  and temporary — re-homes into the Templates ↔ Pinned Spots top swap when the tab shell lands.
- Route: `app/spots.tsx`. Cards: title, sport icon, headline reading (gauge ft/cfs for kayak
  spots, temp + wind otherwise), updated-at stamp.
- Grouped/filterable by sport; untagged group last with tag prompt.
- Sort: most-recently-visited (latest session at that spot), then `createdAt`.
- Pull-to-refresh refetches all visible spots (cache-bypassing).

### 2. Spot detail tap-in (Pass 3)
- Route: `app/spot/[id].tsx`.
- Header: name, sport icon, notes.
- Conditions section: weather card always; gauge card (reading + trend arrow via existing
  `gaugeTrend`) when `gaugeSiteId` present; "link a gauge" search (reuse SpotPicker's
  `searchGaugeSitesByName` UI) when the sport wants one and none is linked.
- **Session log beneath:** sessions referencing this `spotId` (wind/whitewater blocks, sky
  segments, new climb/endurance backlinks), newest first, rendered with the existing
  `SessionCard`; tap → `log-session?editId=…`.
- Edit: rename, notes, re-tag sport, delete (confirm dialog; sessions keep their denormalized
  `spotName`, links dangle harmlessly — existing design).

### 3. Map pin picker (Pass 4)
- Modal route `app/pin-spot.tsx`: full-screen MapLibre view (same MapTiler style as RouteMap),
  **long-press drops a pin**, then a small sheet: name + sport picker → `createSpot`.
- ⚑ Long-press is net-new — no gesture handlers exist on any map surface. Spike MapLibre
  v10.4.2's `onLongPress` support first; if flaky, fall back to a **center-crosshair +
  "Drop pin here" button** (equally usable, zero gesture risk).
- No MapTiler key → show a friendly "map needs a key" state (key already in `.env.local`).

### 4. Save-as-spot from the logbook (Pass 4)
- Lives in `app/log-session.tsx` edit mode (the de-facto session detail).
- Affordance appears when the session has a location and no linked spot. Location source by
  surface: `climb.location` (the crag pin — fulfills the "promote pin → Spot" TODO),
  `endurance.gpsPath[0]` (start point), `sky.track[0]`.
- Pre-fills: sport from the session's activity, coords from the source; user supplies the name.
- On save: `createSpot` + write the new `spotId` back onto the block, so the session
  immediately appears in the spot's log.
- Water/wind sessions already have SpotPicker inline — no new affordance needed there.

## Sessions-at-spot query (Pass 3)

`listSessionsForSpot(spotId)` in `src/lib/`: load sessions and filter in JS on
`payload.wind.spotId` / whitewater `spotId`/`endSpotId` / `SkySegment.spotId` /
`climb.spotId` / `endurance.spotId`. Payloads are JSON blobs and this is a single-user local
DB — a JS scan is fine at current scale. Post-MVP: proximity matching (session start point
within ~N meters of a spot) to catch GPS sessions that never linked.

## Build passes

Single-concern commits, jest per pass, `tsc` LAST after tests are written.

- **P1 — data + lib groundwork:** migration 015 + backfill; `Spot.sport`; block `spotId`
  backlinks; `feedForSport`; `current.ts` live-conditions module. Tests: migration across
  legacy shapes (extend `dimensionUnify.test.ts` pattern), feed mapping, current-conditions
  null-honesty + TTL.
- **P2 — spots list:** `app/spots.tsx` + Training header link; cards with live readings;
  sport grouping; pull-to-refresh.
- **P3 — spot detail:** `app/spot/[id].tsx`; conditions cards; gauge-link affordance;
  session log; edit/rename/re-tag/delete.
- **P4 — creation flows:** `app/pin-spot.tsx` map pin picker (long-press spike → crosshair
  fallback); save-as-spot affordance in `log-session.tsx` with backlink write.

**Post-MVP ladder (recorded, not built):** wind feed card (adapter exists); forecast strip on
the detail view; swell adapter; favorite/pin-to-top ordering; proximity session matching;
"template references a saved spot" (unblocked now that Spot is a first-class sibling entity);
long-press + spots layer on the future Map tab; any social/Groups sharing of spots.

## Flags ⚑ (for Dylan)

1. **`kind` vs `sport` dual fields** — kept both for now (kind drives legacy flows, sport is
   the user-facing tag); collapse candidate once SpotPicker migrates to sport.
2. **MapLibre long-press unverified** on v10.4.2 — crosshair fallback specified so Pass 4
   can't stall on it.
3. **The session-log-under-spot partially answers "where does the logbook live"** — this spec
   deliberately does NOT move the Training history feed; coordinate at the Training tab
   talk-through.
4. **`kind='launch'` spots backfill to untagged** — Dylan tags them by hand (likely ~a few).
5. **Provisional gauge readings** — USGS live readings are often provisional; snapshot type
   already carries `approvalStatus`. Show a subtle "provisional" marker on the gauge card?
6. **Weather icon source** — derive rain/shine icon from cloudcover+precip vs adding
   `weather_code` to the shared fetch; leaning derivation (no freeze-path changes).
