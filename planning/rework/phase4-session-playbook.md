# Phase 4 Session Playbook — platform + decision-gated work

*For Dylan. The Phase 4 companion to `session-playbook.md` (which carried the rework through
Session 10). Same shape: ordered sessions, one model recommendation each, 🟥 red-question
boxes for the calls that are genuinely yours, and a copy-paste kickoff prompt per session.
Written 2026-07-12. Claude: if you're reading this at the start of a session, this file plus
`master-plan.md` (§4 Phase 4, items 26–31) plus the latest handoff in `dev-log/` is your
context.*

## Where the product is when Phase 4 begins

Rework Phases 1–3 have shipped and are on `origin/main` (see `dev-log/rework-phase4-handoff.md`
and `git log`). Live today: the 5-tab shell (Home · Training · Map · Nutrition · Social),
Profile with the logbook, Reflect retired, the Routes entity + shelf + follow (migration 016),
Map Record M2 (background recording), the light-only rebrand swap, the Training
`[Templates | Routes]` splitter, the ported 28-icon activity glyph library, the persistent
`PillActionButton` system, and the new on-brand MapTiler style (keyed via `.env.local`).

Benchmarks decision-proof passes **B1 (classifier), B2 (detail sheet), B3 (list container)**
shipped in rework Session 5. What remains of the benchmark system is **B4 (groups storage)**
and **B5 (type-decision application)**.

**Migration ledger (verified against `src/storage/migrations/index.ts`, 2026-07-12):** the
registry runs 001–009 + 014–017; **the next free number is 018.** (010–013 are permanently
burned — never re-register; see the header comment in `index.ts`.) The "018 claimed for
session-photos" line in older notes was a *spec reservation that never landed in main* — on
this branch 018 is free. Claim the next-free number **at build time**, never from this doc.

## Ground rules (apply to every session)

- **Run sessions IN ORDER within a track, one at a time**, always in `~/Projects/health-coach`.
  Never two Claude sessions on this folder at once (it corrupted the environment on 2026-06-27).
  While a session works, Dylan answers the next session's 🟥 questions.
- **Models:** Sonnet 5 = default builder. Opus 4.8 = spine-touching / heavy-judgment sessions
  (marked below) — `/model claude-opus-4-8`, back with `/model claude-sonnet-5`. Fable 5 =
  long hands-off / overnight autonomous builds — `/model claude-fable-5`.
- **Build sessions end the same way** (baked into each prompt): full jest suite, `tsc` **LAST**
  (after test files are written — `feedback-verify-order`), `/code-review`, sim smoke test if
  UI changed, then the `status-sync` and `dev-log-closeout` skills, then a handoff prompt for
  the next session. Plan/paper sessions skip jest/tsc/sim and instead end by writing the spec +
  a build prompt.
- **Skills in this repo:** `flag-resolution`, `status-sync`, `dev-log-closeout`,
  `sim-smoke-test`. Native: `/code-review`, `/verify`, `/simplify`, plan mode.
- **Locked facts still hold:** light-only, no dark mode; the claude.ai/design light kit +
  `ui_kits/mobile-app` mockup are the design of record; single-concern commits; flag (⚑) don't
  reinterpret; descriptive-not-prescriptive constitution; the mirror is never gamified.
- **Migrations:** claim the next-free number (currently **018**) at build time by reading
  `src/storage/migrations/index.ts` — do not hardcode a number from any doc. The **route
  builder needs no migration** (the `routes` table 016 already exists; plotted routes and the
  future `RoutePoint.kind` ride the JSON column).
- **Do not merge or push without asking Dylan first.**

## Do you need a docs/decisions session first? No.

The rework's D0 + S0.5 doc-landing already happened; `planning/rework/` is authoritative and
current. Phase 4's blocked sessions wait on *Dylan's answers*, not on doc reconciliation. So
there is no Phase 4 "Session 0" — instead, the gating step is a **flag-resolution pass over the
red boxes below**, which Dylan can do async, in any order, whenever. Answering them unblocks
P4-5 through P4-9. The four ✅ sessions need none of those answers and can start today.

