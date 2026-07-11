# Home tab — design spec

v1 — specced with Dylan 2026-07-11 (voice session). Home is the first of the five new tabs
(Home · Training · Map · Nutrition · Groups) to get a full talk-through. This resolves the
Notion open decision #1 (activity-picker location / one-tap-log routing) and sets the module
list for the Home redesign.

Constitution check: everything below is pull/glance — Home never volunteers a plan, target,
or nudge. Every module is descriptive ("here is today so far") or an action the user initiates.

## What Home is

**Today at a glance, plus the fastest path to logging.** Two tiers, not one flat stack:

1. **Action tier** — the log bar. Always present, needs zero data.
2. **Glance tier** — today's modules. Populated by whatever the user actually tracks.

Explicitly NOT on Home:
- **Logbook / recent-logs list** — moves toward Profile (decided 2026-07-11; coordinates with
  the Training "logbook overflow" thread).
- **Profile/Settings content** — persistent top-right avatar + gear only, per the 2026-07-09
  nav decision.
- Anything AI-authored or prescriptive (constitution — ambient surfaces never show programming).

## Tier 1 — the log bar

Two buttons: **Log Session** and **Log Food**.

- **Log Food** → the existing nutrition logger. Done.
- **Log Session** → element picker (see below). This is the resolution of open decision #1.

Considered and dropped: a third "Logbook" button (redundant once recent-logs lives on
Profile); "Log Weight" as a peer button (weigh-in stays inside Nutrition/Trend).

### The element picker — Log Session flow

The first branch of the flow is the **dimension** (Earth / Sky / Water / Body), not the
activity. This makes the four-dimensions framework the literal shape of the core loop, not a
tag applied afterwards.

One sheet, four element rows. Each Earth/Sky/Water row leads with the **most recently used
activity in that element** as its primary action, with an inline affordance to pick a
different sport *before* anything launches:

```
┌──────────────────────────────────────┐
│  Log a session                        │
│                                       │
│  🌍 Earth   →  Trail Run        ⌄     │   tap row: Map, trail-run armed
│  🪂 Sky     →  Paraglide        ⌄     │   tap ⌄: sport list for that element
│  🌊 Water   →  Kayak            ⌄     │
│  💪 Body    →  Templates / pick …     │   tap row: Training session selection
└──────────────────────────────────────┘
```

Routing rules:

- **Earth / Sky / Water → Map tab, Record mode**, with the chosen activity armed and the
  element's sport context loaded (relevant map layers, relevant Pinned Spots). GPS-capture
  surfaces already live on Map per the mapping plan — Home just deep-links into them.
