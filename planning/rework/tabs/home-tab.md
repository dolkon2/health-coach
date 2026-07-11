# Home tab — consolidated build spec

v1 — 2026-07-11. Part of the coordinated rework set under `planning/rework/tabs/`.
Consolidates `home-tab-spec.md` (home-branch, 2026-07-11, primary), the Pinned Spots
amendment (pins-routes-branch, 2026-07-11), the Notion hub's Home resolutions
(2026-07-11), and Dylan's locked nav decisions of 2026-07-11. Where this file and any
older Home text disagree, this file wins.

Sibling specs referenced: `training-tab.md`, `map-tab.md`, `nutrition-tab.md`,
`social-tab.md`, `profile-settings.md` (all under `planning/rework/tabs/`).

## 1. Purpose & constitution alignment

Home is **today at a glance, plus the fastest path to logging** — the first tab of the
locked five (Home · Training · Map · Nutrition · Social). Everything on it is pull:
either an action the user initiates (the log bar) or a descriptive statement about
today ("here is what today holds so far"). Home never volunteers a plan, target, or
nudge; nothing the app volunteers — no AI-authored content the user has not adopted —
ever renders here (ambient surfaces never show un-adopted programming — constitution
§ summoned coach; see the source-tag note on § 3's template card for why an adopted,
recurrence-tagged template is not an exception). The element picker makes the
four-dimensions framework the literal first branch of the core loop rather than a tag
applied afterwards, and the tier rules hold throughout: steps and sleep render as
tier-1/2 facts only, tier-3 wearable scores never appear, and no module defines what a
good day looks like.

## 2. Information architecture / layout

Two tiers, not one flat stack:

- **Tier 1 — action tier**: the log bar. Always present, needs zero data.
- **Tier 2 — glance tier**: today's modules, populated by whatever the user actually
  tracks. Designed for the fully-populated state first; untracked optional modules are
  **absent, not empty** (no greyed cards, no connect-your-device upsell, no zero-state
  guilt).

