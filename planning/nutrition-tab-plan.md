# Nutrition Tab — plan (Phase 2+, post-Ring-2)

**Status:** planning. This doc is the authority for the Nutrition-tab build — read
it at the start of each pass. Decisions below are Dylan's, locked 2026-06-28.

## Why

Ring 2 put food logging on the **Today** screen. It works, but Today is "the home
of the daily loop — open, see today, log, leave," and the food depth (breakdowns,
history, energy balance, trends) is outgrowing a glance screen. The app already
separates glance from depth: **Today / Training / Reflect**. Nutrition deserves the
same — a dedicated **Nutrition tab** for the depth, with Today reduced to a glance.

Symmetry: `Training tab : sessions :: Nutrition tab : food :: Reflect : outcomes`.

## Locked decisions (Dylan, 2026-06-28)

1. **Mirror-first — no prescriptive targets in v1.** No calorie/macro "you should eat
   X" targets. A target is prescriptive and cuts against the constitution ("a mirror,
   not a coach"). Goals arrive later, *through the benchmark mechanic* (Phase 5), as
   the user's declared intent that the tab reflects against — never nags, never
   streaks. See [[benchmarks-spec]] / constitution.
2. **Energy balance IS surfaced — as a tier-3 modeled estimate.** Intake vs.
   expenditure (the 2.6 `ExpenditureReport`) gets a home here, shown honestly: a
   modeled value with its **error band**, never as gospel. `residualConfidence` /
   `logCompleteness` drive how confidently it renders. Null intake days are excluded,
   not zero-filled.
3. **Inline per-item delete lives in the tab, not on Today.** In the tab's meal view,
   each food has an inline delete (quick remove without the full editor). On Today,
   the breakdown stays read-only — Today is a glance; editing happens by tapping into
   a meal. (This refines the earlier "no inline delete" — it's "not on Today, yes in
   the tab.")
4. **Today keeps total + a compact meal list.** Today's food = the daily total + a
   lightweight list of today's meals (tap → edit) + Log food. All depth, history,
   energy balance, trends move to the tab.

## Information architecture

**Today (the glance) keeps:**
- `dailyTotals` card (Cal/P/C/F, honest nulls, partial note).
- Compact today's-meals list — name + time + macro line + fidelity dot; **tap → edit**
  (the existing log-food edit path). NO expand/breakdown, NO inline delete here.
- Log food button.
- (Removed from Today: tap-to-expand breakdown — that depth moves to the tab.)

**Nutrition tab (the depth) holds:**
- **Today, in full** — today's meals with per-item breakdowns, inline per-item delete,
  tap-to-edit, and the day's energy balance.
- **History** — scroll back through past local days; per-day totals; tap a day → its
  full breakdown.
- **Energy balance** — intake vs. the expenditure engine's estimate, per window, with
  the error band and confidence treatment.
- **Trends** — intake (Cal/macros) over time, in the Reflect chart idiom (custom
  react-native-svg, no charting library).
- **Saved meals** — manage templates (rename/delete; re-log already exists).

## Honesty rules carried (non-negotiable)

- `null ≠ 0`: a missing macro is unknown, never 0, never inferred (`dailyTotals` /
  `rollupMacros` already enforce this).
- Fidelity shows only as a **visual tier** (dot + opacity), never a number.
- Energy balance is **tier-3 modeled** — always rendered with its error band and
  confidence; a modeled value never overwrites or contradicts a logged (tier-1) one.
- **No targets, nags, streaks, or gamification** anywhere in the tab (mirror, not
  coach). Goals are benchmark-driven, later.

## Pass breakdown

Each pass: plan files → build → jest green → `tsc` clean (LAST) → single-concern
commit + `dev-log/` note. Branch `nutrition-tab` off `main`; merges back when the
tab is solid + sim-verified.

- **Pass 0 — this spec doc** (docs before code).
- **Pass 1 — Tab scaffold + Today slim + "Today in full".** Add the Nutrition tab to
  `app/(tabs)/_layout`; slim Today's food to the glance (total + compact meal list +
  Log food); build the tab's day view (meals + per-item breakdown + **inline per-item
  delete** + tap-to-edit). Saved-meals management folds in here or a small follow-up.
- **Pass 2 — History.** Week strip + tap-into-a-past-day. Per-day totals, full
  per-meal breakdown, edit + per-item delete still work on past days. New query
  (food entries grouped by local day for a date range); reuses the Pass 1
  day-view rendering.

  Locked decisions for Pass 2 (Dylan, 2026-06-28, after reviewing MacroFactor):

  1. **Layout: Option C (hybrid).** "Nutrition" stays as the tab identifier.
     Below it: a `‹ [selected-day label] ›` row with prev/next arrows and a
     "Today" badge when the selected day *is* today. Below that: the week
     strip (oval cells, big date + small weekday letter, dot under any day
     food was logged, filled outline on the selected cell). Below that: the
     existing Pass 1 daily-total card + meal list, unchanged structurally.
  2. **Navigation: in-tab local state.** Selecting a past day does NOT push a
     stack screen; the tab's content swaps below the persistent strip + nav.
     Mirrors MacroFactor and keeps the strip/nav anchored. Costs accepted:
     no deep-linkable URL, no iOS back-gesture (covered by the `‹` arrow,
     tapping today's cell, or tapping the date label to jump to today).
  3. **Gutter upgrade.** Pass 1's 56px text gutter gains a thin vertical line
     with the hour-of-day rendered in a rounded pill anchored on the line —
     a small visual upgrade that makes the time read as an anchor, not a
     label. Pure presentation; no behavior change.
  4. **Week scroll-back.** Horizontal swipe on the strip pages back/forward
     one week at a time. A subtle leading-edge chevron `‹` hints at
     discoverability. Tapping a date label or the today-cell jumps back to
     today.
  5. **Past-day affordances.** Edit, per-item delete, swipe-to-delete all
     work the same as today. The "Log food" button is hidden on past days —
     logging always goes to the present (existing `/log-food` covers any
     "I forgot to log yesterday" case via the date control inside the
     logger). No fake zeros on empty past days — the empty card replaces
     the totals card just as it does on Today.
- **Pass 2.5 — Logger date-picker.** "When?" control inside the logger so meals
  can be logged onto past days (backfill) or future days (meal planning). Reads
  a `?date=YYYY-MM-DD` route param the Nutrition tab passes when the user taps
  "Log food" from a non-today day; defaults to noon of that day. iOS native
  compact picker; Android falls through to a tap-to-show pattern. Today's
  button still records modal-open time (no param → no default).
- **Pass 3 — Energy balance.** Wire `estimateExpenditure` to real day-keyed intake +
  weigh-ins; render intake vs. expenditure with the error band + confidence. The 2.6
  engine's first UI surface.
- **Pass 4 — Trends.** Intake over time (Cal/macros), custom SVG in the Reflect style;
  honest empty states; optional overlay against weight/training later.

## Deferred / out of scope

- **Targets / goals** → benchmark mechanic, Phase 5 (not here).
- **Plan-ahead** (laying out future meals/days) → later, its own design.
- **Barcode (2.7)** → still gated on a native scanner dep + dev build; ASK first.
- **Photo (2.8)** → schema-reserved, no build surface.
- **Earned fidelity computation** → Phase 7.

## Nothing wasted

Everything Ring 2 + the follow-ups built — `dailyTotals`, `itemMacroSummary`,
`scaleMacros`, the breakdown/edit/delete UI, names, ranking — relocates cleanly into
the tab. Pass 1 is mostly *moving* the depth and adding the tab shell, not rebuilding.