## Session sequence

| # | Session | Model | Status |
|---|---------|-------|--------|
| P4-1 | SDK 53→56 + MapLibre v10→v11 upgrade (New Arch flip) | **Opus** | ✅ Safe now — the spine |
| P4-2 | 3D terrain + v11 camera/gesture polish | Sonnet | ✅ Safe after P4-1 |
| P4-3 | Benchmark groups storage + pause/resume (B4) | Sonnet | ✅ Safe now (decision-proof) |
| P4-4 | Gear Quiver rework — display-only (P9) | Sonnet (or Fable) | ✅ Safe now — 🟥 reminders only |
| P4-5 | ~~Sections definition (T0 · paper/plan)~~ | — | ✅ Not needed — Section resolved as Routes-only (R1), Training gets no Sections primitive |
| P4-6 | Templates 3a application (T6, layout-only — no Sections build) | Sonnet | ✅ Safe now — R1 + R2 both resolved |
| P4-7 | Benchmarks type-decision application (B5, derived + domain/type tab) | Sonnet | ✅ Safe now — R3 + R4 both resolved |
| P4-8 | Explore v1 (M5) | — | **SUPERSEDED — see Notion "▶ Map P1"** (R7 delivered 2026-07-15) |
| P4-9 | Route builder in Explore (M6) + T3 `+ New Route` | — | **SUPERSEDED — see Notion "▶ Map P6"** |
| *(new)* | Forecast track F1–F4 (per-spot dashboard, NOAA obs, windgram, map mode) | mixed | Not in this playbook — see Notion "▶ Map P2–P5", unblocked now |

**Two independent tracks.** The ✅ platform/decision-proof track (P4-1 → P4-2, plus the
free-standing P4-3 and P4-4) can run start-to-finish now. The 🟥 decision-gated track (P4-5
→ P4-9) unlocks as Dylan answers red boxes; within it, P4-8 (Explore) and P4-9 (builder) also
sit on P4-1 having landed.

---

## 🟥 Open red-questions (the flag-resolution roster)

*These are the only genuine product/scope calls left in Phase 4. Each carries a plain-language
lean where the research or existing docs already point one way — treat the lean as **provisional**,
not decided. Answer them in any order, whenever; nothing below waits on this playbook.*

**✅ R1 — What is a "Section"? RESOLVED 2026-07-14.** Dylan: "ya its sections of routes." A
Section is a named, timed stretch *within a route* (specific rapids on the Little White Salmon
his friends compare times on; the hill between two points on a road run) — a Strava-segment-like
primitive, lives entirely in Routes/Map. **The training reading (a reusable work-block smaller
than a template) is dead** — Training does not get a Sections concept at all. This collapses
P4-5 (see below) and simplifies P4-6 to a pure layout pass, no Sections primitive to build there.
A *Routes* Sections primitive is real future work but explicitly parked with Explore/route
builder (R7) — Dylan wants that whole cluster thought through in its own dedicated session.

**✅ R2 — Templates library: two lists (3a) or one unified stream (3b)? RESOLVED 2026-07-14: 3a.**
Dylan wants two separate lists — one-offs get their own list, Templates splits active/deactivated
— reversing this doc's 3b lean. No Sections filter chip needed (R1). Ordering not fully pinned:
leaning one-offs → active → deactivated, but he also floated one-offs living in the middle;
confirm exact order at P4-6 build time.

**✅ R3 — Benchmarks type field: derived, stored, or none? RESOLVED 2026-07-14: derived (lean B),
no type-first creation flow.** Dylan: "I think its cool for it to be assumed and not need to sort
through a drop down" — confirms the existing rule stands, no dropdown, no v0.4 amendment. The
Notion type-first mockup was not what he wants; treat it as the drift this doc worried it might
be, not a deliberate override.

