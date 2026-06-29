# Ring 2 — Follow-up — Swipe-to-delete on Today's food rows

**Goal:** Food rows on Today were display-only, while sessions and weigh-ins were
swipe-to-delete. A wrongly-logged meal had no removal path. Dylan confirmed this
matters; landing it as its own small concern (edit still needs a food-edit screen —
deferred).

## What shipped

- **`app/(tabs)/index.tsx`** — each Today meal `Card` is now wrapped in the existing
  `SwipeToDelete`, calling the existing `removeAndReload(o.id)` (delete the
  Observation → reload today + trend). Confirm copy mirrors sessions: title
  "Delete food?", message `"<meal name> — permanent."`. No new logic — pure UI
  composition over already-tested pieces (`deleteObservation`, `SwipeToDelete`).

## Proof

- No new pure logic, so no new unit test (the repo has no RN render-test setup; the
  delete mechanism is already covered by the session/weigh-in delete paths).
- **tsc 0**; jest **17 suites / 120** unchanged (no regression).
- Behavioural check belongs to the upcoming live sim pass.

## NOT done

- **Editing** a logged meal — needs `log-food` to accept an `editId` (as
  `log-weigh-in` / `log-session` do). Separate, larger follow-up.
