# Benchmarks & Templates — the two cross-cutting open systems

*Part of the 2026-07-11 rework set (siblings under `planning/rework/tabs/`). The core
decisions here are **genuinely open by explicit instruction (locked #12)**: the Benchmarks
`type` field + list layout, and the Templates library 3a/3b shape. The job is NOT to decide
— it is to frame each decision crisply and spec the decision-proof prerequisites so building
starts before decisions land. Sources: `benchmarks-spec.md` v0.4/v0.5,
`core/src/benchmark.ts`, `src/storage/benchmarks.ts`, `core/src/sessionTemplate.ts`, Notion
Benchmarks + Templates & Sections rows (2026-07-10/11).*

## 1. Purpose & constitution alignment

Benchmarks are the goal layer — user-set, resolved to a trackable dimension, two faces
(behavior = tier-1 rhythm, sovereign; outcome = tier-2 movement, observed never moralized).
Templates are the saved-scaffold layer — user-authored recipes, never Observations, a
library that ships empty. Both make the constitution concrete: no app-authored goals, no
recommended templates, consistency counters that are factual counts never streaks, numeric
targets living on benchmarks and never on templates (a template with a target is one slip
from a program). The open decisions below are layout and classification questions; none of
the options crosses a constitutional line, with one exception flagged hard in §8 (⚑1: a
*type-first creation flow* would break v0.4's "the user never picks a type" — that takes a
deliberate amendment, not a quiet drift).

## 2. Information architecture / layout

**Benchmarks: one object, four surfaces.**

1. **Home** — pinned/active benchmarks as the progress glance module (`home-tab.md` module
   5). Behavior face reads as a factual count ("kayak: 2/4 this week"); outcome face as an
   observation ("trending down, 1.2 kg to go").
2. **Creation** — contextual, never hub-first: cadence benchmarks spawn from Training-side
   flows (`training-tab.md` ⚑4); a nutrition target is created in one gesture *as* the
   adherence benchmark (`nutrition-tab.md` N2); Described/Coach entry layers arrive Phase 7.
3. **List + detail (tap-in)** — the management surface, reached from Home's pinned strip
   (the old Training tile is superseded). The list's grouping is the open 2a/2b decision;
   the detail sheet is decision-proof (§3).
4. **Reflect (residual)** — the benchmark stays Reflect's layout key wherever Reflect's
   remnant lands. The no-benchmark default is dangling since the ledger moved to Settings
   (locked #2). Flagged, not decided (⚑4).

**The two contested list layouts (2a vs 2b) — defined here, traded off in §10.2:**

- **2a grouped-by-domain**: sections keyed by what the benchmark is *about* — the resolved
  dimension's home turf (kayaking, strength, bodyweight/nutrition; or the four elements
  where a dimension maps to one).
- **2b grouped-by-type**: sections keyed by the proposed Outcome / Compliance / Trend
  classification. Note: 2b cannot render until the type question (⚑1) resolves.

**Templates: Training-tab content.** The library lives on Training (section B of
`training-tab.md`, which owns the screen); this spec owns the system framing. The contested
shape (traded off in §10.3):

- **3a two lists**: "Templates" and "Sections" as separate headed lists — two object kinds,
  full session recipe vs reusable sub-block.
- **3b unified stream**: one list of reusable assets with kind filter chips
  (All / Templates / Sections) and a kind glyph per card.

**Definitional gate the 3a/3b decision hides:** "Sections" is used two ways in the record.
The 2026-07-10 "Routes & Sections" meant saved *geometry* — since fully absorbed (river
sections are `spots` rows with `kind='river-section'`; lines are the `Route` entity,
migration 016). The Notion row's "no reusable 'Sections' primitive" reads as the other
meaning: a reusable *block of work* smaller than a template (hangboard warmup, core
finisher) that composes into templates. Decision (obvious call): the geometry meaning is
dead — Spots and Routes own it. So 3a/3b is two stacked questions: *what is a Section (if
anything)*, then *how does the library render*. §10.3 briefs both.

## 3. Components & states

Everything here is decision-proof: identical work under either 2a/2b and either type
outcome.

- **`BenchmarkCard`** — restyle of the shipped `BenchmarkStatusCard` family: title (user's
  own words), per-face status line in the two registers, consistency counter as a plain
  number (resets without drama; no flame, no animation), optional classification badge from
  §4's derived classifier. *Empty*: one descriptive line — "Benchmarks you set appear
  here" — no hub CTA (creation is contextual). *Loading*: skeleton cards (local SQLite,
  sub-100ms, still specced). *Error*: inline retry row; Home's glance module independently
  degrades to absent-not-empty.
