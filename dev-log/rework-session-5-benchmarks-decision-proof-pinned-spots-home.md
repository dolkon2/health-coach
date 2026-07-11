# Rework Session 5 — Benchmarks decision-proof passes + Pinned Spots on Home

**Branch/worktree:** `main`, `~/Projects/health-coach`. 3 commits,
`2a6937b..1f4c36d`.

## What was built

Per `planning/rework/session-playbook.md` Session 5,
`planning/rework/benchmarks-templates.md`, `planning/pinned-spots-spec.md`,
and `planning/rework/tabs/home-tab.md`, with Dylan's two confirmed leans:

1. **No user-picked type — type is auto-derived from what you describe.**
2. **Benchmark list grouped by domain, with type badges.**

Both leans matched the specs' own documented recommendation (§10.1 option B,
§10.2 2a-with-badges), so this session built the leaned-into shape directly
rather than the pre-decision flat/neutral rendering the spec fell back to
when the decision was still open.

### Benchmarks (B1–B3)

- **B1 — face classifier** (`core/src/benchmarkClassify.ts`): pure per-face
  Compliance/Outcome/Trend derivation. Behavior face → Compliance always;
  outcome face with a `target` → Outcome; direction-only → Trend. Returns
  per-face labels, never forces a dual-face benchmark to pick one type. No
  schema, no migration — exactly option B.
- **B2 — detail sheet** (`src/components/BenchmarkDetailSheet.tsx` +
  `src/hooks/useBenchmarkDetail.ts`): a bottom sheet reused by the list and
  by Home's cards. Hero = outcome face when both exist (v0.4 rule), behavior
  rhythm beneath as consistency context; face history via the existing
  `BenchmarkRhythm`/`BenchmarkDayGrid` components (previously Reflect-only,
  now shared); lifecycle actions (Mark done / Pause / Resume / Reactivate /
  Edit). Works on a benchmark at ANY status, unlike `useBenchmarkReflect`
  which only loads active ones.