**Proposed layout, top to bottom (⚑1 — user must confirm, per locked decision #11):**

1. **Header** — date line; persistent top-right **avatar** (→ Profile) and **gear**
   (→ Settings). Neither is a tab (locked #1); see `profile-settings.md`.
2. **Log bar** — two buttons: Log Session · Log Food.
3. **Today's template card(s)** — only when a template is tagged for today.
4. **Pinned Spots glance** — condensed cards, capped at 3, ordered by
   most-recently-visited, under a "Spots →" header link to the full list.
5. **Benchmark progress** — pinned/active benchmarks with current standing, under a
   "Benchmarks →" header link to the full management list.
6. **Nutrition today** — calories or Focus-mode metric; target progress if targets set.
7. **Steps + sleep strip** — one single-line row, smallest type on the page, last.

Rationale for the ⚑1 proposal: Pinned Spots is a morning decision-driver ("is the
White Salmon runnable") whose glance value is time-sensitive, so it earns mid-page
card treatment; steps/sleep "feed the expenditure engine more than the eye" (locked
#9: deliberately non-headline), so they take the true bottom shelf as one quiet line.
The shelf competition between the two resolves as *different treatments*, not a swap.

**What the headline of Home is once the Stimulus Ledger leaves:** nothing numeric —
deliberately. The **Stimulus Ledger is removed from Home entirely** (locked #2: it is
a highly deferred surface, living in Settings as a tap-in; see `profile-settings.md`).
No summary metric replaces it, because any single headline number would rank the
user's day — a step toward defining success (§ The line you do not cross). Home's
headline is the **action tier plus whatever today actually contains**: on a day with a
tagged template, that card is the visual lead; on any other day, the log bar is. This
is the mirror shape: the top of Home is what you can do next and what today holds, not
a score.

**Explicitly NOT on Home** (reconciled against the shipped Today tab,
`app/(tabs)/index.tsx`, which today shows: weigh-in card + trend delta, pinned
benchmark cards, today's sessions with `reveal()` lines, food daily total + meal list,
full StepsCard + SleepCard, and three log buttons):

- **Weigh-in card + trend delta** — removed. Weigh-in lives in Nutrition/Trend; "Log
  Weight" was considered and dropped as a log-bar peer. Decision (obvious call): no
  weigh-in prompt on Home at all — a daily prompt is push, and the locked glance-module
  list (Notion, 2026-07-11) contains no weigh-in module.
- **Today's sessions list / recent entries** — removed. The logbook lives on Profile,
  and the logbook IS the social feed (locked #3). Decision (obvious call): Home shows
  no logged-entry list of any kind; today's food state appears only as the
  nutrition-today rollup, and sessions appear in the Profile logbook. The per-session
  `reveal()` contribution strings come off with the list (matches the Notion
  session-history-feed relocation note).
- **Meal list** — removed with the above; the Nutrition tab owns per-meal display.
- **Third log button** — the shipped three-button row (weigh-in / session / food)
  becomes two. A "Logbook" button was also considered and dropped (redundant once the
  logbook is on Profile).
- **Condensed Stimulus Ledger** — never lands (locked #2, noted above).
- **HealthKit connection state** — Decision (obvious call): moves to Settings; it is
  setup plumbing and Settings already lists it in the nav plan. Only the data (the
  strip) stays on Home.
- Anything AI-authored, any Profile/Settings content beyond the two header affordances.

**Floor vs optional layer** (the empty-Home rule): the floor needs no optional data —
log bar · Pinned Spots (cheap to seed) · benchmark progress (user-authored) · today's
template (user-tagged). The optional layer — nutrition today · steps/sleep — is
present-when-populated, absent otherwise. The true day-zero state (no sessions, spots,
or benchmarks) is an onboarding question, recorded and deferred, not a Home-layout one.

## 3. Components & states

**Log bar** — two equal buttons. No data dependency; no empty/loading/error states.

**Element picker sheet** (opens from Log Session) — one sheet, four element rows
(Earth / Sky / Water / Body). Earth/Sky/Water rows lead with the most-recently-used
activity in that element as the primary action; an inline `⌄` expands the row into
that element's activity list (from the existing registry, `src/lib/activity.ts`)
before anything launches. Body row reads "Templates / pick…". States:

- *Default*: most-recent activity per element, resolved from a local session-log scan
  cached on Home focus so the sheet opens instantly.
- *No history in an element*: the row shows the archetype activity (Earth → trail run,
  Sky → paraglide, Water → kayak) — voice anchor only, freely changeable, no "counts
  more" logic anywhere (⚑2).
- *Scan unresolved/error*: fall back to archetype labels; never block the sheet.

**Today's template card** — renders only when a template's recurrence tags today; one
tap drops into logging that session. Multiple due templates stack with equal weight,
no priority ranking; missed days clear silently (empty days are neutral). No tag → no
card (absent, not empty). This is the only place recurrence surfaces — there is no
planner anywhere. Error state: none (local read); a deleted-but-tagged template simply
doesn't render.

Source-tag note (Decision, obvious call): a recurrence-tagged template renders here
regardless of its source tag — user-built, PT-prescribed, or coach-drafted-and-adopted.
User adoption plus the user's own recurrence tag is what puts it in the due stack; the
card reflects the user's schedule, not app-volunteered programming. § 1's ambient ban
applies to *un-adopted* AI output, which never reaches the template store on its own
(constitution § summoned coach: output is a draft that enters the library only when the
user adopts it, exactly like a PT-prescribed plan). Builders must not "fix" § 1 by
filtering source-tagged templates out of the due stack — that would cripple the
connected-external-plan entry state ("two entry states, not two products").

**Pinned Spots glance** — condensed card per spot: pin + title + sport tag + headline
live reading (weather always; gauge/wind/swell when the sport maps to one). States:
*loading* — card renders name + sport immediately, reading shows last-cached value
with an updated-at stamp, or "—" if none; *offline/error* — "—" per feed with the
stamp (both conditions clients already fold errors to null); *zero spots* — Decision
(obvious call): a single quiet "Pinned Spots →" row into the spots list where creation
lives; no upsell copy (it's a floor module, so it keeps a one-line presence rather
than vanishing). Full behavior: `pinned-spots-spec.md` (pins-routes version) and
`map-tab.md` for creation surfaces.

**Benchmark progress** — pinned/active benchmarks with current standing, reusing the
shipped `BenchmarkStatusCard` family, under a **"Benchmarks →" header link** (same
idiom as "Spots →") into the full benchmark management list. With the old Training
tile superseded, this link is the management list's specced entry point
(`benchmarks-templates.md` §2 surface 3, §5) — interim target is the shipped
`app/benchmarks.tsx`, replaced by B3's list container v2 when it lands. Zero active
benchmarks → cards absent (creation lives in Training-side flows; see
`training-tab.md` and the open Benchmarks decisions, locked #12 — this module inherits
whatever list/type decisions land there); Decision (obvious call): the "Benchmarks →"
link keeps a one-line presence even at zero, same floor-module treatment as the
zero-spot row, since it is the only door to the management surface.

**Nutrition today card** — total calories; if targets are set, consumed-of-target
primary, remaining secondary — the same card idiom and the same three-valued day
engine (hit/missed/unknowable) as the Nutrition tab; never re-derived. **Focus mode
aware**: a Focus-mode user sees their one metric here and nothing else. Presence rule
(obvious call): renders if any food entry exists today or a target is set; otherwise
absent. "Unknowable" renders honestly (null ≠ 0).

**Steps + sleep strip** — one line, secondary type scale, low on the page: sleep
*hours* and step *count* only. Tier-3 staged-sleep or readiness scores never render
(locked #9). Presence: HealthKit connected and at least one of today's values exists;
otherwise absent. Values refresh via the existing throttled poll-on-open; stale values
keep rendering (they're facts) — no spinner. Non-interactive at MVP.

## 4. Data touchpoints

Home owns **no migrations and no new tables**; every module is a read-model over
existing stores, and Home writes nothing except through the loggers it opens.

- **Most-recent-activity-per-element**: JS scan over session observations (same
  rationale as `listSessionsForSpot` — payloads are JSON blobs, single-user local DB).
  Computed on Home focus, cached in memory for the sheet.
- **Today's-template due stack**: recurrence as a per-template property on
  `session_templates` (JSON payload addition — optional-only, migration-free per the
  Phase-4 seam). The property itself is owned by `training-tab.md`.
- **Nutrition today**: reuses the Nutrition tab's three-valued day engine and
  `dailyTotals`; Focus mode is the existing `nutritionFocus` display setting in the
  settings KV — display-only, full macro capture continues underneath (invariant).
- **Pinned Spots glance**: `spots` table + migration **015 `spots_sport`** (owned by
  the Spots track, not Home) + the new display-path conditions module
  (`src/lib/conditions/current.ts`: in-memory ~10-min TTL, pull-to-refresh bypass,
  **never writes** to `conditions_snapshots` or session payloads — those are freeze
  stores).
- **Steps/sleep**: Phase-3 Pass-2 HealthKit adapter — steps + sleep-hours
  Observations, wake-day attribution, source-precedence dedup, poll-on-open only.
  Connection state and permissions read from `wearable_state` + settings KV, surfaced
  in Settings (not here).
- **Benchmarks**: shipped `benchmarks` table (007/008 faces). No `type` column exists;
  this module must not assume one (locked #12).

## 5. Interactions & cross-tab flows

Locked routing (verbatim, decision #6): **Log Session opens an Earth/Sky/Water/Body
element picker; Earth/Sky/Water rows lead with most-recent activity, route to Map
Record with sport armed; Body routes to Training template/session selection.**

- **Earth / Sky / Water row tap** → Map tab, Record mode, chosen activity armed,
  element's sport context loaded (relevant map layers, relevant Pinned Spots). Sport
  remains switchable on Map before pressing record — the picker's choice is a default,
  not a lock (whether that's a sub-tab or header control is Map's shell decision; see
  `map-tab.md`). GPS capture lives on Map (locked #7); Home only deep-links. One open
  carve-out (⚑4): non-GPS-surface activities that are Earth/Water by dimension (indoor
  climbing, pool swim) may route to the logger directly instead of Map Record — until
  that call lands, do not hard-code dimension → Map Record for the `⌄` expanded
  activity list.
- **`⌄` tap** → expands that element's activity list; choosing routes as above with
  that sport armed. Common case one tap; switching costs one more, never a detour.
- **Body row tap** → Training, template/session selection. Body never routes to Map
  (non-geographic infrastructure + the GPS privacy line — constitution § four
  dimensions).
- **Interim routing** (until the Map Record shell exists): Earth/Sky/Water route to
  the current session logger (`log-session`) with the activity pre-selected —
  functional, swapped later, so Home is never blocked on Map (⚑ carried from
  home-tab-spec, resolved as this two-step build). The interim applies to **E/S/W
  only**: Body routes to Training from day one (the tab's existing template/session
  screen — templates and session start already live there), matching locked #6; the
  parameterized Start-focused presentation upgrades that handoff when `training-tab.md`
  T5 lands. Body never uses the `log-session` interim. Coordination note:
  `training-tab.md` §5 currently describes the Body interim as `log-session` and cites
  a stale "home-tab-spec ⚑1" — that text must be aligned to this paragraph (the
  interim-routing flag was resolved; ⚑1 in this file is the shelf layout).
- **Log Food** → the existing nutrition logger. Done.
- **Today's template tap** → straight into logging that session. Decision (obvious
  call): routing follows the element rule — Body-surface templates open Training-side
  logging; an Earth/Sky/Water-surface template arms Map Record with the template shape
  loaded (interim: current logger, same as above).
- **Nutrition card tap** → Nutrition tab (Intake). **Spot card tap** → spot detail;
  "Spots →" → spots list. **Benchmark card tap** → benchmark detail; **"Benchmarks →"**
  → the full benchmark management list (Home's pinned strip is its entry point —
  `benchmarks-templates.md` §5).
- **Avatar** → Profile (logbook lives there — locked #3); **gear** → Settings
  (Stimulus Ledger tap-in lives there — locked #2).
- **Pull-to-refresh** on Home: bypasses the conditions TTL for visible spots and
  triggers the throttled HealthKit poll.
- Deferred, recorded: **tap-a-route-to-start** (a saved route as a Record entry point,
  post-Routes; same pull, place-based family as Spots). Not in this build.

## 6. Build passes

Ordered; each independently shippable. All except H6 can land on the current
`app/(tabs)/index.tsx` before the 5-tab shell swap (the Today→Home rename rides with
whichever lands first — pure nav work, no storage implication).

- **H1 (M) — log bar + element picker.** Two-button bar; element picker sheet with
  most-recent-per-element scan, `⌄` expansion, archetype fallbacks; interim routing
  per §5 (E/S/W → `log-session` pre-selected; Body → Training's existing
  template/session screen — never `log-session`). Prior art: the Training tab's
  `elementSections()` grouping.
- **H2 (M) — glance-tier pivot.** Remove weigh-in card, today's-sessions list, meal
  list, third button; add nutrition-today card (day-engine reuse, Focus-aware);
  restyle pinned benchmarks as the progress module with the "Benchmarks →" header
  link (interim target `app/benchmarks.tsx`); presence rules (absent, not empty).
- **H3 (S) — steps/sleep demotion.** Replace StepsCard + SleepCard with the
  single-line strip; move HealthKit connection state to Settings.
- **H4 (M) — Pinned Spots glance.** Condensed cards + "Spots →" link; live readings
  via the display-path conditions module. Requires Spots passes P1–P2 (migration 015,
  `current.ts`, spots list) from `pinned-spots-spec.md`.
- **H5 (S) — today's template card.** Requires the recurrence property from
  `training-tab.md`.
- **H6 (S) — Map Record deep-link swap.** Replace interim routing with the real
  Map-Record handoff (sport armed + element context). Requires the Map Record shell.

## 7. Dependencies

- **`map-tab.md`**: Record-mode shell (H6); spot creation surfaces (pin picker,
  save-as-spot) that feed the glance.
- **`training-tab.md`**: Body-row destination (template/session selection surface);
  per-template recurrence property (H5); benchmark creation/management flows.
- **`nutrition-tab.md`**: the three-valued day-engine target-status component Home
  reuses; Focus-mode semantics (display-only invariant).
- **`profile-settings.md`**: Profile avatar surface + logbook (destination of Home's
  removed content); Settings tap-ins for the Stimulus Ledger and HealthKit connection
  state.
- **Spots track** (`pinned-spots-spec.md`, pins-routes version): P1–P2 gate H4.
  Migration numbering: 015 spots_sport / 016 routes are reserved; Home claims none.
- **Rebrand track** (locked #13): the element picker consumes the `element: { earth,
  sky, water, body }` token group, which does not yet exist in `src/theme/tokens.ts`.
  That group is **owned by `brand-integration.md` Pass 2** (semantic names +
  declared-throwaway placeholder values, both palettes) — Pass 2 is H1's soft
  prerequisite, and H1 consumes it rather than shipping its own; if H1 lands first, it
  creates the group *per Pass 2's definition* (same keys — the `Element` literals from
  `src/lib/activity.ts` — and the same placeholder mapping), leaving brand-integration
  the single owner of the token shape. Mechanics only, no visual finalization here. No
  Home pass blocks on the rebrand itself (Pass 2 is deliberately kit-independent).
- **Research**: none required. The MapLibre long-press spike belongs to Spots/Routes,
  not Home (the glance renders no map).

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 Shelf layout** (flag mandated by locked #11): confirm the proposed order —
  template card → Spots glance (condensed cards, cap 3, "Spots →" link) → benchmarks →
  nutrition → steps/sleep as a single bottom line. Specifically: (a) condensed spot
  *cards* vs a plain "Spots →" *link*; (b) Spots above benchmarks/nutrition; (c)
  steps/sleep pinned to the very bottom as the resolution of the shelf competition.
- **⚑2 Archetype defaults for new users** (carried, deliberately kept): element rows
  default to the archetype sport before any history exists — voice-level only, but the
  one place the app "suggests" an activity; kept because an empty row is worse and
  it's changeable inline.
- **⚑3 Template ↔ benchmark card merge**: when a benchmark is tied to today's tagged
  session, do the two cards merge into one "active today" module or stay two? Notion
  lists it open; genuinely contestable — not decided here.
- **⚑4 Non-GPS Earth/Water starts** (shared with `training-tab.md` ⚑3 /
  `map-tab.md` ⚑6): indoor climbing and pool swim are Earth/Water by dimension but
  have no GPS shape, so Map Record is the wrong destination for them. Proposal on the
  table (from those specs): routing follows the *logging surface*, not the dimension —
  the element picker's expanded activity list sends non-GPS-surface activities to the
  logger directly (Map Record could equally offer a "log without GPS" escape). Needs
  your call; Home owns the picker, so H1/H6 must not bake in unconditional
  E/S/W → Map Record for the expanded list until this lands (§5 carries the caveat).

## 9. Open questions

- Day-zero onboarding state (no sessions, spots, or benchmarks) — recorded, deferred;
  an onboarding question, not a Home-layout one.
- Steps/sleep strip tap behavior — non-interactive at MVP; does it ever earn a
  destination (e.g. a trend view), and where would that live?
- Whether the zero-spot floor row ("Pinned Spots →") survives contact with the
  day-zero design, or folds into onboarding.
- Home inherits, without deciding: the Benchmarks `type`/layout questions (locked #12)
  for module 5's rendering, and the Reflect no-benchmark-default question insofar as
  any Reflect remnant ever wants a Home door (none specced here).
