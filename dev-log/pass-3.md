# Pass 3 — Today screen + weigh-in

**Goal:** First end-to-end vertical slice — open the app, tap a button, enter a
weight, see it persist on Today with a real trend delta. (game-plan-and-prompts.md)

## What shipped

- **Trend engine** `core/src/trend.ts` — gap-aware EWMA (half-life 10d),
  `computeWeightTrend()` + `weightTrendDelta()`; returns `null` rather than
  inventing a number when there isn't enough data. (Built earlier in the pass.)
- **Log Weigh-In modal** `app/log-weigh-in.tsx` — real number input (data font),
  unit suffix, optional body-fat %, Save. Writes a tier-1, fidelity-1.0,
  `source: manual` Observation via `createObservation`, then dismisses.
- **Today screen** `app/(tabs)/index.tsx` — weigh-in card with two states:
  not-logged (tap target) and logged (today's weight in the data font + the
  14-day trend delta line, which renders only when the engine has enough data).
- **Hooks** `src/hooks/`:
  - `useTodayObservations` — today's local-day window from storage + `reload()`.
  - `useWeightTrend` — last 90d of weigh-ins → engine → points + delta.
- **Units** `src/lib/units.ts` — kg↔lb convert + format. Storage is always kg;
  UI shows the user's unit.
- **Settings stub** `src/settings/useSettings.ts` — `{ weightUnit: 'lb' }`.
- **Date helpers** `src/lib/date.ts` — `localDayWindow`, `daysAgoUtc`, `deviceTz`.

## Decisions

1. **Default unit = lb** (Dylan's choice), but every Observation stores `weightKg`.
   Conversion is isolated in `lib/units.ts` — one place knows the factor.
2. **Refetch via `useFocusEffect`**, not a global store. Today re-queries whenever
   it regains focus, so the modal save shows up with no shared state. (See quirk 4.)
3. **Local-day query, UTC-grouped trend.** "Today" uses correct local-day bounds;
   the engine still groups by UTC date. Acceptable for now — logged as quirk 1.
4. **Honest empty states preserved** — the delta line is conditional on a non-null
   engine result; the screen never fabricates a trend.

## Quirks flushed out

See `dev-log/quirks.md`. Pass 3 resolved #2 (useSettings) and #4 (refetch);
left #1 (tz in `dayKey`) and #3 (expo-sqlite on web) open and documented.

## Verified

- `npx tsc --noEmit` clean.
- `npx jest` → **15/15 pass**, incl. a new `src/__tests__/weighInFlow.test.ts`
  that drives the real data path against in-memory SQLite: lb input → kg storage
  → today-window query → trend (null when sparse, real downward delta over a week),
  plus `units.test.ts` for the conversion math.
- **On-device smoke test (manual, iOS sim):** PASSED (2026-06-26) — logged a
  weigh-in, card flipped to the logged state and updated smoothly on re-log.
  Body-fat % is captured + persisted (test-proven) but intentionally not shown
  yet (see quirk 5 — fidelity).

## Next — Pass 4: session logging (new session)

Log Session modal (modality picker → gym set logger with required movement-pattern
tag), sessions on Today, and `core/stimulus.ts` gets its real implementation.
Run `/pass-status` at the start to confirm Pass 3 landed clean first.