- **B3 — list container v2** (`app/benchmarks.tsx` rewrite +
  `src/lib/benchmarkDomain.ts`): active benchmarks now group by domain
  (Earth/Water/Sky/Body/Nutrition/General — the resolved dimension's "home
  turf"; Body-dimension outcome metrics like exerciseLoad merge into the
  same Body section as bodyweight/session-count activities). Cards carry
  Compliance/Outcome/Trend badges from B1. Search appears ≥10 items (same
  threshold as Training's library). Archived stays a flat muted section at
  the bottom, ungrouped. Tap opens B2's sheet instead of jumping straight to
  Structured entry.
- **Home routing update:** benchmark card taps now open the detail sheet
  directly (home-tab.md §5's stated routing) instead of pushing `/benchmarks`.

### Pinned Spots (P1–P2)

- **P1 — data + lib:** migration 015 adds `Spot.sport` (an activity-registry
  id, not a new enum), conservative backfill (`river-section`→`kayak`,
  `flying-site`→`paragliding`; `launch` and anything else stay untagged).
  `core/src/conditions/feedForSport.ts` resolves a sport tag to its
  conditions feed (gauge/wind/swell), staying dependency-free (no import
  from `src/lib`) since it lives in `core/src`. `src/lib/conditions/current.ts`
  is the new LIVE display-path fetch — reuses `fetchGaugeSnapshot`'s
  ≤2h-recent branch and `fetchWeatherAt` verbatim, 10-minute in-memory TTL
  cache, pull-to-refresh bypass, never writes to `conditions_snapshots` (that
  stays freeze-only). `EnduranceBlock`/`ClimbingBlock` gained optional
  `spotId` backlinks for the future save-as-spot pass (P4, not built here).
- **P2 — spots list + detail:** `app/spots.tsx` — cards grouped by sport
  (untagged last with the spec's stated "tag prompt" group, though the tap
  affordance to actually retag isn't built — that's P3/P4), live headline
  reading (gauge ft/cfs vs weather temp+wind), pull-to-refresh. `app/spot/[id].tsx`
  is a **minimal stub**, not full P3: name, sport, live conditions card,
  notes. No session log, no edit/rename/re-tag, no gauge-link search — built
  only so the "tap → detail" navigation from both the list and Home doesn't
  dead-end on a missing route. Training gained a "Spots →" header link
  alongside Benchmarks/Progress/Import.
- **Existing SpotPicker fix:** the shipped inline spot-creation flow (Water's
  WhitewaterSection) now tags new river-section spots `sport: 'kayak'` at
  creation, matching migration 015's own backfill rule — otherwise every
  *newly created* river spot would land untagged while old ones got
  auto-tagged, an inconsistency the code review caught.

### Home (H4)

`useSpotsGlance.ts` — spots capped at 3, live readings via the same
`current.ts` module. Mounted on Home between the log bar and Nutrition, per
home-tab.md's proposed shelf order (Spots above Benchmarks/Nutrition) — the
full shelf reorder (⚑1 in that spec) is still unconfirmed by Dylan; existing
Nutrition/Benchmarks order was left untouched rather than reinterpreted.

## Code review

Ran the full 8-angle `/code-review --fix` flow (line-by-line, removed-
behavior, cross-file tracer, reuse, simplification, efficiency, altitude,
CLAUDE.md conventions) via 8 parallel agents at medium effort, one-vote
verification, fixes applied directly. Real findings fixed:

- **Migration 015 typo (CONFIRMED correctness bug, two finders
  independently).** Backfilled flying-site spots to `sport = 'paraglide'`,
  but the actual registry id (`src/lib/activity.ts`) is `paragliding`. Every
  legacy Sky flying spot would have silently lost its icon, label, and wind
  conditions feed. Fixed in the migration, its test, and confirmed no other
  `'paraglide'` (vs `'paragliding'`) references exist anywhere.
- **`BenchmarkDetailSheet` always-mounted double-fetch (efficiency,
  CONFIRMED).** The sheet is a `Modal` that's always in the tree (`visible`
  just toggles), so its own `useWeightTrend`/`useExpenditure` calls re-ran
  90-day observation queries on every Home render regardless of whether the
  sheet was open — duplicating data Home already had. Converted to required
  `trendPoints`/`measured` props; Home passes its existing values, and
  `app/benchmarks.tsx` (which didn't previously need trend data) now
  computes them once for the sheet.
- **Duplicate FACE_LABEL maps** (app/benchmarks.tsx and
  BenchmarkDetailSheet.tsx each hand-copied the same
  Compliance/Outcome/Trend → display-string map) — consolidated into
  `BENCHMARK_FACE_LABEL`, exported from `benchmarkClassify.ts`.
- **Duplicate fetch-and-index + sort logic** between `useSpotsGlance` and
  `app/spots.tsx` — factored into `fetchCurrentForSpots()` (current.ts) and
  `sortSpotsByRecency()` (spotHeadline.ts), both call sites now share them.
- **`app/spots.tsx` double-sort pass** (alphabetical, then a second pass to
  push "untagged" last) — collapsed into one comparator.

Findings considered and explicitly NOT fixed:
- `feedForSport.ts` hard-codes its own activity-id lists instead of
  importing `src/lib/session.ts`'s `WHITEWATER_ACTIVITIES`/`WIND_ACTIVITIES`
  — flagged by the reuse finder, but this is intentional layering
  (`core/src` must stay dependency-free of `src/lib`); the altitude finder
  independently confirmed the layering is correct. Not a bug.
- Third copy of the Modal+overlay+rounded-sheet chrome
  (`BenchmarkDetailSheet` alongside `ElementPickerSheet` and Training's
  `BodyActivitySheet`) — the same duplication Session 4's dev-log already
  flagged as a future shared-`BottomSheet` extraction. Not new to this
  session; left as-is.
- A generic `groupBy` helper shared between `benchmarkDomain.ts`'s grouping
  and `app/spots.tsx`'s grouping — two call sites, judged premature
  abstraction.
- Minor/theoretical: unused `loading` state on `useBenchmarkDetail` (no
  current consumer, kept as reasonable future API surface); small (4-line)
  icon/feed-derivation duplication between `SpotCard` and the spot detail
  stub; a possible race on rapid Home re-focus in `useSpotsGlance` (same
  shape as every other reload hook in this codebase, not a new regression).

## Verification

- `npx jest`: 118 suites / 1239 tests, all passing (added 65 new tests
  across classifier, domain grouping, feed mapping, live-conditions TTL
  caching, headline formatting, and the migration 015 backfill).
- `npx tsc --noEmit`: clean.
- **Sim-verified with real taps** (iPhone 17 sim, dev client, Metro on
  8081, computer-use driving the Simulator window). Confirmed live:
  Training's "Spots →" link opens the (currently empty) spots list with no
  crash; Home renders the Spots floor row + all 5 real benchmarks
  (Protein/Capture-tier/Calories/Train/Kayak) after the rework; tapping a
  benchmark card opens the detail sheet showing Compliance badge + rhythm
  bars + day grid; Pause correctly dropped the benchmark from Home's glance
  and flipped the sheet to "Resume"; Resume correctly restored it; the full
  Benchmarks list correctly grouped into Water/Nutrition/General sections
  with per-card Compliance/Outcome badges; tapping the dual-face "Kayak 2x a
  week, get to 78" benchmark rendered the outcome-hero layout (weight trend
  as the headline, behavior count beneath, both badges) with real historical
  rhythm bars pre-dating the benchmark's creation. No red-screen errors in
  Metro across the whole pass.

## ⚑ Flags raised

- **Shelf order (home-tab.md ⚑1, carried forward, not newly raised here).**
  Spots glance landed above Nutrition/Benchmarks per the spec's *proposed*
  order, but Dylan has not explicitly confirmed the full shelf reorder —
  only the two benchmarks leans were confirmed this session. If the full
  order should differ, it's a one-place reorder in `app/(tabs)/index.tsx`.
- **Spot detail is a stub, not full P3.** `app/spot/[id].tsx` was built
  ahead of its spec'd pass (P3: session log beneath, edit/rename/re-tag,
  gauge-link search) solely so navigation from the list/Home doesn't
  dead-end. Needs the real P3 pass before it's a finished surface.
