# Logger redesign — handoff, 2026-06-28

The Nutrition tab (Pass 2 + 2.5) is merged. Sim review surfaced three
concrete problems with the food logger that the next session redesigns:

1. **Edit-in-place for items** — tap an item to re-open it in the form,
   not just Remove.
2. **Portion sizes / non-grams quantities** — nobody knows what their
   McDonald's burger weighs. Serving sizes ("1 sandwich", "2 slices"),
   maybe small/medium/large chips, with grams as the fallback (not the
   default) for the cases someone actually weighed something.
3. **On-brand When? picker** — the native iOS compact DateTimePicker's
   dark pills clash with the sandstone/rounded-card visual language.

Dylan explicitly said "gonna need to redo all of it at some point." Treat
this as a *logger redesign*, not a series of small patches.

## Worktree + toolchain

Use `~/Projects/health-coach-nutrition` (the worktree the Pass 2 + 2.5 work
shipped from — its branches are merged and stale). Reset onto main and
branch fresh:

```
git -C ~/Projects/health-coach-nutrition fetch
git -C ~/Projects/health-coach-nutrition checkout -b logger-redesign main
```

(Note: do NOT `git checkout main` in this worktree — `main` is checked
out in `~/Projects/health-coach` and worktrees can't share a branch.
Branching directly from `main` works without checking it out.)

Skip `npm install` — node_modules is coherent on SDK 53.

Run: `npx expo start -c --port 8083`, press `i` for the iOS sim.

Toolchain: Expo SDK 53, TS 5.8.3, jest-expo 53. **No parallel CC sessions
on one folder** — the shared node_modules/lockfile corrupts (see
`~/.claude/projects/.../memory/feedback-parallel-sessions.md`).

## State

- **`main` @ a merge commit** — Pass 2 + 2.5 in. Commit summary in
  `dev-log/nutrition-tab-pass-2.md`. jest 157/157, tsc 0.
- **`~/Projects/health-coach-training`** — phase-4 training tab, ready
  to merge, leave alone.
- **`main` is local-only**, 60+ commits ahead of `origin/main`. Push only
  if Dylan asks.

## Authority — read these first, in order

1. `dev-log/nutrition-tab-pass-2.md` — what just shipped + the five sim
   review notes that motivate this work (especially #1, #2, #3).
2. `planning/nutrition-tab-plan.md` — the tab roadmap. Pass 2.5's logger
   work is mentioned there; the logger-redesign work itself is *not* in
   the plan doc yet, because this session is where the plan gets written.
3. `planning/food-logging-spec.md` — the food-logging contract. Honesty
   rules. The data model for items.
4. `app/log-food.tsx` and `src/hooks/useFoodLog.ts` — what's there today.
   The logger is a thin consumer; the real logic lives in `src/lib/foodLog.ts`
   and `core/src/nutrition/*`.
5. `CLAUDE.md` for the always-on constitution.

## What the redesign should NOT touch

- The data model. `FoodItem`'s schema (description, quantity, macros, the
  extraction metadata) is fine. Serving sizes can be a UI concept that
  resolves to grams under the hood — they don't need a new storage column.
- The Nutrition tab (Pass 2's surface). Past/future-day navigation works.
  The redesign is the *logger modal*, not the tab.
- The honesty rules (null ≠ 0; fidelity is a visual tier; no targets/nags/
  streaks). Anything that pushes against these is wrong by construction.
- Pass 1 helpers — `mealDisplayName`, `dailyTotals`, `removeItemFromMeal`,
  `itemMacroSummary`, `fidelityTreatment`, `hourBucketLabel`. Reuse them.
- The When? picker's *plumbing* — `useFoodLog`'s `occurredAt` state +
  `noonOfLocalDate` + the `?date=` route param. Only the *UI rendering*
  of When? changes. Don't rip out the plumbing trying to re-do it.

## The three problems, in priority order

### 1. Ingredient editing in place

Currently each item row in the preview card has a "Remove" link. The
redesign: tap an item → re-open it in the upper form (the search-and-
weigh / describe section) pre-filled with that item's food + quantity.
Save → replaces the item. Cancel → leaves it as-is.

This is an interaction-design problem (how does "edit mode" read?
in-place vs. modal? does the form switch modes?) and a state-management
problem (`useFoodLog` needs an `editingIndex` and an `updateItem`
companion to `addWeighed`/`addDescribed`).

Mock first. Don't write code.

### 2. Portion sizes / non-grams quantities

The hardest one. USDA returns serving-size data (e.g., "1 sandwich =
113 g") on most food entries — we ignore it and force the user to type
grams. The redesign:

- When a USDA food has serving data, default the amount input to "1
  serving" (or whatever the food's natural unit is).
- Show "small / medium / large" chips when the food has graded sizes.
- Fall back to grams when the food has no serving data OR when the user
  explicitly switches to "by weight."

Don't fake serving sizes for foods that don't have them — the McDonald's
burger problem is real because USDA *does* have serving data for it.
We're just not reading it.

This needs investigation of the USDA shape first (what fields exist on
the `foodDataType` we hit), then a design pass, then code.

### 3. On-brand When? picker

The native iOS compact `DateTimePicker` shows two dark filled pills
("Jun 28, 2026" / "6:11 PM") that don't match the app. Replace with
two sandstone-bordered buttons that look like the rest of the brand,
opening the native picker inside a wrapped modal (with a "Done" button)
on tap. Picker logic underneath stays identical; only the trigger
chrome changes.

Smaller scope than #1 and #2. Save for last.

## Honesty (binds)

- `null ≠ 0` — a missing macro stays unknown forever, never inferred.
- Fidelity is a visual tier, never a number.
- No targets, nags, streaks.
- Edits replace; they don't supersede (use `updateObservation` as Pass 1
  did, not `createObservation` with a `supersedes` link, unless we're
  intentionally building the supersedes affordance — which we are NOT in
  this redesign).
- Serving sizes that USDA didn't provide are NOT invented. If a food has
  no serving data, the logger must say so (or just fall back to grams
  with no "fake" serving option).

## Discipline (carry from Pass 1)

- Single-concern commits, `Co-Authored-By: Claude Opus 4.7
  <noreply@anthropic.com>`.
- **HARD review checkpoints** — show diffs/mocks BEFORE coding the
  layout. Dylan reviews on sim; flag don't reinterpret.
- Plan files before writing. `tsc` runs LAST after the test files exist.
- Non-technical founder — explain plainly, mock UX changes, checkpoint
  before any UX or core/migration commit.
- **Distrust clean merges** — Pass 1's merge silently duplicated
  `app.json`'s `extra` block. Spot-check after merge.
- The Nutrition tab on Today (the glance) and the rest of the existing
  Nutrition tab are tested by hand on sim — there are no `.test.tsx`
  files in this project. Test pure logic; sim-verify the UI.

## Suggested first move

Read the three authority docs above. Then propose a logger-redesign plan
with a commit breakdown — probably 3 phases (one per problem) with their
own commits. **Mock the new logger layout (especially #2's serving-size
chips + amount input) BEFORE writing any RN code.** Dylan picks the
phase order if it differs from priority order above.

The current logger (`app/log-food.tsx`) is 220 lines. Expect the redesign
to grow it (or split it into pieces) — start by deciding whether the
form stays in one screen or splits into stages.