**✅ R4 — Benchmarks list layout: by-domain (2a) or by-type (2b)? RESOLVED 2026-07-14: both,
via a tab — not a straight swap.** Dylan: "I think there should be a distinction tab and
organization aspect for type." Reads as: keep the by-domain view (2a, how it works today) as one
tab, and add a by-type (Behavior/Outcome/Both) view as a second tab/organization mode — not
replacing 2a, adding to it. Confirm this reading at P4-7 build time before committing to the UI
shape.

**🟥 R5 — Benchmark-group management placement.** (bench ⚑5 = profile ⚑5.) *Lean: Profile*
(benchmarks are identity-shaped). **Not blocking:** P4-3 (B4) ships group management on the
existing list surface interim regardless of where it eventually lands.

**🟥 R6 — Gear Quiver reserve-repack reminders: may the quiver ever notify?** (profile ⚑7.)
*Lean: display-only* — rendering a repack-due date and days-elapsed when the user opens the
quiver is plainly descriptive; a *notification* is push, and this is the one place it could
arguably pass the "sparingly earned / the data said something safety-relevant" bar. Genuinely
contestable. **Not blocking:** P4-4 (P9) ships display-only regardless; rule this before any
reminder mechanics are built.

**🟥 R7 — The Explore design.** (map ⚑5; gates P4-8/P4-9.) **Explicitly parked 2026-07-14 for its
own dedicated session — not to be decided piecemeal.** Directional color given in the meantime:
Explore and Forecasting are two separate map layers, not one; Explore leans social ("finding
friends routes and exploring"), Forecasting is its own aspect entirely; the route builder's
placement (inside Explore or elsewhere) is bundled into the same "needs deep thinking" cluster,
including where a Routes-Sections primitive (R1) would live. M5/M6 still cannot start without
that session. Treat the mockup's arrival as settling only Record-mode chrome, **not** Explore.

**🟨 R8 — Offline tile terms** (map ⚑4; not gating any Phase 4 session). *Lean: self-hosted
Protomaps extracts* — `OfflineManager.createPack` collides with MapTiler's metered terms and
OpenFreeMap isn't an offline-pack origin. Deferred: no offline pass is scheduled in Phase 4.
Recorded here so whoever specs the first offline pass inherits it as a decision, not a surprise.

---

### P4-1 — SDK 53→56 + MapLibre v10→v11 upgrade · **Opus** (`/model claude-opus-4-8`)

**The spine of Phase 4, and the one piece of concrete unblocked engineering here.** Everything
Explore-dependent (P4-8/P4-9) and the 3D-terrain map you asked for both sit on v11's renamed
gesture/camera APIs and New-Architecture floor — the pinned v10.4.2 can't do them. No red boxes:
the *sequencing* question (map ⚑3) is decided by dependency (upgrade-first), and the sub-choices
inside (New Arch flip, library compat) are technical, decided in-session. **Do not run this
overnight on Fable — it's high-judgment debugging (New Arch, native module compat), the kind of
session you want to be present for.** Consider running it in a worktree so a half-finished
upgrade never blocks the ✅ track.

Reads: `master-plan.md` §6 (tooling table) + §4 item 26 · `research/routes-implementation.md`
§3 (the v10→v11 API-rename inventory and the SDK-56 floor) · `tabs/map-tab.md` §8 (platform
track) · the latest `dev-log/` handoff · `RouteMap.tsx` (documents the v10.4.2 pin) ·
`package.json` + `AGENTS.md` (which already points at SDK 56 docs while package.json pins ^53 —
reconcile that here).

```
Start in plan mode. Read planning/rework/phase4-session-playbook.md,
planning/rework/master-plan.md (§4 item 26 + §6 tooling table),
planning/rework/research/routes-implementation.md (§3 — the v10→v11 rename list and SDK-56
floor), planning/rework/tabs/map-tab.md (§8 platform track), src/components/**/RouteMap.tsx,
package.json, AGENTS.md, and the latest handoff in dev-log/.

Plan then execute the platform upgrade: Expo SDK 53→56 and @maplibre/maplibre-react-native
v10.4.2→v11. This is the New-Architecture flip (RN 0.85 / React 19.2 / Hermes v1) — verify
healthkit, reanimated, and react-native-screens compat under New Arch and pin/patch as needed.
Migrate every MapLibre call site to the renamed v11 API (MapView→Map, centerCoordinate→center,
zoomLevel→zoom, sourceID→source, OfflineManager subscribe→addListener and the restructured
createPack options) — RouteMap plus every map surface (Record, route detail, session detail
map-hero, spots pin layer). Reconcile AGENTS.md (SDK 56) vs package.json (^53). Keep the new
on-brand MapTiler style rendering. Do NOT build 3D terrain here — that's P4-2; this session is
the clean upgrade only.

Single-concern commits. Flag (⚑) anything ambiguous rather than reinterpreting.
Finish: full jest, tsc LAST, /code-review, sim smoke test (every map surface — Record live +
background, route detail, session detail, spots pins), then status-sync + dev-log-closeout
skills, and write me a handoff prompt for P4-2. Do not push without asking me.
```

---

### P4-2 — 3D terrain + v11 camera/gesture polish · Sonnet

The visible payoff of the upgrade: enable 3D terrain (hillshade + terrain-RGB DEM) on the new
MapTiler style now that v11 supports it, and settle any v11 camera/gesture behavior the upgrade
surfaced. Safe once P4-1 has landed; touches only the map presentation, no schema.

Reads: `planning/rework/phase4-session-playbook.md` · `tabs/map-tab.md` (§3 tile/key states,
§4 elevation) · `research/routes-implementation.md` (§3 tiles table + the DEM/terrain-RGB
options) · `planning/mapping-architecture-spec.md` (the layer contract, if present) · the P4-1
handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/tabs/map-tab.md,
planning/rework/research/routes-implementation.md (§3), and the latest handoff in dev-log/.
On the now-upgraded MapLibre v11 stack, enable 3D terrain on the on-brand MapTiler style:
hillshade + terrain-RGB DEM exaggeration, a tilt/pitch gesture on the map surfaces where it
reads well (Record pre-start, route/session detail heroes), and any v11 camera behavior the
upgrade left rough. Honest-gap rule holds: terrain elevation is DEM-derived and tagged as such,
never presented as measured. Keep the OpenFreeMap keyless fallback intact. No schema.
Single-concern commits.
Finish: full jest, tsc LAST, /code-review, sim smoke test (screenshot the 3D view on Record +
one route detail), then status-sync + dev-log-closeout skills, and write me a handoff prompt.
Do not push without asking me.
```

---

### P4-3 — Benchmark groups storage + pause/resume (B4) · Sonnet

Decision-proof and independent of the platform upgrade — safe to run today. Builds the groups
storage the benchmark system has been specced against but never got.

**🟥 R5 (group-management placement) is open but does NOT block this** — mount management on the
existing benchmark list surface interim; wherever it eventually lands (lean: Profile) is a later
move.

Reads: `benchmarks-templates.md` (§4 groups storage "obvious call", §6 pass B4, §8 ⚑5) ·
`src/storage/benchmarks.ts` + `core/src/benchmark.ts` · `src/storage/migrations/index.ts`
(claim the next-free number — currently 018 — at build time) · the latest handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/benchmarks-templates.md
(§4, §6 pass B4, §8 ⚑5), src/storage/benchmarks.ts, core/src/benchmark.ts,
src/storage/migrations/index.ts, and the latest handoff in dev-log/.
Build B4: benchmark groups storage + pause/resume. A benchmark_groups table + a many-to-many
membership join (relational facts, not a settings-KV blob — the spec's obvious call), a
per-group pause/resume toggle row, and the Home/Reflect-remnant framing effect (paused groups
drop their members from the glance without touching per-benchmark lifecycle; no celebration).
Independent of the benchmarks type decision — do not assume a type column exists. Claim the
next-free migration number at build time from src/storage/migrations/index.ts (do NOT hardcode).
Mount group management on the existing benchmark list surface for now — final placement is an
open flag (R5), not this session's call. Single-concern commits; flag don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test, then status-sync + dev-log-closeout
skills, and write me a handoff prompt. Do not push without asking me.
```

---

### P4-4 — Gear Quiver rework, display-only (P9) · Sonnet (or Fable overnight)

The Gear Quiver rework's *direction* is decided (`profile-settings.md` §2 "Gear Quiver rework"
— one quiver spanning all sports, Earth arms as an additive migration, last-used +
wear-vs-threshold read models, reserve-repack dates as date-keyed thresholds). There is **no
dedicated Gear Quiver spec file** — `profile-settings.md` is the named owner and defines the
scope; the read-model *UI* is sketched, not fully specced, so expect to make small presentation
calls in-session and flag anything that feels like a product decision. Deferred and low-risk
(display-only), which makes it a reasonable Fable overnight candidate if you'd rather walk away
from it.

