# Privacy zones — spec

v1 — 2026-07-11, product-rework planning pass. The entity `map-tab.md` §6 names as "a future
entity, schema'd nowhere yet — a hard-gate prerequisite row in any Ring-4 plan," specced.
Authority: `map-tab.md` §6 (privacy — the hardest line), `social-expansion-plan.md` §5 (the
zero-new-exposure rule, the 200 m default trim, the never-touch-the-stored-trace rule),
`supabase-backend-spec.md` §2/§5.3 (the `privacy_zones` sketch and the projection seam this
spec fills), `planning/claude-md.md` (constitution). Web research cited inline. No code, no
schema changes — planning only.

**The gate, restated so no pass erodes it:** nothing that renders another user's geometry —
feed route thumbnails (Social S3), shared routes (S6), the friends heatmap (S7), any future
surface — ships before this filter is live server-side. The Supabase spec already enforces
this structurally: its v1 projection functions have **no geometry output column at all**;
this spec defines what has to exist before that column may be added.

## 1. Purpose & constitution alignment

A **privacy zone** is an owner-defined circle on the map — home, a partner's place, a
workplace — inside which the owner's geometry is never shown to anyone else. It is a property
of the *owner's account*, applied to **every capture rung equally** (recorded, imported,
plotted, promoted-to-route, reused — `map-tab.md` §6: they all reveal the front door equally)
and to **every surface that shows the owner's geometry to someone else**.

Constitution grounding:

- **The owner's stored trace is never touched.** The raw `gpsPath`/`track` is the tier-1 fact
  and stays sovereign and complete forever; zones filter a *display copy* computed for
  viewers. The owner always sees their own full track (`social-expansion-plan.md` §5:
  display-copy simplification is fine, the stored trace never). The mirror stays exact; only
  the projection is curated — the same shape as notes-excluded-by-default.
- **Zero-new-exposure inheritance.** Every downstream shared-geometry surface (thumbnails,
  shared routes, heatmap) consumes projections that are zone-filtered *before geometry leaves
  the server* — so the heatmap's "only geometry the viewer was individually granted ever
  renders" rule inherits the zones gate for free, and there is exactly one filter to audit.
- **Body never reaches this code path.** Body sessions are structurally excluded from every
  map surface at the query level (`map-tab.md` §6); zones protect E/S/W geometry because
  that's the only geometry that ever crosses accounts.
- **Never fabricate.** The filter only ever *removes* points. It never interpolates a
  synthetic boundary point, never bridges a gap with a chord, never invents a start marker
  where the real start was cut. A viewer sees less than the truth, never something false.
- **Pull, not push.** Zone setup is user-initiated (Settings, plus one contextual door on the
  first share — §4.5). The app never scans location history to volunteer "we noticed where
  you live" (the Map My Tracks auto-detection idea is recorded in §10, not adopted).

## 2. Research grounding — what the incumbents do, and where we deliberately differ

Full trail in the citations; the load-bearing findings:

