# ⚑ E-17: Style/Indoor/Pitches refactor

**Date:** 2026-07-09
**Decision maker:** Dylan (direct call during smoke test)
**Passes affected:** E4 + E5 code, all downstream

## What changed

Dylan saw the climbing form on the simulator and flagged three issues:

1. **'Gym' is awkward as a style** — it conflated climbing technique (sport,
   trad, boulder) with WHERE you climb (indoor vs outdoor). You can boulder
   indoors or sport climb at a gym.

2. **Indoor/outdoor should be a separate tag** — independent of style.

3. **Trad and sport should have a pitches field** — multipitch routes are
   common; boulder problems never have pitches.

## Decisions

- `ClimbingBlock.style` is now **optional**: `'sport' | 'trad' | 'boulder' | 'top-rope' | undefined`.
  Optional because imported sessions (8a.nu) can be genuinely ambiguous —
  absent, never guessed.
- `indoor?: boolean` added as a separate field. Optional — often unknown,
  certain only where the source guarantees it (BoardLib = always indoor).
- `pitches?: number` added per send. Shown in the UI for sport/trad/top-rope
  only. Never defaulted to 1 — a single-pitch route just omits the key.
- Grade placeholder is now style-aware: V4 for boulder, 5.10a for route styles.
- Default style in `emptySessionForm()` changed from `'gym'` to `'boulder'`.
- `edit-template.tsx` default changed from `'gym'` to `'boulder'`.
- All E5 import code updated: BoardLib always `indoor: true`, 8a.nu tie →
  `undefined` (not 'gym').

## Files touched (13)

- `core/src/observation.ts` — type changes + comments
- `core/src/climbGrade.ts` — removed 'gym' from style union
- `core/src/sessionTemplate.ts` — removed 'gym'
- `core/src/stimulus.ts` — handles optional style with fallback label
- `app/log-session.tsx` — Indoor/Outdoor chip row, pitches field, style-aware placeholder
- `app/edit-template.tsx` — default style
- `src/lib/session.ts` — build/inverse for indoor + pitches
- `src/lib/sessionFormOptions.ts` — CLIMB_STYLES, CLIMB_LOCATIONS, CLIMB_OUTCOMES
- `src/lib/climbImport/buildSessions.ts` — tie → undefined, boardlib indoor:true
- `src/lib/devSeed.ts` — seed climb uses indoor:true
- Tests: `session.climbing.test.ts`, `buildSessions.test.ts`, `climbGrade.test.ts`

## Test status

636 tests / 66 suites passing, tsc clean.
