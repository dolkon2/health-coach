# Nutrition tab — Pass 2 + Pass 2.5 — History, day nav, past/future-day logging

**Goal (Pass 2):** Replace the today-only Nutrition tab with a week strip that
lets you tap any past or future local day and see its meals. **Goal (Pass 2.5):**
Make the logger accept a `?date=` so meals can be backfilled to past days or
planned onto future days.

Both passes landed and were sim-verified. Per `planning/nutrition-tab-plan.md §
Pass 2 — History` (Option C, locked 2026-06-28).

## What shipped — Pass 2

- **`src/lib/date.ts`** — six new helpers: `paddedDayWindow(dates)` (tz-robust
  ±24h UTC window covering any local-day set), `todayLocalDate`, `addDays`,
  `weekOf` (Sun-Sat US convention), `dayNavLabel` (Today/Yesterday/Tomorrow/
  `"Sun, Jun 22"`), `weekdayLetter`, `dayOfMonth`. 18 tests.
- **`src/hooks/useFoodEntriesByDay.ts`** — one batched query per visible
  range; post-filters via `core/timeline.localDayOf` so each entry sits on
  the day it was actually eaten (data-model principle 4). Returns
  `entriesByDay` (the day-view source) + `daysWithFood` (the strip's dot
  signal) + a reload for post-mutation refresh.
- **`src/components/WeekStrip.tsx`** — Sun–Sat oval cells with sandstone
  outline for selected, borderStrong outline for today (when ≠ selected),
  clay activity dot below any day food was logged. Horizontal swipe pages
  ±1 week. No future bound — Pass 2 allows future-week paging.
- **`src/components/DayNavHeader.tsx`** — `‹ [label] ›` row with prev/next
  chevrons and tap-label-to-jump-to-today. Label cycles via `dayNavLabel`.
  Renders at `displayLg` so it anchors the top of the tab the way the big
  date does on Today.
- **`src/components/DayMealList.tsx`** — extracted from the inline render
  Pass 1 built. Daily-total card + hour-bucketed meal cards with the gutter
  upgraded from plain text to a continuous vertical line behind opaque-
  background hour pills.
- **`app/(tabs)/nutrition.tsx`** — went from 293 → 136 lines. Two pieces
  of state (`selectedDate`, `weekContaining`) drive everything. Past/future
  days hid the "Log food" button (later re-shown in Pass 2.5).

## What shipped — Pass 2.5

- **`@react-native-community/datetimepicker`** installed (SDK 53-compatible,
  registers itself as a config plugin in `app.json`'s plugins array).
- **`src/lib/date.ts`** — `noonOfLocalDate(date)` returns the ISO instant
  for 12:00 PM on a local date (device tz). Noon avoids DST edge cases
  (spring-forward skips 02:00; fall-back doubles 01:00 — neither happens
  at midday). 4 tests.
- **`src/hooks/useFoodLog.ts`** — accepts an optional `defaultOccurredAt`,
  holds `occurredAt` state, exposes `setOccurredAt`. `logMeal` uses the
  state instead of capturing `new Date()` inline. Edit mode hydrates from
  the original observation's `occurredAt`, preserving Pass 1 behavior.
- **`app/log-food.tsx`** — reads `?date=YYYY-MM-DD` from the route. Adds
  a "When?" row inside the preview card (between the name field and the
  focus chips). iOS uses the native compact DateTimePicker; Android falls
  through to a tap-to-show pattern with the formatted label as the trigger.
- **`app/(tabs)/nutrition.tsx`** — "Log food" button now visible on every
  day. Today's tap → no param → logger defaults to modal-open time. Any
  other day → `?date=YYYY-MM-DD` → logger defaults to noon of that day.

## Honesty rules carried

- `null ≠ 0`: empty past-day cards read "No food logged this day." — no
  fake zeros, no shame copy.
- Week-strip activity dot is the ONLY past-day activity signal. No per-day
  calorie pip, no partial-day badge.
- Fidelity stays a visual treatment only (the existing FidelityTreatment
  carries unchanged through `<DayMealList>`).
- Future-day viewing exists for meal planning, not for fake-logging — the
  "When?" picker is the explicit choice, with sensible defaults that the
  user can override.
- No targets, no nags, no streaks anywhere.

## Verification

- `npx jest` → 157/157 (Pass 2 added 13 helper tests; 2.5 added 4 more).
- `npx tsc --noEmit` → clean both passes.
- Sim review (Dylan, iPhone 17 sim on Expo 8083): Pass 2 looked good after
  the `displayLg` polish kicked the dead band; Pass 2.5 ships functional
  but the native compact DateTimePicker pills feel off-brand against the
  sandstone/rounded-card visual language.
- `app.json` `extra` block: single (no merge-time dupe).

## Commits — Pass 2

1. `f0bdbba` — `feat(nutrition): paddedDayWindow + useFoodEntriesByDay`
2. `eec9bb1` — `feat(nutrition): WeekStrip + DayNavHeader + DayMealList components`
3. `5fa556b` — `feat(nutrition): wire WeekStrip + DayNavHeader + DayMealList into the tab`
4. `d4ec4c4` — `fix(nutrition): anchor the top of the tab — DayNavHeader gets displayLg`
5. `fb4335a` — `merge: Nutrition tab — Pass 2` (the merge commit)

## Commits — Pass 2.5

6. `8abdfed` — `chore(deps): add @react-native-community/datetimepicker for Pass 2.5`
7. `8beb9b4` — `feat(nutrition): useFoodLog accepts an occurredAt for past/future logging`
8. `f2d5274` — `feat(nutrition): "When?" picker in the logger preview card`
9. `6748bde` — `feat(nutrition): show Log food on every day, pass selected date to logger`
10. (this dev-log + handoff) — `docs(nutrition): Pass 2 + 2.5 dev-log + logger-redesign handoff`

## Sim-review feedback (Dylan, 2026-06-28) — drives the next session

Five points came up after sim-reviewing Pass 2.5:

1. **Items can only be removed, not edited.** A wrong gram amount or wrong
   USDA match forces a delete + re-add; the right affordance is "tap an
   item to re-open it in the form."
2. **Grams-only amounts don't match how people actually eat.** Nobody
   knows what their McDonald's burger weighs. The logger needs serving
   sizes ("1 sandwich", "2 slices"), maybe "small / medium / large" chips,
   and a fallback to grams for the cases where you actually weighed
   something. USDA has serving-size data we're currently ignoring.
3. **The "When?" picker is off-brand.** Functional, but the native
   compact iOS picker's dark pills clash with the sandstone/rounded-card
   visual language. Deferred from Pass 2.5 because the brand mismatch is
   true across most native iOS components in the app — a brand pass on
   native components should happen as one piece of work, not per-component.
4. **Today tab should show just totals (no meal list).** Side note for a
   future Today redesign. Not now — Dylan explicitly deferred until after
   training/nutrition/cohort work catches up.
5. **The whole logger probably needs a redo.** Quoted: "I guess we can
   merge as is but gonna need to redo all of it at some point." Items 1
   and 2 are concrete; the rest of the redo is design-by-friction — see
   the next session's handoff for the framing.

## Next — Logger redesign

The next session is a *logger redesign*, not Pass 3 (Energy balance still
sits after the logger work). Bootstrap doc: `dev-log/logger-redesign-handoff.md`.
The three problems to solve, in priority order: (a) ingredient editing in
place, (b) portion sizes / non-grams quantities, (c) on-brand When? UI.
Pass 3 (Energy balance) starts after that.