- **List container with a pluggable group-by wrapper** — the same trick `training-tab.md`
  T2 uses for 3a/3b: cards, search (at ≥10 items), status filter, and states built once;
  2a/2b differ only in the grouping key. Pre-decision rendering is the current flat list
  (pinned first, then `createdAt` desc) — deliberately neither, so nothing pre-empts the
  call.
- **Benchmark detail sheet** — shared under every outcome: hero = outcome face when both
  faces exist (v0.4 rule), behavior rhythm beneath as consistency context; face history;
  lifecycle actions (pause / done / reactivate); group membership chips once groups ship.
  Also a *candidate* home for nutrition adherence history — built so a history panel can
  mount, without deciding that question (locked #12d; owned by `nutrition-tab.md` ⚑1).
- **Group pause/resume switch** (v0.5) — a plain toggle row; pausing drops members from
  Home and Reflect framing without touching per-benchmark lifecycle. No celebration.
  *Empty*: groups ship empty, user-built only.
- **Templates components** — owned by `training-tab.md` §3B (TemplateCard, search,
  save-as-template sheet, recurrence chip). This spec adds none; it only constrains
  Sections (§4) to stay layout-agnostic.

## 4. Data touchpoints (descriptive, no code)

**Benchmarks as shipped:** `benchmarks` table (migrations 001 + 007 + 008), eleven columns
ending in the v0.4 `behavior`/`outcome` face blobs and `pinned`; `src/storage/benchmarks.ts`
exposes create/list/get/update with a spread-merge patch and a ≥1-face serializer gate. The
status union is `active | achieved | abandoned | paused` — **no `archived`, no `type`
column, no groups storage**. The nutrition dimensions (`calories`, `macro`, `days`/`share`
measures) are *already in the core union* — Compliance-shaped benchmarks already exist
structurally as behavior faces; only the unbuilt phase-5-pass-2-6 pieces (`archived` status
+ soft-archive migration, renumbered off the stale "M010") remain.

**What the `type` column option implies for `src/storage/benchmarks.ts` (descriptive):** a
new migration (claimed at build time — next free is 017; 015/016 reserved; do not
pre-assign); the COLUMNS list, both INSERT and UPDATE statements, the row serializer pair,
and the core `Benchmark` type all gain the field; plus a backfill question — derive from
faces at migration time, or leave null and classify at read. The derive-at-read alternative
(§10.1 option B) touches **zero** of this.

**Decision-proof classifier (the load-bearing prerequisite):** a pure core function mapping
faces to labels — behavior face (count/magnitude/days/share measure) → *Compliance*; outcome
face with `target` threshold → *Outcome*; outcome face direction-only → *Trend*. Needed by
2b (its grouping key), useful to 2a (card badges), and required under *both* type outcomes
(runtime source if no column lands; backfill source if one does). It returns **per-face**
labels — a dual-face benchmark is Compliance *and* Outcome — itself evidence in §10.1.

**Groups (v0.5):** storage not designed. Decision (obvious call): a small
`benchmark_groups` table + a many-to-many membership join, not a settings-KV blob —
membership and per-group pause are relational facts. Claims its migration number at build
time. Independent of the type decision.

**Templates as shipped:** `session_templates` (migration 005); shapes for five surfaces,
editor coverage only gym + endurance; recurrence fields stored, unconsumed; numeric targets
deliberately absent from templates forever (benchmark concept). Additions ride the JSON
shape migration-free per the Phase-4 seam. **Sections primitive:** zero entity, storage, or
editor. Constraint from this spec: whatever shape it takes (own table — a migration-number
claimant — vs JSON-referenced blocks inside templates), it must carry a name, a surface,
and its own identity, so it renders as either a peer list (3a) or a kind-tagged card (3b).

**Sharing readiness (Ring 4):** benchmarks and templates are private surfaces; profile
"current benchmarks" display is a projection per privacy settings (cohorts-spec). Nothing
here needs a visibility column now; the per-session visibility seam is
`planning/rework/tabs/social-tab.md`'s flag.

## 5. Interactions & cross-tab flows

Locked routing, verbatim where these systems touch it: **"Log Session (Home log bar) opens
an Earth/Sky/Water/Body element picker; Earth/Sky/Water rows lead with most-recent activity,
route to Map Record with sport armed; Body routes to Training template/session selection"**
(locked #6 — templates are that Body route's landing content). **"Routes are created on Map
(straight-line builder etc.), and the route library is browsed on Training. History
(logbook) is on Profile; routes are reusable assets, not history"** (locked #8 — routes are
*not* Sections and never enter the 3a/3b question; benchmark history is likewise not the
logbook — the detail sheet's face history stays a benchmark surface).

- Home benchmark card tap → detail sheet; Home pinned strip → full list tap-in. Note: the
  card-tap destination is contingent on `profile-settings.md` ⚑3 (Reflect's door), which
  leans toward Home cards deep-linking into the matching Reflect story — detail sheet holds
  until ⚑3 resolves; if it lands on the deep-link, this line and `home-tab.md` §5 update
  together.
- Nutrition target gesture → creates the adherence benchmark (one object, no separate
  targets store); standing renders in-line on Intake; management here.
- Template tap → live session → save-time fork (update template vs one-off); finished
  session → save-as-template sheet. Owned by `training-tab.md`; listed for the seam.
- Group pause → members leave Home glance and Reflect framing; nothing archived, no history
  closed.
- Cohort events (Ring 4) spawn independent personal benchmarks (benchmarks-spec § Cohort
  connection); the event is social context, the benchmark survives leaving it.

## 6. Build passes (ordered; each independently shippable)

1. **B1 — Face classifier in core (S).** Pure derived classification (per-face
   Compliance/Outcome/Trend labels) + tests. No UI, no schema. Unblocks 2b, card badges,
   any future column backfill. Fully decision-proof.
2. **B2 — Benchmark detail sheet (M).** Per §3; mounts from the existing list and Home
   cards. Decision-proof.
3. **B3 — List container v2 (M).** Cards + search + states + pluggable group-by wrapper,
   rendering the flat order until 2a/2b lands; applying the decision is a wrapper swap.
4. **B4 — Groups v0.5 storage + pause/resume (M).** Table + join + toggle row + Home/Reflect
   framing effects. Management mounts on the list surface interim (⚑5). Independent of the
   type decision.
5. **B5 — Type decision application (S–M).** Either a no-op beyond badges (derived), or a
   migration + serializer plumbing (column). Sized after §10.1 resolves.
6. **T0 — Sections definition + data-shape proposal (S, paper pass).** One page answering
   "what is a Section" (§10.3) under §4's layout-agnostic constraint; gates training-tab
   T6, which owns the build.

Nutrition-benchmark pieces (archived status, soft-archive migration, target gesture) are
`nutrition-tab.md` N2's passes, sequenced there after the PRO-63 merge.

## 7. Dependencies

- **`planning/rework/tabs/home-tab.md`** — module 5 consumes BenchmarkCard; B2's sheet is
  its tap target. Home does not block on any §10 decision.
- **`planning/rework/tabs/training-tab.md`** — T2 (shared library skeleton) and T6 (3a/3b
  application + Sections build) execute the templates side; T0 here gates T6. Its ⚑4
  (benchmarks door on Training) waits on §10.1/10.2.
- **`planning/rework/tabs/nutrition-tab.md`** — N2 creates adherence benchmarks on the same
  table; must not assume a `type` column exists. Decision (obvious call): if B5 and N2 both
  land schema in the same window they may share one migration, but neither waits for the
  other's *decision*.
- **PRO-63 benchmarks→main merge** — Notion sequences nutrition V2 after it; B1–B4 read
  only shipped 007/008 shapes and do not wait.
- **Rebrand track (locked #13)** — cards consume semantic tokens + the future
  `elements.{earth,sky,water,body}` group for domain tinting (2a leans on it); mechanics
  only, never hardcoded Gorge hexes. No pass blocks on the rebrand.
- **Migration ledger** — next free 017; claimants queue at build time (Sections table,
  groups, type column, nutrition soft-archive, Earth gear arms). Do not pre-assign.

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 The type field vs "the user never picks a type."** v0.4/0.5's rule is an entry-UX
  rule and it is load-bearing (faces fall out of what you fill in). The Notion mockups show
  a *type-first creation flow*, which contradicts it. Type as derived/stored *metadata* for
  grouping is compatible; type as a *creation step* is a deliberate spec amendment only you
  can make. Flagged once, plainly — if you override, it stands.
- **⚑2 List layout 2a by-domain vs 2b by-type** (locked #12). Both specced on one skeleton
  (B3); §10.2. 2b is mechanically blocked until ⚑1 resolves; 2a is not.
- **⚑3 Templates 3a vs 3b** (locked #12) — plus the hidden gate: "Sections" as reusable
  work-blocks is the only surviving meaning (geometry went to Spots/Routes), but you have
  never explicitly confirmed that reading. §10.3; consequences land in `training-tab.md` T6.
- **⚑4 Reflect's no-benchmark default is dangling.** benchmarks-spec's fallback (stimulus
  ledger as layer-2 frame) predates locked #2 (ledger → Settings tap-in). Candidates: the
  four-dimensions mix view, or ledger *data* re-rendered inside Reflect's remnant.
  Genuinely contestable; intersects where Reflect's tap-in door lives.
- **⚑5 Benchmark-group management placement** — Profile is the parking candidate
  (benchmarks-spec v0.5, explicitly undecided). B4 mounts it on the list surface interim.
- **⚑6 Notion Benchmarks row says "zero display UI"** while `app/benchmarks.tsx` +
  `edit-benchmark.tsx` ship today — read as "zero *redesigned* UI"; reconcile in Notion so
  nobody re-derives a false gap.

## 9. Open questions

Carried from benchmarks-spec v0.5, open, not blocking: seasonal/annual windows;
active-benchmark cap; per-face lifecycle; milestone data model (gamification-adjacent —
whatever ships stays user-authored or revealed); described-resolver visibility; group
lifecycle depth (archive vs pause-only); Reflect customization depth. New here: is a
Section standalone-loggable or compose-only; does template editor parity
(climbing/swim/practice shapes) precede or follow the 3a/3b resolution.

## 10. Decision briefs

### 10.1 Benchmarks `type` field (Outcome / Compliance / Trend)

- **Option A — stored column.** New migration; serializer + CRUD plumbing; backfill from
  faces or null. Pro: explicit, queryable, matches the Notion mockups. Con: a dual-face
  benchmark has *two* natural types, so one column forces a primary-face call; it invites
  the type-first creation flow that breaks the v0.4 rule (⚑1); schema churn on a table N2
  and groups are also touching.
- **Option B — derived classification, no schema.** B1's pure classifier; per-face labels.
  Pro: zero migration; dual-face benchmarks are honestly both; "user never picks a type"
  survives; reversible into A later (the classifier becomes the backfill). Con: not
  user-overridable — if a benchmark should *be* a Trend regardless of shape, B can't say so.
- **Option C — no type anywhere.** Faces already encode the distinction. Pro: least
  machinery. Con: 2b is dead; the mockups' grouping/badging language loses its vocabulary.
- **Lean: B.** The three types map one-to-one onto shipped structure (Compliance ≈ behavior
  face; Outcome ≈ outcome face with target; Trend ≈ outcome face direction-only) — storing
  what is derivable duplicates truth, and per-face derivation is the only shape that handles
  dual-face benchmarks without a fudge. B also keeps ⚑1 closed by construction.
- **Unblocks:** 2b buildability; B5 sizing; creation-flow design; N2 migration
  coordination; Notion mockup reconciliation.

### 10.2 Benchmarks list layout (2a by-domain vs 2b by-type)

- **2a** optimizes for the life-shaped read ("my kayaking, my strength, my weight"), keeps
  dual-face goals whole, aligns with groups and the four-dimensions lens, and works today.
  Cost: types become badges, not structure — if type is the organizing idea you want
  foregrounded, 2a buries it.
- **2b** makes the type concept the spine (do vs watch vs watch-toward-a-number). Cost:
  dual-face straddle; blocked on 10.1; domain context scatters.
- **Lean: 2a with per-face type badges** — it composes with the groups model ("what season
  am I in" is a domain question) and degrades gracefully however 10.1 lands. Cheap to swap
  later via B3's wrapper.
- **Unblocks:** B3's wrapper swap; Training ⚑4 (benchmarks door) can settle.

### 10.3 Templates library: 3a two lists vs 3b unified stream

- **First, the gate:** confirm what a Section is. If it's the reusable work-block (the only
  reading left standing), T0 specs it; if you meant something else — or nothing — 3a/3b
  collapses to "one Templates list" and the decision evaporates.
- **3a** optimizes for scale and object clarity: two kinds, two lists, absent-not-empty
  until a first Section exists. Cost: heavier chrome for a library that ships empty.
- **3b** optimizes for current reality — small counts, one mental model, filter chips.
  Cost: kind distinction rides on glyphs; if Sections aren't standalone-loggable, the mixed
  stream implies an affordance parity that isn't there.
- **Lean: 3b now** — the shared skeleton + wrapper swap (training-tab T2/T6) makes 3a a
  cheap later move if Sections proliferate; 3a's benefits arrive only at a scale a
  single-user library may never hit.
- **Unblocks:** training-tab T6 (application pass + Sections first cut); the
  migration-claim question (Sections table vs JSON); save-as-section affordance design.