**🟥 R6 (may the quiver ever remind?) is open but does NOT block this** — build **display-only**:
render the repack-due date and days-elapsed when the user opens the quiver; build **no**
notification mechanics until R6 is ruled.

Reads: `tabs/profile-settings.md` (§2 Gear Quiver rework, §6 pass P9, §8 ⚑7) · `app/gear.tsx` +
the `gear`/`kits` tables (migration 014) · `src/storage/migrations/index.ts` (next-free = 018 at
build time) · the latest handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/tabs/profile-settings.md
(§2 "Gear Quiver rework", §6 pass P9, §8 ⚑7), app/gear.tsx, src/storage/migrations/index.ts,
and the latest handoff in dev-log/. Note: profile-settings.md is the only spec that owns the
quiver — there is no standalone gear-quiver spec; treat the read-model UI as sketch-level and
flag (⚑) any real product call rather than inventing one.
Build P9, DISPLAY-ONLY: the cross-sport quiver over the existing gear/kits tables — Earth arms
(shoes, bikes + components, skis) as an additive migration (claim the next-free number at build
time from src/storage/migrations/index.ts; do NOT hardcode), plus two descriptive read models
over session gear refs: last-used ("what did I use last time") and wear-vs-threshold
(accumulated hours/mileage against the user's own service number, shown only when the quiver is
opened). Sky reserve-repack dates render as the same threshold shape keyed by date — show the
date and days-elapsed, and build NO reminder/notification mechanics (that's flag R6, unruled).
Single-concern commits; flag don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test, then status-sync + dev-log-closeout
skills, and write me a handoff prompt. Do not push without asking me.
```

---

### P4-5 — ~~Sections definition (T0 · paper/plan)~~ · NOT NEEDED

**Resolved away, 2026-07-14.** R1 answered "Section" as a Routes-only concept (a timed stretch
within a route) — Training never gets its own Sections primitive, so there is no T0 spec to
write and nothing for this session to do. A *Routes* Sections definition is real future work, but
it's bundled into the Explore/route-builder deep-think session (R7), not a standalone pass.

---

### P4-6 — Templates 3a application (T6, layout only) · Sonnet

**Unblocked 2026-07-14** — R1 (no Sections in Training) + R2 (3a, two lists) both resolved.
Applies the two-list layout as the grouping-wrapper swap on T2's shared skeleton. No Sections
primitive to build (R1), so no migration claim either.

Reads: `tabs/training-tab.md` (§3B shared skeleton, §6 T6) · `benchmarks-templates.md` (§10.3) ·
`app/(tabs)/training.tsx` + `edit-template.tsx` · the latest handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/tabs/training-tab.md (§3B, §6
T6), planning/rework/benchmarks-templates.md (§10.3), app/(tabs)/training.tsx,
app/edit-template.tsx, and the latest handoff in dev-log/.
Decisions already made (2026-07-14): 3a — two separate lists, one-offs get their own list,
Templates splits active/deactivated. Ordering not fully pinned (leaning one-offs → active →
deactivated, but confirm with me before locking it in). "Sections" is a Routes-only concept
(R1) — Training does not get a Sections primitive, filter chip, or migration; build the plain
two-list layout only.
Build T6: apply the layout decision as the grouping-wrapper swap on the existing shared library
skeleton — the data layer, cards, search, and empty state don't change, only the grouping
wrapper. Single-concern commits; flag don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test, then status-sync + dev-log-closeout
skills, and write me a handoff prompt. Do not push without asking me.
```

---

### P4-7 — Benchmarks type-decision application (B5) · Sonnet

**Unblocked 2026-07-14** — R3 (derived, no dropdown) + R4 (domain tab + a new type tab, not a
swap) both resolved. This session adds a Behavior/Outcome/Both view as a second tab alongside
the existing by-domain view — no schema change, no migration, purely derived + a new UI mode.

Reads: `benchmarks-templates.md` (§4 what a type column implies, §10.1, ⚑1) · `src/storage/
benchmarks.ts` + `core/src/benchmark.ts` (the B1 classifier is already shipped) ·
`src/storage/migrations/index.ts` (next-free at build time, only if a column lands) · the latest
handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/benchmarks-templates.md
(§4, §10.1, ⚑1), src/storage/benchmarks.ts, core/src/benchmark.ts, src/storage/migrations/
index.ts, and the latest handoff in dev-log/.
Decisions already made (2026-07-14): type stays fully derived, no schema, no dropdown, no
type-first creation flow — wire the existing B1 classifier into card badges. List layout is
NOT a straight 2a-vs-2b swap: keep the existing by-domain view as one tab and add a
Behavior/Outcome/Both view as a second tab/organization mode. Confirm this two-tab reading with
me before locking the exact UI if anything about it feels ambiguous once you're looking at the
real screen.
Build B5 to match: wire B1's classifier into card badges (no schema, no migration), and add the
by-type tab alongside the existing by-domain view via B3's wrapper swap.
Single-concern commits; flag don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test, then status-sync + dev-log-closeout
skills, and write me a handoff prompt. Do not push without asking me.
```

---

### P4-8 — Explore v1 (M5) · SUPERSEDED, see Notion

**2026-07-15: superseded.** R7 (the Explore design) landed as
`research/explore-forecasting-research.md` + `tabs/forecast-tab.md`, and the real,
filled-in build prompt (no more `[MY EXPLORE DESIGN]` placeholder) lives in the Notion
Active Work board as **▶ Map P1 — M5: Explore mode v1**, under the "🗺️ Explore & Forecast
— Build Map (START HERE)" row. That prompt is still 🟥 blocked on Dylan's E1 (landing
mode) + E2 (switcher form) answers, same gate this entry used to carry as R7. Run the
Notion prompt, not this one — this section is kept only so old links don't 404, and its
copy-paste block below is stale (references a design file that no longer exists in that
form).

<details><summary>Original entry (stale, kept for history)</summary>

**Blocked on 🟥 R7 (the Explore design) and on P4-1 (the upgrade).** The MVP's largest remaining
map rock. Do not design Explore ahead of Dylan — the mockup only settles Record-mode chrome. Run
as an Opus plan session against Dylan's delivered design, then hand the build prompt to Sonnet
(or Fable if it's shaped for an overnight run).

Reads: `tabs/map-tab.md` (§2 Explore stub, §7 M5, ⚑5) · Dylan's Explore/"Now" design (delivered
into the repo — this session cannot start until it exists) · `research/routes-implementation.md`
(watch-breadcrumb vocabulary, tiles) · the latest handoff.

```
Start in plan mode — no code until the plan is reviewed. Read
planning/rework/phase4-session-playbook.md, planning/rework/tabs/map-tab.md (§2, §7 M5, ⚑5),
[MY EXPLORE DESIGN — path to the delivered design], planning/rework/research/routes-implementation.md,
and the latest handoff in dev-log/.
Plan Explore mode v1 on the upgraded v11 stack: the browse map with layer toggles (spots, saved
routes, own traces; cohort layers stay Ring-4-gated), the mode switch appearing now that a second
mode exists, and the map tap-in creation doors — built to host the route builder (M6/P4-9) as a
mode/layer inside it, without building the builder here. Privacy holds: Body sessions never
render on any map surface. End with a build prompt I can hand to a build session (say whether it
suits Sonnet or an overnight Fable run). Do not push without asking me.
```

</details>

---

### P4-9 — Route builder in Explore (M6) + T3 `+ New Route` button · SUPERSEDED, see Notion

**2026-07-15: superseded.** Same reason as P4-8. The real build prompt is **▶ Map P6 — M6:
Route builder in Explore** on the Notion board, updated with the Sections future-proofing
note (research doc §2e / flag E5) that didn't exist when this entry was written. Blocked
on Map P1 (Explore must exist to host it) exactly as before.

<details><summary>Original entry (stale, kept for history)</summary>

**Blocked on P4-8 (M5 must host it).** The straight-line, tap-to-place waypoint builder inside
Explore — and once it's live, the `+ New Route → Map build mode` button finally appears on
Training's Routes shelf (T3 shipped without it, by design). **No migration** — the `routes`
table (016) already exists and plotted routes write `source: 'plotted'` into it; design undo/edit
around *waypoints* so a future `RoutePoint.kind` lands migration-free. Carries the shared
tap-gesture spike (shared with Spots pin placement; crosshair-button fallback stays specced).

Reads: `tabs/map-tab.md` (§5 route creation, §7 M6) · `research/routes-implementation.md`
(§3 map-tap gesture, §4 adopt list — RDP is already on the save-as-route path; honesty labeling)
· `tabs/training-tab.md` (§3C Routes shelf, §6 T3 — the gated `+ New Route` button) ·
`routes-spec.md` (if landed by D0) · the latest handoff.

```
Read planning/rework/phase4-session-playbook.md, planning/rework/tabs/map-tab.md (§5, §7 M6),
planning/rework/research/routes-implementation.md (§3 gesture, §4 adopt list),
planning/rework/tabs/training-tab.md (§3C + §6 T3), the P4-8 Explore build output, and the
latest handoff in dev-log/.
Build M6: the straight-line route builder inside Explore — tap-to-place waypoints (run the
on-device gesture spike under the upgraded stack; keep the crosshair-button fallback),
straight segments, no routing engine, no snap-to-trail, undo/clear on a WAYPOINT model, live
distance per waypoint with Strava-Manual-Mode honesty labeling ("distance as plotted — trails
may be longer"), no elevation number, save via creation doors 1+2. NO migration — write
source:'plotted' into the existing routes table (016); design the undo model around waypoints so
a future RoutePoint.kind is migration-free. Then wire Training's T3 `+ New Route → Map build
mode` button, which has been waiting on this pass. Single-concern commits; flag don't reinterpret.
Finish: full jest, tsc LAST, /code-review, sim smoke test (build a route, follow it, save-as-
route), then status-sync + dev-log-closeout skills, and write me a handoff prompt. Do not push
without asking me.
```

</details>

---

*After the ✅ track (P4-1 → P4-2, P4-3, P4-4) the app is on the modern platform with a 3D map,
grouped benchmarks, and a real cross-sport gear quiver. The 🟥 track (P4-5 → P4-9) completes the
templates/Sections system, the benchmarks type decision, and Explore + the route builder — each
as its red box is answered. Beyond Phase 4: Nutrition N2–N5 (after the PRO-63 merge), Social S1–S7
(the backend era), and the summoned-coach room (P7) remain their own future planning.*