- **Body → Training**, into template / body-session selection. Body never routes to Map
  (Body is non-geographic infrastructure — constitution § four dimensions, and the privacy
  line: fixed indoor locations don't belong on a map surface).
- **Sport is pickable before starting.** The `⌄` expands the element row into that element's
  activity list (from the existing activity registry, `src/lib/activity.ts`). Choosing one
  routes exactly as above with that sport armed. The default (most-recent) makes the common
  case one tap; switching costs one more tap, never a detour.
- **Sport remains switchable on Map itself** before pressing record — the picker's choice is
  a default, not a lock. (Whether Map exposes this as a sub-tab or a header control is Map's
  shell decision, not Home's.)
- Most-recent-per-element resolves from the session log (latest session whose activity maps
  to that element). A brand-new user with no history sees the element's archetype activity
  (Earth → trail run, Sky → paraglide, Water → kayak) — voice anchor only, freely changeable,
  no "counts more" logic anywhere.

Deferred, recorded: **tap-a-route-to-start** — once Routes ship (`routes-spec.md`, per
Notion), a saved route becomes another entry point that jumps straight into Map recording
with the route loaded. Same family as Pinned Spots (place-based, pull, zero-friction). Not in
this build.

## Tier 2 — the glance modules

Design assumption per Dylan: **design for the fully-populated state first**; the
degraded/absent states are real (see § The empty-Home problem) but don't drive the layout.

In order of current thinking (ordering itself stays an open layout call):

1. **Nutrition today** — total calories; if targets are set, progress toward them
   (consumed-of-target primary, remaining secondary — same card idiom as the Nutrition tab;
   respects Focus mode: a Focus-mode user sees their one metric here, nothing else).
   Tap → Nutrition tab.
2. **Pinned Spots glance** — the watchlist: pinned location + title + sport tag, live
   conditions (weather always; gauge/wind/swell when the sport maps to one). The
   "open it in the morning, is it runnable" behavior. Full spec: `pinned-spots-spec.md`.
   Exact rendering (condensed cards vs. "Spots →" link) still open there; Home reserves the
   slot either way. Tap a spot → spot detail.
3. **Today's template** — if a template/session is tagged for today, it auto-surfaces as an
   active card; one tap drops straight into logging that session. This is the resolution of
   the "recurrence-on-Home surfacing" thread. Descriptive framing: it appears because *the
   user* tagged today — the app is surfacing their own plan, not issuing one. No tag, no card
   (absent, not empty).
4. **Benchmark progress** — pinned/active benchmarks with current standing. User-authored by
   definition, so it's the module that works without a wearable or food logging.
   Tap → benchmark detail.
5. **Steps + sleep** — present but **deliberately non-headline**: small, low on the page,
   secondary type scale. They feed the expenditure engine more than the user's eye. Sleep
   *hours* and step *count* only (tier-1/2); any wearable "scores" stay tier-3 and off Home.

Open layout calls (deliberately not resolved here):
- Module ordering / above-the-fold priority.
- Whether "today's template" and "benchmark progress" merge into one "active today" module
  when a benchmark is tied to the tagged session, or stay two cards.
- Whether the condensed Stimulus Ledger keeps a Home slot at all now that Reflect is a
  tap-in (leaning: no — it competes with Pinned Spots for the same shelf).
- HealthKit connection state currently renders on Home; it likely migrates to Settings
  (already listed there in the nav plan) leaving only the data itself here.

## The empty-Home problem (flagged, partially deferred)

Dylan's stated concern: many real users won't log food and won't own a wearable. Home must
not feel empty or reproachful without them.

The structural answer is a **floor that needs no optional data**:

- Floor (always real): log bar · Pinned Spots (cheap to seed) · benchmark progress
  (user-authored) · today's template (user-tagged).
- Optional layer (present-when-populated): nutrition today · steps/sleep.

Rule for the optional layer: **absent, not empty**. An untracked module renders nothing — no
greyed-out card, no "connect your device" upsell, no zero-state guilt. (A quiet "add" path
can live in Settings/Nutrition where the user already goes to set things up.)

Deferred: the true day-zero state (no sessions, no spots, no benchmarks) is an onboarding
question, not a Home-layout one. Recorded here so it isn't lost; not designed in this pass.

## Build notes (for whenever this gets sequenced)

- Current shipped Home is `app/(tabs)/index.tsx` ("Today", 4-tab era). This spec targets the
  5-tab shell; the element picker + glance modules can land incrementally on the current tab
  before the shell swap.
- Element picker needs: most-recent-activity-per-element query (session log scan, same
  pattern as `listSessionsForSpot`), activity registry grouped by dimension (exists —
  dimension tags shipped with the dimension merge).
- Earth/Sky/Water deep-link depends on the Map tab shell existing (Record mode). Until then,
  the picker can route to the current session logger with the activity pre-selected —
  functional, swapped later.
- Nutrition-today card should reuse the Nutrition tab's target-status component (three-valued
  day engine) rather than re-deriving.

## Flags ⚑ (for Dylan)

1. **Map-shell dependency** — the E/S/W routing lands properly only once Map Record exists;
   interim routing to the current logger is specced above so Home isn't blocked.
2. **Stimulus Ledger eviction** — this spec leans toward dropping the condensed ledger from
   Home; confirm at the Reflect/Training talk-through since it partially answers "where do I
   see my week."
3. **Archetype defaults for new users** — element rows default to the archetype sport before
   any history exists. Voice-level only, but it's the one place the app "suggests" an
   activity; kept because an empty row is worse and it's changeable in-line.