- **Untagged-spot tag prompt not wired.** The spots list groups untagged
  spots into their own section per the spec, but the "one-tap tag prompt"
  the spec describes isn't built — tapping an untagged spot just opens the
  (also-stub) detail screen with no re-tag affordance yet.
- **"Most-recently-visited" spot ordering is really "most-recently-created."**
  Both the list and Home's glance use `createdAt DESC` as an honest fallback
  — the real ordering needs `listSessionsForSpot` (P3), which doesn't exist
  yet. Documented in both files' headers so nobody mistakes it for the real
  thing.
- **Pinned Spots creation flows (P4) are entirely deferred.** No map pin
  picker, no save-as-spot from the logbook. The only way to create a tagged
  spot today is the pre-existing inline SpotPicker during Water/Wind
  logging (now sport-tagging river-section spots as a side fix this
  session).

## Explicitly NOT done / deferred

- **B4 (benchmark groups v0.5)** and **B5 (type decision schema
  application)** — B5 turned out to need no code: option B (the confirmed
  lean) is derivation-only, so B1's classifier already fully applies the
  decision. B4 (pause/resume as a group, not per-benchmark) is untouched.
- **T0 (Sections definition paper pass)** — not part of this session's scope.
- **Pinned Spots P3 (full spot detail: session log, edit, gauge-link) and
  P4 (map pin picker, save-as-spot)** — per pinned-spots-spec.md's own pass
  ordering; only P1–P2 were in scope for unblocking Home's H4.
- **Today's-template card (H5)** — still gated on Training's per-template
  recurrence property, unrelated to this session's build.

## Status

Working tree clean (aside from `.claude/skills/` and
`planning/nutrition-tab-v2-spec.md`, both untracked and pre-existing since
Session 3/4 — untouched this session). Sim left on the Benchmarks tab in a
clean state (no stray data — the Pause/Resume test round-tripped back to the
original active status). Metro left running on port 8081. Safe to leave
as-is. Ready for Session 6 (the shell swap → 5 tabs + Profile/Settings).

**Notion / memory sync:** flagging for status-sync — the Notion "Active
Work" hub's row for this dimension should move to "Benchmarks B1–B3 built +
Pinned Spots P1–P2 + Home H4 built; Spots P3/P4 and Benchmarks B4/T0
pending." No `project_app.md` memory refresh done automatically per
dev-log-closeout's own instruction not to do memory/Notion sync
unprompted — noting here that the memory file's `⭐ CURRENT main` pointer is
now stale (was `2a6937b`, now `1f4c36d`) and due for an update.