**Strava ("Edit Map Visibility").** Address-entry + radius picker, radius up to 1 mile
(free-form slider 0–1,600 m per DC Rainmaker's hands-on of the 2021 revamp), multiple
addresses with no documented cap, per-activity override (independent start/end sliders +
hide-entire-map), and since April 2023 a **default 200 m start/end trim on every activity for
every athlete** ([support.strava.com map-visibility](https://support.strava.com/hc/en-us/articles/115000173384-Edit-Map-Visibility),
[privacy defaults](https://support.strava.com/en-us/articles/15401763-your-privacy-defaults-when-you-create-a-strava-account),
[dcrainmaker.com 2021](https://www.dcrainmaker.com/2021/08/privacy-features-options.html)).
Address zones apply **retroactively to all past activities** (excluding per-activity
overrides); the global trim and hide-entire-map apply to future uploads only — a recurring
source of user confusion. Deleting a hidden address fails safe: Strava applies the
next-most-private remaining setting to affected history
([privacy FAQ](https://support.strava.com/hc/en-us/articles/360025920332-Strava-s-Privacy-Controls-FAQ)).
Viewers get **no indication** anything is hidden; the owner sees the hidden portion grayed.
Segment efforts starting/ending in a hidden area stay off leaderboards.

**Garmin Connect ("Privacy Zones").** Web-only management, address + radius 100–1,000 m in
100 m steps; trims the track to the zone border rather than hiding the whole map; applies to
connections and group members too, not just the public. Known hole: the owner's own GPX
export ignores the zone ([Garmin forums, rep answer](https://forums.garmin.com/sports-fitness/healthandwellness/f/venu-3-series/409991/how-does-the-privacy-zone-work),
[kaspersky.com walkthrough](https://www.kaspersky.com/blog/garmin-privacy-settings/53920/)).

**The start-inside vs pass-through semantic — where we exceed industry.** Every major
implementation (Strava, Garmin, Komoot) hides only *start → first zone exit* and *last zone
entry → end*. **A mid-route loop past your own house is fully visible on all of them**, and
this is the single most common user misconception in their forums
([KU Leuven CCS 2022, §on EPZ semantics](https://lepoch.at/files/epz-inference-attacks-ccs22.pdf),
[Strava community "hiding an area"](https://communityhub.strava.com/strava-features-chat-5/hiding-an-area-968)).
This spec's semantic is stronger by mandate: **any in-zone geometry is suppressed wherever it
appears in the track, not only at the endpoints** (§5). No competitor does this for zones;
it's the semantic users actually assume they're getting.

**The attack literature — what a new implementation must survive:**

1. **Endpoint circle-fitting** (Hassan et al., USENIX Security 2018: 84% recovery of
   old-style zone centers by fitting circles to visible endpoints;
   [Mueller 2018](https://medium.com/@nickolaus/stravas-privacy-zone-feature-is-almost-worthless-f47c5cebfece)
   did it by hand). Defense: spatial cloaking — the visible cut boundary must not be a circle
   of knowable radius centered on the protected address. Vendors adopted this post-2018; we
   build it in from day one (§3, the effective circle).
2. **Distance-differential inference — the big one.**
   [KU Leuven, CCS 2022](https://lepoch.at/files/epz-inference-attacks-ccs22.pdf)
   ([ACM](https://dl.acm.org/doi/10.1145/3548606.3560616)): published totals still include the
   hidden portion, so hidden path length is recoverable by subtraction; regressed against the
   street grid this localizes the protected address with **85% success at 200 m radius, 55%
   at 1 km, 39% at 1.6 km** — *even against cloaked zones*, and **jittered cut points do not
   help** (noise averages out over an activity history). The only two defenses shown
   effective: **truncate hidden portions from published stats** (Relive's model — the one
   surveyed service the attack couldn't touch) or round displayed distances to ~500 m. This
   drives our stats posture (§5.6, ⚑Z2).
3. **Aggregate leakage.** The 2018 global-heatmap incident (secret military bases;
   [HuffPost](https://www.huffpost.com/entry/fitness-app-strava-published-heat-map-details-about-secret-military-bases_n_5a6e9f6be4b01fbbefb3315f))
   and [NCSU 2023](https://news.ncsu.edu/2023/06/fitness-app-privacy-loophole/) (~37.5% of
   home addresses identified from heatmap endpoint clusters in low-density areas). Our
   heatmap is already structurally immune — zero-new-exposure, no anonymized-aggregate tier,
   ever (`social-expansion-plan.md` §5) — and inherits zone filtering upstream.
4. **Side channels.** Segment times revealing presence inside a hidden area (Strava now
   suppresses these); proximity features (Flyby); raw exports bypassing the filter (Garmin's
   GPX hole); per-point distance streams in an API. §6.3 walks our equivalents.
5. **Regeneration is not a safety action.** Moving/recreating a zone mints *new* cut
   boundaries across history, which can help an attacker triangulate (CCS 2022). Zone-editor
   copy must never market "refresh your zone" as protection (§7).

**Defaults we take from the research** (decisions, obvious calls): default radius **400 m**
(Strava's 200 m default is the most-attacked setting at 85%; Kaspersky's practical guidance
for Garmin is ≥500 m; 400 sits in the research-recommended 400–600 band), range 200–1,600 m
on a **free slider** (a small fixed set of radii is itself an inference aid), **cap 10 zones**
per account (incumbents document no cap; 10 is generous and bounds filter compute), and the
**200 m start/end trim on every shared track regardless of zones** (already fixed by
`social-expansion-plan.md` §5 — restated, not re-decided).

## 3. The zone entity & storage

Zones are owner-private data about the owner's most sensitive locations. The center
coordinates are exactly the secret being protected — so the rows are owner-only everywhere,
never in any projection output, read cross-account by nothing.

### 3.1 Server table (authoritative — the filter's input)

Extends the `supabase-backend-spec.md` §2 sketch (which named `id, owner_id, lat, lng,
radius_m, created_at` and deferred ownership here). Server ledger = timestamp-named Supabase
migration; **no local migration number is consumed by the server table** (two ledgers, never
conflated — supabase spec §8).

```
privacy_zones
  id              uuid PK          -- client-generated (local-first creation)
  owner_id        uuid FK -> profiles, ON DELETE CASCADE
  label           text             -- "Home", "Parents'" — owner's own name for it
  lat, lng        double           -- the center the user chose (what the editor renders)
  radius_m        int              -- the radius the user chose; CHECK 200..1600
  cloak_lat, cloak_lng  double     -- effective center: chosen center + one random offset
  cloak_radius_m  int              -- effective radius: radius_m + offset length
  created_at, updated_at timestamptz
```

**The effective circle (spatial cloaking), decided:** at creation the client generates one
random offset vector, length uniform in [0, 0.25·radius_m], random bearing; `cloak_*` = the
chosen circle translated by it and inflated by the offset length, so the user's entire chosen
circle is provably contained (offset + radius ≤ cloak_radius). The **filter runs on the
effective circle only**; the editor renders the *chosen* circle (what the user asked for is
what they see — everything they asked to hide is hidden, plus an unknowable margin). The
offset is generated once and never regenerated on edits to label/radius (a re-rolled offset
per edit = multiple boundary sets across history, the CCS regeneration hazard). Radius edits
re-inflate `cloak_radius_m` from the stored offset; center moves re-roll the offset (it's a
new place). This is the post-2018 industry defense (CCS 2022 confirms vendors added random
translation) built in from the first row.

RLS: owner-only for all of select/insert/update/delete, same shape as `observations`. The
only cross-account reader is the SECURITY DEFINER projection path (§6.1), which consumes
zones internally and **never emits them** — no zone id, center, radius, or even count appears
in any projection output. (A viewer must not even learn *that* zones exist — Strava's
"no indication" posture, adopted.)

### 3.2 Local mirror (the editor's store; claims the next free local number)

Zones are created and edited on-device (the editor is a map surface, §4) in a local-first
app, so a local `privacy_zones` table mirrors the server one (same columns plus the standard
`syncState`), synced through the same outbox pattern as everything else (supabase spec §9).
**Local migration: claim the next free number ≥018 at build time against the consolidated
ledger** — verified this session: 001–017 registered (010–013 burned; 016 = routes, in flight
on main as Session 9's uncommitted work; 017 = `recording_buffer`), so **next free = 018**,
but S0.8's media table and the sync outbox already queue for the same number — same
claim-at-build-time rule as every other spec, no number reserved here.

The local mirror powers the editor, offline viewing of one's own zones, and the owner's
"as others see it" preview (§4.4). **It is not the filter.** The filter is server-side only
(§6) — a client-side hide is a rendering choice, not privacy: the raw geometry would already
be on the viewer's device. Locally the cloak params are as safe as everything else in the
owner's own SQLite (the owner already knows where they live).

### 3.3 What geometry the filter covers (the full inventory, verified in code)

Zone filtering applies to every coordinate-bearing thing a projection could emit, not just
tracks — verified against `core/src/observation.ts` on main this session:

| Geometry | Where it lives | Filter behavior |
|---|---|---|
| Track points | `EnduranceBlock.gpsPath` / `PaddlingBlock.gpsPath` / `SkyBlock.track` — `GeoPoint[]` JSON inside the Observation payload (no points table) | §5 mask — the core case |
| Sky segments | `SkySegment.startIdx/endIdx` index into the track — takeoff/landing markers are exactly launch-site/LZ locations | Emitted only as slices of the *filtered* runs; a boundary whose point is masked renders no marker. Indices remap for the display copy; stored indices untouched |
| Climb location | `ClimbingBlock.location` (`LatLng` + name) — a crag pin | Point-in-zone → omitted from the projection (stats stay) |
| Spot backlinks | `spotId` on blocks, set from `gpsPath[0]` at save time; `spots` rows carry lat/lng | A shared session whose linked spot lies in-zone emits no spot pin/coords. (A spot the owner *chose* to put near home still filters — the choice to share a session ≠ the choice to publish home) |
| Route geometry | `routes` (migration 016) — plotted, or an RDP copy of a session trace via save-as-route | Shared-route projections pass the same filter against the **owner's** zones (§6.2). A route promoted from a session that started at home carries home in its copy; the filter catches it at share time |
| Camera bounds / thumbnails / elevation profile / splits | Computed values | Always derived from the filtered copy, never the raw track (§5.5) |
| Conditions snapshot | `ConditionsSnapshot` — verified: carries no coordinates (spot-keyed) | Nothing to filter; the spot pin case above covers its location |
| Photos | EXIF | Already its own hard gate — strip-at-ingest (`social-expansion-plan.md` §4); parallel, not part of this filter |

## 4. UX

Plain language throughout: the UI says **"Private places"** — "privacy zone" is engineering
vocabulary. (Strava's evolution from "Privacy Zones" to "Edit Map Visibility" is the same
lesson: name the outcome, not the mechanism.)

### 4.1 Where it lives

**Settings → Privacy → Private places** — Settings owns the privacy side of everything
(`profile-settings.md` pattern: account public/private and section toggles live there too).
The list: each zone as a row — label, radius, a small non-interactive map chip. Add/edit
pushes the editor. Cap 10; the 11th "Add" explains plainly.

Not on the Map tab's home surface: zones are account configuration, not a map activity, and
Record's pre-start map stays clean. The Map surface participates as the *editor's* canvas.

### 4.2 The editor — a map radius picker

Full-screen map (the existing `MapSurface`/`RouteMap` MapLibre stack): a draggable center pin,
a translucent circle overlay for the chosen radius, a **radius slider (200–1,600 m, free-form,
default 400 m)** with the live circle tracking it, a "Use my current location" button, and a
label field. Decision (obvious call): **pin-drop + current-location only at MVP — no address
search.** Address geocoding needs a keyed service (MapTiler geocoding exists behind the same
key as tiles — a clean later addition) and typing your home address into a fitness app is the
worse interaction anyway; you're usually standing in the place you're protecting. The circle
renders the *chosen* geometry; the cloak offset is invisible even to the owner (showing it
would just be confusing — the guarantee "everything in your circle is hidden" is what's true).

Helper copy under the slider, honest and short: "Anything you share hides everything inside
this circle. Bigger circles hide your neighborhood, not just your street." (The research is
blunt that 200 m protects little — 85% attack success; the copy nudges toward larger without
prescribing.)

### 4.3 Per-session override

The Share sheet (S2's Share/Save moment) gains one quiet toggle: **"Share without map"** —
this share carries stats only, no geometry at all. That's the whole per-session surface at
MVP. Strava's per-activity custom start/end sliders are recorded on the post-MVP ladder
(§10), not built: zones + the always-on 200 m trim + hide-entire-map covers the real cases,
and per-activity sliders are exactly the setting users set once and forget they set (their
forums are full of it).

### 4.4 The owner's preview — the trust surface

On the owner's own session detail (shared sessions): a **"View as others see it"** toggle
that renders the session through the same filter the server applies — hidden portions simply
absent, stats as viewers see them. Decision (obvious call): the preview calls the same
projection the feed uses (self-projection), so it can never lie by drift — one filter, one
truth. Strava's gray-overlay-for-owner is the weaker version of this; an explicit viewer-eye
preview is the honest mirror of the mechanism.

### 4.5 The contextual door

The first time a user **Shares** a session that carries geometry while owning zero zones: a
one-time interstitial before the share completes — "This shares your route, including where
it started. Want to hide the area around home first?" → set up / share anyway / (never shown
again either way). Constitution check: it fires on a user action (their share), not on app
impatience — a consent surface, not engagement theater. It's still an interposed screen the
user didn't summon, so it's flagged (⚑Z1) rather than silently decided.

### 4.6 Recording is untouched

Zones play no part in Record, live stats, save, or the owner's own logbook and maps. The
While-Using permission story, the recording buffer, the save sheet — none of it knows zones
exist. Zones activate exactly at the moment geometry would leave the owner's account, and
nowhere earlier.

## 5. The filtering algorithm

Runs server-side (§6.1), on the raw `GeoPoint[]` decoded from the payload, per (observation,
viewer≠owner) read. Pure function: `(rawPoints, ownerZones, TRIM_M=200) → displayCopy`.

### 5.1 The suppression mask — one union, three sources

Point *i* is **suppressed** iff any of:

1. **In-zone:** haversine(pᵢ, zone.cloak center) ≤ zone.cloak_radius_m, for any of the
   owner's zones — **wherever in the track it occurs**, start, end, or mid-route. This is
   the deliberate exceed-industry semantic (§2): a loop past your own house is cut *at the
   house*, every lap, not only when you start or finish there.
2. **Start trim:** cumulative path distance from the raw start ≤ TRIM_M (200 m).
3. **End trim:** cumulative path distance to the raw end ≤ TRIM_M.

The mask is a union — composition with the 200 m default is automatic (a track starting
inside a zone loses the zone span *and* its first 200 m; whichever reaches farther wins with
no special case). **Trim-to-boundary vs cut-to-radius-plus-buffer, decided: neither —
drop-points-only.** No synthetic point is interpolated at the circle boundary: interpolation
fabricates a coordinate (constitution) and hands the attacker points lying *exactly* on the
cloak circle, the cleanest possible circle-fitting input. Dropping raw points leaves cut ends
at GPS-sample-scattered distances beyond the boundary — free, honest jitter. (And per CCS
2022, synthetic jitter buys nothing against the real attack anyway — the stats posture in
§5.6 is what defeats it.)

### 5.2 Split, never bridge

Surviving points form maximal contiguous runs. Each run of ≥2 points becomes one LineString;
the display copy is a **MultiLineString** (in practice: the existing `toLineString` helper's
FeatureCollection with N features instead of 1 — `geoJson.ts` verified, and the heatmap plan
already notes `features[]` length 1 → N is the same components). A mid-route pass-through
therefore renders as two lines with a gap. **Never bridge a gap with a chord** — a straight
connector through the zone both fabricates a path and points a line segment straight at the
hidden area. Single-point runs are unrenderable and drop; runs are otherwise kept whatever
their length — they're real geometry.

Viewers get no gap styling, no "hidden" marker, no cut-end adornment (no start flag on a cut
end — the first visible point is just where the line begins). No indication anything is
hidden, matching the incumbents' posture and the zero-knowledge principle: absence must be
indistinguishable from a GPS dropout.

### 5.3 Decimate after masking, never before

Display decimation (RDP, ~10–20 m tolerance — the projection's existing plan, sanctioned
because it protects a viewer's copy, not the stored trace) runs **per-run, after the mask**.
Order matters: decimating first could keep two points flanking a zone whose connecting
segment slices through it. RDP keeps subsets of real points (never invents any), so
post-mask decimation is safe within a run — with one guard: **if a decimated segment's chord
intersects any zone circle** (a path skirting the zone tightly, thinned), reinsert the
dropped points for that stretch. Cheap check, rare case, closes the last geometric leak.

### 5.4 Degenerate cases

- **Entire track in-zone** (a run around the block at home): zero visible runs → the
  projection emits no geometry → the feed card renders stats-only. Exactly the pre-zones
  degradation (`social-expansion-plan.md` §5 "degrade to stats-only/absent"); already the
  card's fallback state, never an empty map frame.
- **Track shorter than 400 m:** fully consumed by the two 200 m trims → stats-only. Correct,
  not a bug — a track that short *is* its own endpoints.
- **Multiple zones overlapping:** the union mask handles it with no special case.
- **Zone containing the track's only spot pin / climb location:** point suppressed, session
  still shareable (§3.3).

### 5.5 Everything derived, derives from the copy

Camera bounds, the route thumbnail, the elevation profile, splits, sky takeoff/landing
markers — every viewer-facing derivation computes from the display copy, never the raw
track. One rule instead of a checklist: **the projection's geometry pipeline has exactly one
entry point, and it's the filter.** (Verified hazard this rule kills: `RouteMap` computes its
camera bounds from the path it's handed — hand it raw points and the *bounding box* recenters
on the hidden area even with the line filtered.)

### 5.6 Stats — the distance-differential defense (⚑Z2)

The CCS 2022 finding (§2): if shared stats still include hidden portions, the hidden length
is recoverable by subtraction and the zone is defeated — 85% at the popular radius, and cut
jitter doesn't help. Only two defenses work. **Engineering recommendation — the Relive
model: shared stats describe the shared geometry.** The projection computes distance,
elevation gain, and splits **from the visible runs**; displayed pace derives from visible
distance over visible-span time. Self-consistent (the numbers match the line viewers see),
zero-tell (nothing signals suppression — a rounded number only-when-hidden would itself be a
tell), and the only posture the attack literature couldn't break. The owner's own logbook
keeps exact totals everywhere — the mirror is untouched; and the caption is theirs ("20 km
birthday run!") if they want the real number public — that's their disclosure to make, not
the app's. This is user-visible (your friends see slightly smaller numbers than your
logbook — typically −400 m from the default trims) and therefore flagged, not just decided:
⚑Z2.

### 5.7 Cost

Haversine over every raw point per zone: a 4-hour flight at 1 Hz ≈ 14k points × ≤10 zones —
~100k distance checks worst case, sub-millisecond territory in Postgres/Edge terms at friends
scale, so **v1 filters per-read with no cache** (matching the supabase spec's §5.4 per-read
resolution decision — which is also what makes retroactivity free, §7). If profiling ever
disagrees: cache the display copy keyed `(observation_id, owner_zones_version)`, bump the
version on any zone write. Recorded, not built.

## 6. Where it plugs in — server-side, one seam

### 6.1 The projection RPCs — the single auditable gate

**A client-side hide is not privacy** — if raw geometry reaches a viewer's device, the
privacy work already failed; a debugger, a cached response, or a modified client reads it
regardless of what the UI draws. The filter therefore runs inside the SECURITY DEFINER
projection functions (`get_feed`, `get_shared_session`, the route/heatmap projections —
supabase spec §5.2/§5.3), which are already "the single auditable gate" through which any
cross-account read passes. The supabase spec's §5.3 sequencing is adopted verbatim as this
spec's contract: *v1 projections return no geometry field at all; when this workstream lands,
the projection gains a `geometry` output computed as zone-suppressed points → default 200 m
trim → decimated display copy.* The gate is enforced by an absent column, not a review
checklist — there is no code path that returns unfiltered geometry to a non-owner, because
there is no other path that returns geometry at all.

### 6.2 What it gates (the standing list)

- **Social S2 — shared projection:** the geometry column exists only with the filter inside
  it (they land together or geometry stays absent).
- **Social S3 — feed route thumbnails:** thumbnails render **client-side from the filtered
  projection geometry** (the existing `RoutePreview` SVG / RouteMap over the MultiLineString)
  — decision (obvious call): no server-rendered/cached thumbnail rasters, so there's no
  second artifact to filter, invalidate on zone changes, or leak.
- **Social S6 — shared routes + program-grab-adjacent route pulls:** shared route geometry
  passes the same filter against the **route owner's** zones before leaving the server. A
  save-as-route copy of a from-home session carries home; share time is when it's caught.
- **Social S7 — friends heatmap:** consumes already-filtered projections; inherits everything
  (zero-new-exposure, §1).
- **Live location (deferred, fenced — `social-expansion-plan.md` §5):** in-zone points are
  suppressed from live batches *before they reach the ephemeral channel* — the shared line
  starts only outside the home zone. Same mask, applied streaming; recorded here so the
  future spec inherits it.
- **Future group segments (S9):** an effort starting or ending inside the owner's zone stays
  off group leaderboards (Strava's 2023 behavior — a segment time is a side-channel proof of
  presence). Recorded for the S9 spec.

### 6.3 Side channels, walked (research pitfall #5 → our surfaces)

- **Exports:** no non-owner export exists by construction (projections only). If an
  owner-facing GPX export ever ships, it may export the owner's own raw track (their data,
  their device) — but any *share-a-file-with-a-friend* surface must go through the filter.
  Garmin's owner-GPX hole is the cautionary cite.
- **Per-point streams:** the projection emits the decimated display copy only — never raw
  per-point accumulated-distance streams (the exact field that made Strava's inner-distance
  attack work).
- **Timestamps:** display-copy points carry no per-point `tsSec` — viewers get the geometry
  and the §5.6 stats, not a time series to regress pace/distance from. (Sky segment display
  needs only relative durations, computable server-side.)
- **Kudos/comments/Flyby-analogs:** no proximity feature exists or is planned ("you two
  crossed paths" is refused push anyway); nothing to gate.

## 7. Retroactivity — when a zone is added, moved, or deleted

**Per-read filtering makes retroactivity the default, not a feature.** Zones are read at
projection time, so:

- **Add a zone** → every past shared session, shared route, thumbnail, and heatmap render is
  filtered by it on the very next read. Matches the user expectation the research documents
  (Strava address zones: "all past and present activities"; Komoot retroactively moves old
  tour endpoints) — and beats the incumbents' murky "future uploads only" carve-outs, which
  their forums show users don't discover until it's too late. No reprocessing queue, no
  delay, no bulk-update tooling needed.
- **Move/resize a zone** → same: next read uses the new circle. Center moves re-roll the
  cloak offset (§3.1); radius edits don't.
- **Delete a zone** → past shared geometry near that location becomes visible again on next
  read. That's the honest semantic (the user removed the protection), but it must not happen
  by surprise: the delete confirmation says plainly, "Past shared sessions will show this
  area again." Same copy on a center move (the old area un-hides). No Strava-style
  fall-back-to-most-private cascade — we have no overlapping global settings to cascade
  through, and implicit protection the user didn't ask for is its own confusion.
- **What retroactivity cannot do, said honestly:** geometry a viewer already fetched was
  seen. A zone added after sharing protects every future read, not memories or a viewer's
  screenshot. Client-side feed caches stay short-lived and never persist other users'
  geometry to disk (rider on the S3 feed-cache design, recorded here), so "already fetched"
  stays minutes, not months. And per the CCS regeneration finding, editor copy never suggests
  moving/re-adding zones as a safety ritual — each historical boundary set a viewer observed
  is more information, not less.

## 8. Build passes (ordered; S/M/L; each independently shippable)

- **Z1 (M) — entity + editor, local.** Local `privacy_zones` mirror (claims next free ≥018
  at build time), cloak generation at creation, Settings → Privacy → Private places list +
  map editor (pin, slider, current-location, label), cap 10. Pure local pass — buildable
  pre-backend, today, on the existing MapSurface stack. No user-visible effect on sharing
  (nothing is shared yet) — it ships the vocabulary and the data.
- **Z2 (M) — the server filter.** Server `privacy_zones` table + RLS (timestamp-named
  Supabase migration) + outbox sync from Z1's mirror; the §5 filter as the projections'
  single geometry entry point; §5.6 stats-from-visible; the geometry column turns on. **Lands
  inside/alongside Social S2** (the projection pass) — S2's projections ship geometry-less if
  Z2 slips, and S3 route thumbnails do not ship until Z2 is live. Test density: this is the
  hardest line in the app — the §9 guardrails are the acceptance criteria, tested at the
  density the supabase spec assigns its §11 invariants.
- **Z3 (S) — share-surface integration.** "Share without map" toggle on the Share sheet;
  "View as others see it" self-projection preview on owned shared sessions; the ⚑Z1
  first-share door (if approved); delete/move confirmation copy (§7).

**Slotting vs the ladders:** Z1 is parallel-safe with everything (a local pass; can ride
alongside Social S1 or earlier — it has no Map-ladder dependency beyond the MapSurface
component that already exists on main). Z2 is the gate itself: **schedule it with S2, before
S3** — exactly where `social-expansion-plan.md` §6's sequencing note says "privacy zones
(Map workstream) must be scheduled before S7 and before S3 route thumbnails." Z3 rides S2/S3.
On the Map ladder, this workstream replaces the "cohort map + privacy zones (Ring 4)"
post-MVP line item — zones are no longer a Ring-4 rider; they're the pre-S3 gate with their
own passes. Total: **M + M + S** — small against what it unblocks (all of shared geometry).

## 9. Guardrails (the testable invariants)

1. No projection function emits geometry except through the one filter entry point; v1-style
   geometry-less operation is the fallback state of every shared surface.
2. No zone row, center, radius, count, or existence signal ever appears in any projection
   output or client-visible error.
3. The owner's stored track is byte-identical before and after any zone operation — the
   filter writes nothing, ever.
4. No point in any emitted geometry lies inside any of the owner's effective circles, and no
   emitted segment chord intersects one (§5.3 guard).
5. No synthetic coordinate is ever emitted — every output point exists in the raw track.
6. Gaps are never bridged; cut ends carry no marker distinguishable from a track's real end.
7. Shared stats are computed from emitted geometry only (⚑Z2 posture, once confirmed) — no
   published number includes suppressed portions.
8. The 200 m endpoint trim applies to every shared track, zones or none.
9. Emitted display points carry no per-point timestamps.
10. Body-dimension sessions never reach the filter because they never reach a projection
    (structural exclusion upstream — asserting it here so a test exists at this layer too).

## 10. Post-MVP ladder (recorded, not passes) & open questions

- **Address search in the editor** (MapTiler geocoding, same key as tiles) — nice-to-have
  door; pin-drop ships first.
- **Per-session custom trim sliders** (Strava's per-activity override) — only if real usage
  asks; "Share without map" covers the case bluntly.
- **Auto-suggested zones** (Map My Tracks-style detection of recurring endpoints): genuinely
  useful, but it's the app analyzing your location history to volunteer something — needs a
  deliberate pull-not-push framing (e.g., surfaced only inside the zones editor as "places
  you often start from," never a notification). Not scoped; revisit when Z1 has usage.
- **Open question — imported-track bulk shares:** if a future pass ever bulk-shares history
  (e.g., "share my last year"), the first-share door (⚑Z1) should re-fire once for the bulk
  act. Noted for whichever spec builds bulk sharing.
- **Open question — route *builder* near home:** a plotted route deliberately starting at
  home is the owner's explicit act; the filter still strips it at share time. Whether the
  builder should *say* so inline ("this route starts inside a private place — others won't
  see this part") is a Z3-adjacent copy question, downstream of ⚑Z1's appetite for
  interstitials.

## 11. ⚑ Flagged concerns (for Dylan)

- **⚑Z1 — the first-share interstitial (§4.5).** One-time screen when someone first shares
  a session with a map and has no private places set: "This shares your route, including
  where it started. Hide the area around home first?" Recommendation: yes — it's the one
  moment the protection matters and it fires on the user's own action; but it is an
  interposed screen you didn't summon, so it's your call, not mine.
- **⚑Z2 — what numbers your friends see (§5.6).** The research is unambiguous: if shared
  distance includes the hidden parts, your home is findable by arithmetic (researchers
  recovered 85% of homes protected by the most common setting). The fix that actually works:
  **the shared copy's stats describe the shared line** — so a 10.0 km run shows to friends
  as ~9.6 km (the hidden ends aren't counted), while your own logbook always keeps the exact
  10.0. Alternative: show exact totals like Strava does and accept the known weakness. My
  recommendation is the safe version — it's the privacy-hardest-line answer and the only one
  the researchers couldn't break — but it's user-visible (feed numbers run slightly small),
  so it's yours to confirm. Your caption can always carry the real number if you want it
  public.
- **Decisions (obvious calls) taken here, on the record, not re-raised:** mid-route in-zone
  suppression everywhere (mandated + it's what users assume they're getting); 400 m default
  radius, 200–1,600 m free slider, cap 10; drop-points-only (no boundary interpolation, no
  synthetic jitter); never bridge gaps; spatial cloaking via a stored one-time offset;
  stats/thumbnails/bounds/profiles all derived from the filtered copy; client-rendered
  thumbnails (no raster cache); per-read filtering (retroactivity for free); delete/move
  reveals history with plain confirmation copy; no gap styling or hidden-indication to
  viewers; "Private places" as the user-facing name; pin-drop editor without address search
  at MVP; zones never touch Record or the owner's own views.

---

## Summary

A privacy zone is a circle the owner draws (Settings → Privacy → "Private places"; map pin +
200–1,600 m slider, default 400 m, cap 10); inside it, **no geometry of theirs is ever shown
to anyone else — start, end, or mid-route** (stronger than Strava/Garmin, which leave
mid-route passes visible). The filter is a **server-side pure function inside the projection
RPCs** — the single gate all cross-account reads already pass through — that unions three
suppressions (in-zone points anywhere, first 200 m, last 200 m), splits the survivors into
unbridged runs, decimates after masking, and derives every stat, thumbnail, bound, and
profile from the filtered copy. The owner's stored track is never modified, and their own
views never filtered. Defense against the published attacks is layered: spatial cloaking
(one-time offset circle), drop-raw-points-only cuts, no per-point timestamps, and — pending
⚑Z2 — shared stats that describe only the visible line, the one defense the CCS 2022
distance-subtraction attack couldn't break. Retroactivity is free by construction (per-read
filtering): add or move a zone and all history is re-filtered on next read. Storage: server
`privacy_zones` (owner-only RLS, cloak columns, timestamp-named Supabase migration) + a local
mirror claiming the next free local number (≥018) at build time. Build: **Z1 local entity +
editor (M, buildable now) → Z2 server filter (M, lands with Social S2, gates S3/S6/S7) → Z3
share-surface integration (S)**. Two flags for Dylan: the first-share setup prompt (⚑Z1) and
whether friends see exact totals or visible-line totals (⚑Z2 — recommendation: visible-line;
it's the only posture the researchers couldn't defeat).
