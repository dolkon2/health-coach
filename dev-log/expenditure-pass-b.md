# Expenditure build — Pass B: body-metrics capture + baseline surface

*Overnight build session (Fable), 2026-07-03. Brief: `dev-log/tdee-expenditure-build-handoff.md`.*

## What shipped

- **Migration 009 `settings`** — a generic key/value table (the wearable_state
  pattern, generalized). First tenant: the body profile, one JSON value.
- **`src/storage/settings.ts`** — `getSettingJson`/`setSettingJson` + typed
  `getBodyProfile`/`setBodyProfile`. Corrupt JSON degrades to null, never a guess.
- **`src/lib/bodyProfile.ts`** — pure form logic (mirrors benchmarkForm.ts):
  height in cm or ft/in, **birth year** (age derived at read — profile never
  drifts), formula sex, optional bodyfat, Route-1 activity self-report with
  transparent plain-language descriptions. **Weight is deliberately not a
  field** — it comes from weigh-ins (the handoff's field list omits it, on
  purpose; the surface uses the latest trend point).
- **`app/body-profile.tsx`** — the modal (from Settings, and from the card's
  empty state). Copy keeps the honesty spine: "a starting guess… measurement
  replaces it."
- **`src/components/ExpenditureCard.tsx`** on the **Nutrition tab** — the
  baseline TDEE with range, at LOW-fidelity opacity (rough data looks rough),
  labeled "predicted … the weak kind." Two honest empty states: no profile →
  add stats; no weigh-in → log one. Mifflin users see "Add body fat % to
  tighten the range" (give more, get sharper).
- Settings gains a "Body stats" card → the modal.

## Verify

- jest: 331 passed (314 + 17 new: 12 bodyProfile lib, 3 settings storage, +2 split).
- `expo export --platform ios`: clean. `tsc --noEmit` (LAST): 0.

## ⚑ Flags

- **⚑ Bodyfat source**: weigh-ins already carry an optional `bodyFatPct`
  (smart-scale style), and now the profile stores one too. Current behavior:
  the baseline reads **only the profile's** bodyfat. A fresher weigh-in
  bodyfat could arguably win (measured-over-stated), but BIA scales are noisy —
  left profile-only, flagging the question instead of silently deciding it.
- Height unit preference isn't persisted (defaults from weightUnit: lb → ft/in).
  Cosmetic; the stored value is always cm.
