# Phase 4 · P4-3 — Benchmark groups storage + pause/resume (B4)

**Date:** 2026-07-13 · **Branch:** `feat/benchmark-groups` (off `main`, HEAD `3edd694`) · **Worktree:** `~/Projects/health-coach`
**Head:** `30ef700` · 7 commits · **⚠️ NOT pushed** (awaiting Dylan)

Builds the groups storage `benchmarks-templates.md` §4/§6/§8⚑5 specced but never
got: a `benchmark_groups` table + a `benchmark_group_members` many-to-many join
(migration 018), a per-group pause/resume toggle, and the Home/Reflect framing
effect — pausing a group drops its members from Today's glance and Reflect's
browse lens without touching any member benchmark's own status/pinned row.
Independent of the still-open benchmarks `type` decision (⚑1/R3) — no type
column assumed anywhere.

## What shipped (7 single-concern commits)

1. **`3231e3d` feat(schema)** — migration 018: `benchmark_groups` (title +
   `paused`) + `benchmark_group_members` join. No FK constraints, matching
   every other table in this schema.
2. **`b0c0fe1` feat(storage)** — `src/storage/benchmarkGroups.ts`: full CRUD
   + membership + `pausedBenchmarkIds()` (the query Home/Reflect subtract)
   + `listBenchmarkGroupsWithCounts()` (Profile's list, one query). Real-SQL
   round-trip tests, 7 passing.
3. **`eff3fec` feat(benchmarks)** — wired the framing effect into
   `useBenchmarkStatuses` (Today's glance) and `useBenchmarkReflect`
   (Reflect's browse lens); Reflect's existing focusId override now also
   re-surfaces a paused-grouped benchmark opened by direct link, same as it
   already did for an archived one.
4. **`c57fb88` feat(benchmarks)** — group-membership chips on
   `BenchmarkDetailSheet` (read-only; "In: Group A, Group B (paused)").
5. **`2e7f788` feat(profile)** — the group management module + sheet,
   **mounted on Profile** (Dylan's explicit call mid-session — overrides
   the spec's interim "existing benchmark list surface" lean; R5 was never
   blocking B4 either way).
6. **`a507694` fix(benchmarks)** — `/code-review` finding: the three hooks
   above had coupled the new group query into an existing `Promise.all`
   with no per-call catch, so a `pausedBenchmarkIds()`/
   `listGroupsForBenchmark()` failure was blanking Today's glance,
   Reflect's whole list, or the detail sheet — none of which have anything
   to do with groups. Fixed with per-call fallbacks. Also fixed the detail
   sheet's "(paused)" suffix applying to the whole joined group list instead
   of per group.
7. **`30ef700` fix(profile)** — three more `/code-review` findings in
   `BenchmarkGroupSheet`: a `loading` state that could get stuck true
   forever (switching to '+ New' while a prior edit-load was in flight),
   pause/resume persisting immediately while a same-sheet title edit stayed
   local (silent data loss on dismiss — pause is now local too, batched
   behind Save), and `save()`/`remove()` having no catch (unhandled
   rejection on a partial-write failure). Also added a delete confirmation
   (`Alert`, matching `SwipeToDelete`'s house pattern) — deleting a group
   was previously one tap with no undo.

## Review

`/code-review` at high effort: 4 finder angles (line-by-line, removed-
behavior, cross-file tracer, reuse/simplify/efficiency/altitude/
conventions), 10 findings reported, 6 fixed (commits 6–7 above). 4 left
as documented, not fixed — see flags below.

## Verification

- **jest:** 128 suites / **1324 tests** pass (+7 new:
  `benchmarkGroups.test.ts` — round-trip, idempotent add/remove, cascade
  delete, member counts, and the paused-dedup-across-groups case).
- **tsc --noEmit:** 0 errors.
- **Sim (iPhone 17, real device DB, no mocks):**
  - Confirmed migration 018 applied automatically on launch (read
    `migrations` table off the live app DB).
  - Seeded a real paused group over the DB directly (`INSERT` via
    `sqlite3`, one group + one membership row on the existing seed
    benchmark "Kayak 2x a week, get to 78" — real Dylan data, not a mock),
    relaunched, and screenshotted: **Home's Today glance dropped the kayak
    card** (the "Benchmarks →" floor module stayed, per its own doc
    comment) and **Reflect showed "No benchmarks to reflect on yet"** —
    both without touching the benchmark's own `active`/`pinned` row.
  - Screenshotted Profile's new "Benchmark groups" module rendering the
    seeded group with its correct member count and a "paused" tag, proving
    `listBenchmarkGroupsWithCounts()`'s join/count against real data.
  - Cleaned up: deleted the seed group/membership row, reverted the one
    temporary code edit (see below), relaunched, confirmed Home/Reflect
    are back to their pre-test baseline. Sim left clean.

**⚠️ Tooling gap this session, worth fixing before the next UI-heavy
pass:** the `computer-use` MCP could not see or control the Simulator this
session (`request_access` reported "Simulator" as not installed/running,
even with a real device booted and visible via `xcrun simctl` from Bash) —
its virtual display appears disconnected from this machine's real desktop
in this environment. `screencapture` was also blocked
("could not create image from display" — a macOS Screen Recording
permission gap for whatever process runs the Bash tool here). With no way
to visually verify a click target, I did not attempt blind coordinate-based
taps (`cliclick`, installed via `brew` for this) against the real desktop —
too much risk of an unverified click landing somewhere unintended. Verified
via `xcrun simctl openurl` deep-links (`healthcoach://profile`,
`healthcoach://reflect`) + `xcrun simctl io booted screenshot` (both fully
sandboxed to the simulator, no permission issue) instead, plus one
temporary, git-reverted edit to `app/profile.tsx` that duplicated the new
module above the fold so it would render without a scroll gesture I also
couldn't drive.
**Not interactively verified this session:** the "+ New group" →
title/checkbox/Save flow, the Pause/Resume button, and Delete's confirm
dialog — all exercised only by their storage-layer tests and by direct SQL
inspection of the same query path the UI calls, not by an actual tap
sequence. If `computer-use`/screen-recording access get fixed before the
next UI pass, worth a real tap-through of this flow specifically.

## ⚑ Flags

- **⚑1 — Migration 018 documentation collision (not a code bug).**
  `planning/rework/research/session-photos-spec.md` still says "claims
  migration 018" for a future local-media table (§2.2, §7). That was
  always a spec-level reservation — no `018_media.ts` file or `media`
  table code ever existed — and the Phase 4 playbook already corrected it
  ("the '018 claimed' line... never landed in main... 018 is free"),
  which is what this build acted on. But the spec doc itself is now
  stale: it needs renumbering to 019+ before anyone builds session-photos
  from it, or the next session claiming 018 will collide for real. Not
  fixed here — out of scope for a storage build to edit a different
  system's spec.
- **⚑2 — Archived/non-active group members are unremovable via the
  Profile UI.** `BenchmarkGroupSheet`'s membership checklist only offers
  `status === 'active'` benchmarks (Profile's `activeBenchmarks`). If a
  member benchmark later goes `achieved`/`abandoned` elsewhere, reopening
  the group shows no checkbox for it, so it can never be unchecked —
  `save()`'s diff never sees it as a candidate to remove. Judged low-
  severity and left as-is: the only place membership matters
  (`pausedBenchmarkIds()`) already only ever affects
  active(+pinned) benchmarks, so a stale member of an inactive benchmark
  is a harmless dead row, not a behavior bug. Deleting the whole group is
  the only cleanup path today. Documented in the component's own prop
  doc comment. Flag if this needs a real fix (e.g. show all-status
  members with a "no longer active" tag).
- **⚑3 — Duplicated sheet boilerplate.** `BenchmarkGroupSheet` is now a
  4th near-identical copy of the `Modal` + backdrop `Pressable` + rounded-
  top `View` pattern (`BenchmarkDetailSheet`, `ElementPickerSheet`,
  `SaveRecordingSheet` are the other three). Not extracted into a shared
  `Sheet` wrapper here — judged out of scope for a B4-sized pass. Worth a
  small refactor pass if a 5th sheet ever gets added.
- **⚑4 — Duplicated group-pause filter logic.** `useBenchmarkStatuses` and
  `useBenchmarkReflect` each independently do
  `Promise.all([listBenchmarks(...), pausedBenchmarkIds()])` then subtract
  the paused set. Two call sites, near-identical shape and comments.
  Left un-extracted (a shared helper would save ~6 lines per site at the
  cost of an extra indirection) — flag if a third caller ever needs the
  same query.
- **⚑5 — R5 (group-management placement) resolved mid-session.** The
  spec's lean was Profile either way, with an interim "mount on the
  existing benchmark list surface" fallback if it wasn't ruled by build
  time. Dylan ruled it directly this session: **Profile**, not
  `/benchmarks`. Recorded here as the decision, not carried forward as an
  open flag.

## Not done / deferred

- Type-decision application (B5) — separate pass, blocked on R3.
- The UI tap-through gap above (⚠️ tooling section) — re-verify once
  `computer-use`/screen-recording access is sorted.
- No transactions wrap `BenchmarkGroupSheet.save()`'s multi-row membership
  diff — matches this codebase's existing lack of transactions everywhere
  else in `src/storage/*.ts`, not a new gap this pass introduced, but the
  first *multi-row* write in the new module. `save()` now fails closed
  (catches, leaves the sheet open) rather than silently claiming success,
  which was the actual finding fixed; full atomicity would need
  transaction support this app doesn't have anywhere yet.

## Status block

- **Pass:** P4-3 Benchmark groups (B4) · branch `feat/benchmark-groups` ·
  head `30ef700`
- **Tests:** 1324/1324 jest (128 suites, +7 new) · tsc 0 · code-review:
  10 findings, 6 fixed · sim: DB-level + deep-link verified, full UI
  tap-through not driven this session (tooling gap, see above)
- **⚑ flags:** 5 above — none blocking; ⚑1 (doc staleness) is worth a
  quick fix before anyone starts session-photos
- **Deferred:** B5 (type-decision application), the tap-through
  re-verification
- **Safe to leave as-is?** Yes — branch is green, sim was left in its
  original clean seeded state (test group/membership deleted, temp code
  edit reverted, confirmed via a fresh screenshot). Next action is
  Dylan's call to push/merge, or pick up P4-4 (Gear Quiver, display-only)
  or a 🟥 flag-resolution pass on the Sections/Explore track.
