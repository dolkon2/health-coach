# GPS & Mapping — Spec (v0.1)

*Companion to `wearable-ingestion-spec.md`, `training-logging-spec.md`, `cohorts-spec.md`, and `CLAUDE.md`.*

*Division of labor: `wearable-ingestion-spec.md` owns **import** — pulling GPS routes off a device (Apple Watch `HKWorkoutRoute` in Phase 3, Garmin FIT files via the backend later, Strava rejected). This doc owns the pieces that spec does not: **capturing a route without a wearable**, **routes as first-class navigable/comparable objects**, the **map display layer**, and the path into **cohorts**. Where the two overlap (the `route` field on a Session, the map render), `wearable-ingestion-spec.md` is the authority and this doc points at it rather than restating it.*

---

## The one rule the whole map sits on

**The app ingests a track, or records one — it never fabricates one.** A route on the map is always either (a) imported from a device, (b) recorded live by the phone, or (c) a saved route the user is re-running. When none of those exist, the session shows stats with **no map** — never a fake line drawn between two points. This is the constitution's "descriptive, not predicted" applied to geometry: the map shows where you actually went, or it shows nothing.

A corollary, carried from `wearable-ingestion-spec.md`: a routeless session must read as *complete*, not broken. Stats-only is a valid state, not a hole with a "route unavailable" badge.

## Fidelity is **not** the organizing axis here

Fidelity earns its keep in food, where intake feeds the TDEE residual and logging confidence is a candidate explanation for a weight plateau. A GPS session has no equivalent — distance is distance, and whether a route came off a watch or a phone doesn't feed a correlation that changes what the engine concludes. So on a GPS session `fidelity` is a quiet **provenance tag** (a watch trace is ~0.95, a phone trace a touch lower, manual numbers lower still — per the table in `wearable-ingestion-spec.md`), not a number the UI or the design should revolve around. We do **not** build a "GPS fidelity ladder" UI. The earlier instinct to import the food spec's central mechanic here was wrong; this is the correction.

---

## Capture ladder — how a route gets onto the map

Best to floor. Every rung produces a map except the last, and the wearable buys **fidelity, not access** — nobody is locked out of seeing their loop.

1. **Watch import** *(owned by `wearable-ingestion-spec.md`)*. Apple Watch routes arrive through HealthKit in Phase 3; Garmin routes attach when the backend + Connect Activity API land. The richest path: full trace, per-second HR, splits. If the user has a watch, **prefer this and do not re-record** — burning phone battery to duplicate what the watch already captured is the spine violation, and the dedup logic for it is already specced.

2. **In-app phone tracking** *(new — this doc)*. For the user with **no wearable**, the phone is the only GPS device there is, so recording with it is not a spine violation — the work is genuinely needed, not duplicated. This is a first-class capture surface, **not** a reluctant fallback: it is the *primary* path for the (large) watchless audience, and it's table stakes (every running app has it). It produces the same `route` coordinate array and the same Session shape as an import, `source: { type: 'manual' }`. It is **pull-only**: the user starts and stops it; it never runs in the background, and it never pushes anything mid-run (see § The line, below).

