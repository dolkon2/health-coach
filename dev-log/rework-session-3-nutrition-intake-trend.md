# Rework Session 3 — Nutrition Intake/Trend split (N1)

**Branch/worktree:** `main`, `~/Projects/health-coach`. 1 commit, `e917d4e..376cf1a`.

## What was built

Per `planning/rework/session-playbook.md` Session 3 and
`planning/rework/tabs/nutrition-tab.md`, with Dylan's pinned answer:

- **Intake landing hierarchy:** target-status first, above the totals card,
  once N2 lands it. Recorded as a code comment in `nutrition.tsx` so N2
  doesn't have to re-ask.

**N1 — Intake/Trend split.** A two-segment `ChipSelect` under the tab title
(reusing the exact component Reflect already uses for lens-switching).
Intake keeps the existing day-view unchanged: `DayNavHeader`, `WeekStrip`,
`DayMealList`, the "Log food" button — pure relocation, no storage work.
Trend gets a new "Log weigh-in" button, `WeightTrendChart` (relocated from
Reflect — Reflect keeps its own copy for now; it isn't retired until P8),
and `ExpenditureCard` (moved off the fact surface). State resets to Intake
on tab re-entry per spec.

**Weigh-in edit/delete (the Session 2 flag).** Session 2's dev-log flagged
that removing Home's weigh-in card left `log-weigh-in.tsx`'s `editId` path
with no caller — a fat-fingered or duplicate weigh-in had no in-app
correction route. New `WeighInHistory` component (recent 5 weigh-ins,
newest first) gives Trend a real edit/delete surface: tap a row to edit
(routes to `log-weigh-in?editId=…`), swipe to delete (via
`deleteObservation`) — mirrors the `SwipeToDelete` + edit-route idiom
Training's session history and `DayMealList` already use.

## Code review

Ran `/code-review --fix` at medium effort (8 finder agents: 3 correctness
angles, reuse/simplification/efficiency, altitude, conventions). Three real
issues survived verification and were fixed in-session:

- **Trend tab-reset regression (correctness, confirmed independently by 3 of
  8 finders).** The `useFocusEffect` that resets `subTab` to `'intake'` on
  every focus fires again when the weigh-in-edit or body-profile modals
  (both opened from Trend) call `router.back()` — since those are root-level
  modals over the tab bar, dismissing one refocuses Nutrition and the effect
  snapped the user back to Intake right after they used the new correction
  path. Fixed with a ref (`returningFromOwnModal`) that the modal-opening
  helpers (`openWeighIn`, `openBodyProfile`) set before pushing, so the
  focus effect skips the reset exactly once on the way back, but still
  resets on a genuine re-entry (leaving to another tab and back — verified
  on-sim).
- **Duplicated date formatter.** `WeighInHistory.tsx`'s `shortDate()` was a
  byte-for-byte copy of `WeightTrendChart.tsx`'s private helper, and the two
  components now render back-to-back on the same screen. Extracted to
  `shortLocalDate()` in `lib/date.ts`, used by both.
- **Reverse-then-slice on the full weigh-in array.** `WeighInHistory` built
  its "5 most recent" list with `[...raw].reverse().slice(0, 5)` — cloning
  and reversing up to 90 entries just to keep 5. Changed to
  `raw.slice(-5).reverse()` (raw is oldest-first per `useWeightTrend`'s
  contract).

Two findings noted and left as-is: the `SwipeToDelete` + edit-route row
idiom is now hand-copied a 4th time (training.tsx, templates.tsx,
DayMealList.tsx, WeighInHistory.tsx) — a real "rule of three-plus" case,
but extracting a shared `SwipeEditRow` would touch 3 files outside this
session's scope; and the focus effect's `reloadTrend()`/`reloadExpenditure()`
now run two 90-day SQLite scans on every focus even though most visits are
now Intake-only (Trend is a secondary tab) — a genuine efficiency gap but
gating it behind `subTab === 'trend'` changes timing/staleness behavior
beyond this session's scope. Both worth a follow-up pass.

## Verification

- `npx jest`: 112 suites / 1190 tests, all passing.
- `npx tsc --noEmit`: clean.
- **Sim-verified with real taps** (iPhone 17 sim, `com.dylan.healthcoachproject`
  dev client, Metro on 8081, via computer-use driving the Simulator window
  directly — a step further than Session 2's deep-link-only pass since the
  gesture surface itself could be exercised this time). Confirmed live:
  Intake landing (day nav, week strip, "No food logged today", Log food);
  tapping "Trend" renders the weight chart, 5 recent weigh-ins, and the
  measured daily-burn card; tapping a weigh-in row opens "Edit weigh-in"
  prefilled, and Cancel returns to Trend (not Intake — the regression fix
  holds); swiping a row reveals Delete, tapping it shows "Delete weigh-in? /
  This is permanent." with Cancel preserving the row; "Edit body stats"
  opens Body stats and Cancel returns to Trend; leaving to Home and back to
  Nutrition correctly resets to Intake. Metro log showed only the
  pre-existing require-cycle warnings from Session 1 — no red-screen errors.
  Sample weigh-in data left seeded on the sim (7/1 178.4 lb down to 6/26
  179.5 lb, from a prior session's seed) — left untouched, all 5 entries
  intact.

## ⚑ Flags raised

- **SwipeToDelete + edit-route row pattern, 4th occurrence.** No shared
  component exists for "swipeable row that deletes on confirm, taps through
  to an edit route" despite training.tsx, templates.tsx, DayMealList.tsx,
  and now WeighInHistory.tsx all hand-rolling it. Worth a `SwipeEditRow`
  extraction as its own small cleanup pass — not blocking, but the next
  occurrence should probably trigger it.
- **Trend-tab eager reload.** `reloadTrend()`/`reloadExpenditure()` (two
  90-day SQLite scans) run on every Nutrition focus regardless of which
  sub-tab is visible, which is more wasteful now that Trend is a secondary,
  reset-on-reentry tab. Not fixed here — gating it behind `subTab` changes
  when Trend's data goes stale, a small behavior call worth its own look
  rather than folding into a review-fix pass.

## Explicitly NOT done / deferred

- **N2 (targets + adherence benchmark + status card)** — not built. The
  target-status card slot is reserved in the Intake JSX with a comment
  recording Dylan's ordering answer (leads, above totals) for whoever builds
  N2.
- **N3 (Focus lens)** — not built.
- **N4 (Trend completion: intake-over-time charts, energy-balance history)**
  — not built; Trend renders shipped pieces only, per the spec's N1 scope.
- **Reflect's own copy of WeightTrendChart** — untouched. Reflect isn't
  retired until P8 (gated on N1 + P4, both later sessions); duplication
  between Nutrition/Trend and Reflect is expected during the interim, not a
  bug.

## Status

Working tree clean (aside from `.claude/skills/` and
`planning/nutrition-tab-v2-spec.md`, both untracked and pre-existing —
untouched this session, same as Sessions 1 and 2 noted). Safe to leave
as-is. Ready for Session 4 (Training landing + template library).

**Notion / memory sync — flagging for you:** the Notion "Active Work" hub's
Nutrition row should move to "N1 built (Intake/Trend split + weigh-in
edit/delete), N2-N4 pending." The `project_app.md` memory file's health-coach
entry is due for a refresh to record this session's HEAD (`376cf1a`) and the
two new flags above.
