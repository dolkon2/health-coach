# Ring 2 — Follow-up 1 — Close the loop: Today's food + honest daily total

**Goal (handoff §1, highest priority):** Logging a meal worked end-to-end, but
nothing surfaced it — after "Log meal" the Today screen looked unchanged. Make
logging feel real: a "Today's food" section on `app/(tabs)/index.tsx` listing
today's foodEntry observations (name + time + macros + fidelity tier dot) with a
running daily total. Honest nulls excluded from the total — never summed as 0.

## What shipped

- **`src/lib/foodLog.ts`** — `dailyTotals(meals)` (new, pure): the cross-meal
  counterpart to `rollupMacros`, with a deliberately different rule. Per macro it
  returns `{ value, missing }`: the sum of the entries that captured it, and the
  count that didn't. A missing macro is **excluded** from the sum (never summed as
  0) and **never collapses the whole day to null** — one partial breakfast must not
  erase a known lunch. A macro totals `null` only when not one entry captured it.
  Also returns `entryCount` and `partialCount` (entries where `isPartial` holds).
  Macros are never inferred from one another.

- **`src/lib/date.ts`** — `localTimeLabel(iso, tz)` (new): the wall-clock time of a
  meal, formatted in the **zone it was logged in** (the Observation's stored `tz`),
  not the device's current zone — so a meal reads at the time you actually ate it.

- **`src/hooks/useTodayObservations.ts`** — added a `foodEntriesToday` slice,
  derived exactly like `sessionsToday` (filter today's window by kind, oldest
  first). No new query — reuses the existing local-day fetch.

- **`app/(tabs)/index.tsx`** — a "Today's food" section:
  - A **Daily total** card (Cal / P / C / F) showing the honest sum, "—" for a
    genuinely unknown macro. When any entry is partial, a **clay-colored** notice
    (the brand's warning tone) with a clay dot: "N partial entr{y/ies} — missing
    macros not counted". The number stays honest; the notice explains the omission.
  - One **card per meal**, oldest first: the fidelity dot (`FidelityTreatment`, the
    same marker the logger uses) + the meal name (`payload.description`) + its
    **consumption time** (right-aligned, via `localTimeLabel`), and a macro line at
    the fidelity tier's own opacity (solid data looks solid, rough looks rough —
    the brand-kit rule, reused from the log screen).
  - Empty state "No food logged yet." The "Log food" button moved here from the
    Sessions section, where it now reads as this section's CTA. Re-fetch on focus
    already in place (`useFocusEffect` → `reloadToday`), so a new meal appears on
    return from the logger.

## Design decision — flat time-stamped list, not time chunks (this pass)

Reviewed with Dylan. He floated grouping meals into time-of-day chunks (e.g. every
4 hours) with subtotals. Decided to **show each meal's time in a flat, time-ordered
list** and **park chunking**, because: fixed buckets split a single eating occasion
across a boundary (11:55 vs 12:05); per-chunk subtotals stack a second tier of
numbers onto a glance-and-leave screen; and the real legibility pain is the **name**
(a meal borrows its first food's name — see Follow-up 2), not the layout. Revisit
chunking after names land and real data accrues, only if still wanted.

## Honesty notes

- `dailyTotals` is the spec's `null ≠ 0` rule applied at the day grain. The existing
  `rollupMacros` nulls a meal's macro if ANY item lacks it; `dailyTotals` instead
  drops the null entry and keeps counting — the two aggregations answer different
  questions and must not share a rule.
- Fidelity stays a visual tier (dot + opacity), never a number, on the new surface.
- Times render in each entry's stored zone, not the device's — the same local-time
  honesty as the day-window query.

## Proof

- `src/lib/__tests__/foodLog.test.ts` — added a `dailyTotals` block: sums complete
  meals; excludes a null macro from the sum (≠ 0) while keeping that meal's other
  macros; totals null only when no entry captured a macro; empty day is all-null
  with zero counts.
- `src/lib/__tests__/date.test.ts` (new) — `localTimeLabel` renders in the entry's
  own zone (LA vs NY differ), locale-robustly.
- Suite: **17 suites / 110 jest green** (was 105). **tsc 0.**

## NOT done / flagged

- **Food rows are not yet swipe-to-delete / tap-to-edit** (sessions and weigh-ins
  are). Out of scope for this single-concern follow-up; there's no food-edit path
  (`log-food` takes no `editId`). Dylan confirmed it matters — queued as the next
  small follow-up (swipe-to-delete first; edit needs the editId path).
- Time chunking — parked (see Design decision above).
- Not yet re-run on the iOS sim; verified at the logic layer (jest) + types (tsc).
