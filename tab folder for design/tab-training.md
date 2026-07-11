# Training Tab

Your saved shapes, planned or not — the programming place. You author the structure; the app never generates it. Fuel lives on Nutrition; geometry capture/build/follow lives on Map.

## Current shape / status

- Bottom nav position: 2nd of 5. Status: "Live — redesign in progress."
- **No top-swap.** The earlier "Templates ↔ Routes & Sections" top-swap plan is superseded (2026-07-11) — Pinned Spots moved off this tab entirely (now on Home), so Templates and a simple "Routes →" list link can both sit here as plain sections, no swap mechanism needed.
- Retrospective surfaces (logbook, benchmark management, stimulus view) are explicitly **overflow** — pulled out of Training, tab-home deferred until Map + Nutrition are fully known. Where they land (Profile is the parking candidate) is an open question.
- A `planning/routes-spec.md` build doc is referenced repeatedly in Notion ("Full build spec landed 2026-07-11") but **was not found in this repo checkout** — flag this gap before designing the Routes list/builder.

## Structural pieces / modules

- **Templates** — structured saved shapes, any dimension (gym splits, PT protocols, a yoga flow, or something as light as "flatwater, 8 km"). Blank-slate: user builds it; set numbers prefill from the user's own last performance (Strong's "Previous" column pattern) — no app-suggested progression.
- **Routes list** — a simple "Routes →" link into saved geometry (river section, flight site, mapped loop). Browsed/reused from here; **created on Map**, not here.
- **Per-template recurrence** — a repeat rule ("repeats M/W/F") set on a template, invisible on Training itself; it only surfaces on **Home** as today's due stack. No week-grid UI here.
- **Pinned activities** — one shared preference (not per-picker) that surfaces primary sports first across every picker (activity picker, Map Record one-tap start, Home quick-log).

## Full-screen features needing their own design pass

### Templates library
"My Templates" vs. clearly-marked starter examples (ships empty — Strong-style, no "recommended for you"). Create / edit / delete.

### Live session from a template
Light preview (Start / top-right Edit) → live logging with sets prefilling from last performance → free mid-session edits (swap equipment, etc.) → save-time fork: **update the template** or **keep as a one-off**. Same flow whether entered from a Home due-item tap or a Templates tap — one preview, two doors.

### Instant / unstructured log entry
The "start fresh" door: an empty gym session, or an Earth/Sky/Water pick that routes to Map Record. Same picker as Home's Log Session.

### Routes list + detail
Thin "Routes →" list (name, distance, elevation, static thumbnail — Strava "Routes" list is the reference shape). Build/view/follow logic lives on Map; this list is browse-only. Needs its own design pass once `routes-spec.md` is confirmed/located.

### Recurrence setup
Per-template repeat-rule editor (which days) — small but its own control, feeds Home's due stack.

## Open decisions

- **Logbook location** — latest thinking is overflow *out* of Training entirely, but this conflicts with the Map tab's plan, which assumes session history stays on Training. Needs resolution before the Map-hero session detail can be scoped correctly.
- Recurrence-on-Home surfacing details (equal-weight stack, no priority ranking — confirmed direction, but visual treatment undecided).
- Routes-vs-templates data seam: does a saved route live inside the template entity, or as a sibling the template references? ("Tuesday paddle" template pointing at a route.)
- Indoor climbing & pool swim classification — both resist the Template/Route split (set-based but Earth-tagged; geometry-less but Water-tagged). Left open.
- Benchmark groups (named, pausable bundles) — extends `benchmarks-spec.md`, not yet built.
- `planning/routes-spec.md`, cited in Notion as landed, is missing from the repo — confirm before treating Routes list/builder scope as final.

## Out of scope

- The app never authors or recommends a template, split, or plan — library ships empty.
- No week-grid calendar view — recurrence is a per-template property surfaced only on Home.
- Route/geometry building, viewing, and following — all live on Map, not Training.
- Pinned Spots — moved entirely to Home (see `tab-home.md`).
- Fuel/nutrition logging — lives on Nutrition tab.
- Seasonal/annual benchmark windows ("150 flying days this year") — explicitly deferred, not now.
- Nutrition planning / meal templates — parked, no tab home yet.

## Sources used

- Notion: "Training" page (full game plan, MVP build order, post-MVP, key questions), "Pages and Features" (Training summary row).
- Repo: `planning/benchmarks-spec.md` (Plan container, cadence/behavior-face mechanics, saved scaffolds), `planning/pinned-spots-spec.md` (confirms Spots moved off Training), `planning/training-logging-spec.md` (activity picker, session logging surfaces), `planning/phase-6-plan-tab-spec.md` (headers only skimmed — library/plan-flavor mechanics referenced by benchmarks-spec.md).
- Gap: `planning/routes-spec.md` referenced by Notion as authoritative and landed, not present in repo.
