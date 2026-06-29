# Ring 2 — Follow-up — Edit a logged meal

**Goal:** You could log and delete a meal but not fix one. Add edit, following the
weigh-in/session pattern (tap → editor pre-loaded → save replaces it). Built on a
fresh `food-edit` branch off `main` (after the Ring 2 merge).

## Interaction (Dylan's pick, "Option 1")

Tap a meal card = **edit**; tap the **"N items ▾" toggle** = expand the breakdown;
swipe = delete. Consistent with sessions/weigh-ins (tap to edit). The expand toggle
is its own tap target (a sibling Pressable, not nested) so opening the breakdown
never opens the editor. Single-item meals have no toggle — tap just edits.

## What shipped

- **`src/hooks/useFoodLog.ts`** — `useFoodLog(editId?)`. In edit mode it hydrates from
  the meal (`getObservationById` → items, name, input method, templateId) and keeps
  the `original`. `logMeal` then **rebuilds macros + fidelity from the edited items**
  via the tested `buildMealLog`, preserving identity + timing (id, occurredAt, tz,
  loggedAt), and calls `updateObservation` (in-place, the shipped CRUD pattern — no
  supersede, matching sessions/weigh-ins). Create path unchanged. Exposes `isEdit`.

- **`app/log-food.tsx`** — reads `editId`, passes it to the hook; sets the screen
  title (`Edit meal` / `Log food`) via `Stack.Screen`; in edit mode the footer is a
  single **Save changes** button (the "Save meal" template action is hidden).

- **`app/(tabs)/index.tsx`** — meal card body is a Pressable → `router.push('/log-food',
  { editId })`; the expand caret moved to its own toggle row ("N items ▾" / "Hide
  items ▴"). Delete confirm + breakdown unchanged.

## Proof

- No new pure logic — edit reuses `buildMealLog` (tested) + `updateObservation`
  (tested in `observations.test.ts`). **17 suites / 123 jest green, tsc 0.**
- Edit flow (tap → editor pre-loaded → adjust → Save changes → Today updates)
  verified on the sim.

## Notes

- Editing recomputes macros + fidelity from the new items (correct — the meal
  changed); occurredAt/loggedAt are preserved so the timeline position is stable.
- Editing a legacy (pre-names) meal still works; its items just lack names.