3. **Reuse a saved route** *(new — this doc; see § Routes as a first-class object)*. "I did the usual Tuesday loop." Geometry is inherited from the route object; the user supplies duration + effort (or it's captured live if they track while following it). Lowest-friction rung, and the one that connects straight into cohorts — a shared route means a watchless friend gets the same map as the watch owner just by picking it.

4. **Manual numbers, no map** *(the honest floor)*. Distance + duration + effort, no geometry, no fabricated trace. The right state for a treadmill run or a forgotten-to-track session. This is what `training-logging-spec.md` already calls the GPS manual fallback; this doc just makes explicit that the floor renders **no map**, not a fake one.

> **Explicitly cut:** "drawing" a route by tracing it on the map by hand after the fact (the Footpath/plotaroute pattern). Niche, high-friction, and not wanted. In-app tracking covers the watchless case instead.

---

## Routes as a first-class object

A repeated route is not a logging convenience — it is one of the most important objects on the training side, because it does **three jobs** at once on one piece of geometry:

1. **Navigation** — the line is on the map so the user follows it and doesn't get lost. (This is also the paragliding / point-A-to-point-B case: a course to a waypoint is the same machinery.)
2. **Live capture** — while following it, the phone records actual pace, splits, and time.
3. **Comparison** — this effort against the user's **own** history on the same loop. Run #13 of the Tuesday loop, with the previous twelve times in view.

### The planned-vs-actual parallel

This is the gym template pattern extended to geography, and it should reuse that machinery:

- **Gym:** a template (sets/reps/weight planned) → open it → live session → compare actual to plan.
- **GPS:** a **route** (geometry to follow) → open it → live navigated session → compare actual to history on that route.

### Route as an entity (data-model implication)

For comparison and sharing to work, a route must be its own record — geometry + name + the set of efforts that reference it — not a `route` array buried on a single Session. Sessions point back at a route (`routeId`) and still carry their own actual trace. This is also what lets a route carry a **privacy scope** of its own when it reaches cohorts (one geometry, referenced by the user's template, their live sessions, and eventually their group).

The existing `GpsTemplateShape` in `core/src/sessionTemplate.ts` currently carries **target distance only** ("go run 5k," no geometry). The first-class-route vision needs it upgraded to hold an actual followable `GeoPoint[]` course. See § Data-model implications.

---

## The line: self-vs-self is a mirror; vs-strangers is a scoreboard

Same map data, opposite philosophies. The product takes one and refuses the other:

- **Keep — your efforts over time on your own route.** Purely descriptive: your body, your loop, what happened, surfaced so you can see a trend you couldn't hold in your head. A repeated route effectively *is* a benchmark in the Reflect sense, with geography as the anchor. Fully on-spine.
- **Refuse — global / stranger leaderboards, KOMs, segment crowns.** Comparing the user against people they don't know is the gamification the spine rejects (rule 5: no scores, no shareable competitive performance content). Do not build segments-as-public-competition.
- **Allowed — cohort-scoped course challenges.** A group (or a cohort organizer) can set a time-bound challenge on a course, with a leaderboard *inside that challenge*. This is consistent with `cohorts-spec.md` § Challenges and its constraints, applied to a route: the group authors it, the leaderboard lives only inside the active challenge, it is **never global and never persistent**, and results never leak outside the cohort. A course challenge is a challenge that happens to be scored on a route — nothing more.
- **Refuse — the mid-run push.** Showing "you're 12s off your best on this loop" **when the user pulls it up** is fine; it's their own data. Buzzing their wrist mid-stride with "PR pace, push harder!" is the app becoming a coach that leads (rule 1 + rule 6). Show it on demand; never shove it.

---

## Map display layer

"Strava-quality" is overwhelmingly a *display* investment, and it stays **out of `core/`** — the engine holds the `GeoPoint[]` and never renders a pixel. Platform layer (Expo):

- **MapLibre GL** (`@maplibre/maplibre-react-native`) or **Mapbox** for the interactive map + a polyline from the coordinate array. MapLibre is open and avoids per-load billing; Mapbox is more polished out of the box.
- **Elevation profile + splits** derive from the same point array — charts, no map needed. Elevation for a phone-tracked or saved route (no barometric altimeter) can come from a terrain/DEM API.
- **Static map thumbnail** for the history list, pre-rendered, so the app isn't booting a full GL map per row.
- **Live navigation** (follow-the-line, off-route detection, breadcrumb) is real engineering beyond drawing a polyline — live position-vs-route — but it's still platform/UI, not core.

The payoff of this decoupling: the map can ship sparse and get gorgeous later without touching the engine or the schema.

---

## Privacy — the hardest line in the app

GPS start/end points reveal home and work addresses; Strava has real-world stalking and base-doxxing incidents from exactly this. `cohorts-spec.md`'s "private by default, opt into what you share" applies *hardest* to routes.

- **Privacy zones** (auto-hide the trace within a radius of home/work) must exist **before** any route is ever cohort-visible. This is a hard gate on the cohort map, not a follow-up.
- Privacy is a property of the **geometry**, not the capture method — a drawn, tracked, imported, or reused route starting at the front door all reveal the front door equally. Zones apply to every capture rung.
- Route visibility is a **per-object permission** (`private | cohortId`), consistent with `cohorts-spec.md` open question #6 (visibility scoping at the data level, not bolted on in UI).

---

## Cohort map (Ring 4)

The exciting end state, and more on-spine than Strava's machinery:

- **A heatmap of where a cohort has been / routes they run frequently is descriptive** — it shows what actually happened, aggregated. That's the mirror applied to geography, and it's a far better fit than segment leaderboards. It's **pull**: the user opens the cohort map and sees it; nothing is pushed.
- **"Live map of friends' activities" splits into two very different features.** Separate them:
  - *A map of where the cohort has been* (recent/frequent routes) — the pull-based, descriptive version. The one that fits.
  - *Real-time location* (watching a friend's dot move during their activity) — this is a **safety feature** (Garmin LiveTrack / Strava Beacon: "my partner knows where I am on the paraglider"), not a social one, with much sharper privacy stakes. Scope it as its own later thing; do **not** bundle it into the social map, and do not let it block the social map.

---

## Data-model implications (flagged, not yet applied)

These touch contract docs (`data-model.md`, `training-logging-spec.md`) and `core/`, so they're flagged here for a blessed change rather than edited unilaterally:

1. **Standardize on `GeoPoint[]`, drop the `GeoJSON` mention.** `training-logging-spec.md`'s data-model summary shows `route: GeoJSON`, but `core/src/observation.ts` and `data-model.md` use `gpsPath?: GeoPoint[]` (`{ lat, lng, tsSec, eleM? }`). The code is right: `GeoPoint[]` keeps per-point timestamps and elevation, which is what makes splits, pace-over-distance, and the elevation profile derivable; a GeoJSON LineString throws timestamps away. Convert to GeoJSON only at the render boundary if a map library wants it. Fix the stale `GeoJSON` reference.
2. **Promote routes to a first-class entity.** A `Route` record (id + name + `GeoPoint[]` geometry + privacy scope), with Sessions referencing it via `routeId`. Needed for self-vs-self comparison and for cohort sharing.
3. **Upgrade `GpsTemplateShape`** (`core/src/sessionTemplate.ts`) from "target distance only" to optionally carry a followable route geometry.

---

## Where this sits in the build timeline

GPS is not a single phase — it's a capability that ladders across the existing sequence. Most of it is already placed by `wearable-ingestion-spec.md`; this doc adds the three unhomed pieces.

| Piece | Lands in | Status |
| :--- | :--- | :--- |
| Route **import** + display (Apple Watch via `HKWorkoutRoute`) | Phase 3 / Ring 2.5 | specced (`wearable-ingestion-spec.md`), in build (Pass 3–4) |
| Garmin route via FIT files | "Phase backend" (rides Ring 3/4 backend) | specced, backend-gated |
| **In-app phone tracking** (watchless capture) | New chunk **just after Phase 3** — reuses the Phase 3 Pass 4 map-render; emits the same `route`-bearing Session | this doc |
| **Routes as first-class** (save / follow / navigate / compare) | **Phase 6 / Plan tab** — resolves its open "routes-as-sub-shape" question; reuses planned-vs-actual machinery | this doc |
| **Map display polish** (elevation, splits, thumbnails) | Incremental: starts Phase 3 (Apple Watch render), deepens with in-app tracking | this doc |
| **Cohort map + course challenges + privacy zones** | Phase 8 / Ring 4 | this doc |

**Sequencing logic:** display can't exist before geometry, geometry comes from import (Phase 3) or in-app tracking, comparison needs multiple efforts on the same route, and the cohort map needs routes + sharing. So the natural order is import → in-app tracking → routes-as-first-class → cohort map, which maps cleanly onto Phase 3 → (new chunk) → Phase 6 → Phase 8.

---

## Open questions

1. **In-app tracking placement** — a Phase 3 fast-follow (ingestion-adjacent, both emit `route`-bearing Sessions), or a small Phase 4 GPS-surface enrichment (the GPS log form gains a "track with phone" mode)? Both defensible; resolve when the Phase 3 map-render lands and the real shape of the work is visible.
2. **`Route` entity vs. `SessionTemplate`** — does a navigable route reuse the `GpsTemplateShape` upgrade, or warrant its own `Route` type that templates reference? Likely the latter (a route is shared/compared across many sessions; a template is a plan) — decide in the Phase 6 build plan.
3. **Terrain/DEM elevation source** for phone-tracked and saved routes (no barometric altimeter) — Mapbox Terrain vs. open-elevation vs. other. Implementation decision for the build phase.
4. **MapLibre vs. Mapbox** — open vs. polished, billing model. Decide at the display build.
5. **Real-time location / Beacon** — entirely deferred; noted so the cohort map doesn't accidentally foreclose it. Safety feature, separate privacy model.
