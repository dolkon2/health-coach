# Phase 6 — Pass 1: SessionTemplate entity + library CRUD

*Date: 2026-06-28 · Worktree: `~/Projects/health-coach-training` · Branch:
`phase-4-training`*

---

## TL;DR

The app can now remember training shapes. A new "Library" door on the
Training tab opens a screen of saved templates; "+ New" creates one by picking
an activity → filling target fields → saving. Tap a row to edit, swipe to
delete. Library ships empty (constitution: no app-provided programs).

**Verify bar:** create Push Day (gym, 3 exercises with targets) + Park run
(GPS, 5k) + Vinyasa (practice, 60 min, vinyasa style). Persist, edit,
delete. ✅ Code-level: tsc 0 errors, jest 95/95 passing (87 prior + 8 new),
metro iOS bundle exports clean. **Live sim verify is Dylan's tap-through.**

---

## What shipped

### Data layer (zero-risk, fully tested)

- `core/src/sessionTemplate.ts` — `SessionTemplate` type with discriminated
  `TemplateShape` union per surface (gym/gps/climbing/swim/practice). Target
  fields only — no timestamps, no fidelity, no perceived effort. Templates
  are NOT Observations.
- `src/storage/migrations/002_session_templates.ts` — new SQLite table with
  indexes on `surface` and `isActive`. Registered in
  `migrations/index.ts`. Migration 001 untouched (data-model.md: never
  hand-edit a shipped migration).
- `src/storage/serialize.ts` — added `sessionTemplateToRow` /
  `rowToSessionTemplate`. `shape` is JSON-encoded text (same trick
  `observations.payload` uses); `isActive` stored as 0/1, hydrated to
  boolean.
- `src/storage/sessionTemplates.ts` — CRUD mirroring `benchmarks.ts`:
  `createTemplate`, `listTemplates` (most-recent-updated first),
  `getTemplateById`, `updateTemplate`, `deleteTemplate`. Hard-delete and
  hard-overwrite (matches Pass-6-of-Phase-4 edit contract for sessions; the
  supersede pattern is for tier-1 Observations, not user-authored
  records).
- `src/storage/__tests__/sessionTemplates.test.ts` — 8 round-trip tests:
  gym shape, all five surfaces in one pass, dayAssignment presence/absence,
  list ordering, update + createdAt-preserved, missing-id error, delete
  idempotency, isActive 0/1 ↔ boolean.

### UI extraction (the "do it right now" call)

- `src/lib/sessionFormOptions.ts` — chip-option arrays factored out of
  log-session: `PATTERNS`, `ENERGY_SYSTEMS`, `CLIMB_STYLES`, `SWIM_MODES`,
  `SWIM_STROKES`, `EFFORT`, plus new `DAYS_OF_WEEK`. One place to add a new
  pattern or rename a style.
- `src/components/surface/GymExerciseEditor.tsx` — extracted ExerciseEditor
  from log-session. Also exports `RemoveButton` and `Checkbox` since they
  were local helpers tightly coupled to the editor. The rest timer + the
  `completedAt` stamping logic stayed in `app/log-session.tsx` — they're
  session-runtime concerns, not exercise-data concerns.
- `app/log-session.tsx` rewired to use the extracted pieces. Tests still
  green (95/95).

### New screens

- `app/templates.tsx` — Library list. Empty state, list rendering grouped
  by `updatedAt DESC`, `SwipeToDelete` per row, "+ New" header button.
  `TemplateRow` shows name + activity-label + one-line `describeShape()`
  summary + optional day pill + paused indicator.
- `app/edit-template.tsx` — Create/edit screen. Step 1 activity picker
  (same identity tiles as log-session, no quick-log shortcut); step 2 form
  body with name + surface-specific shape editor + day-of-week chip +
  active switch + Save. The five surface body components
  (`GymTemplateBody`, `GpsTemplateBody`, `PracticeTemplateBody`,
  `ClimbingTemplateBody`, `SwimTemplateBody`) live in this file — see
  "scope decision" below.

### Routes

- `app/_layout.tsx` — registered `templates` and `edit-template` as modal
  Stack screens (matches `log-session` presentation).
- `app/(tabs)/training.tsx` — added a quiet "Library →" link in the
  top-right of the header row.

---

## Scope decision: how far to factor the surface forms

The build plan said "extract the surface forms into shared components."
Dylan blessed doing it now (vs deferring) because "each field will need
work" anyway. But fully factoring all five surfaces, both log AND template
flavors, into ~10 shared components would mean ~500–800 lines of churn
against `log-session.tsx` (currently green, jest 87/87) right before Pass
1's verify gate.

**What I extracted now:**

- Chip-option arrays → `src/lib/sessionFormOptions.ts` (the cheapest, most
  obviously-shared piece).
- `GymExerciseEditor` (the heaviest, most likely to iterate) →
  `src/components/surface/GymExerciseEditor.tsx`.

**What I left inline for now:**

- GPS / climbing / swim / practice form bodies in `log-session.tsx`.
- Template-mode equivalents live in `edit-template.tsx` and use the shared
  chip options + Field primitive but have their own JSX.

**Why this stopping point:** template-mode forms are *materially*
different from log-mode forms (target distance vs actual distance + HR;
no live-set timestamps in gym templates; lighter climbing template;
etc.). The right shared shape will be clearer when Pass 3 (placement →
tap-to-log pre-fill) shows what data actually flows from a template into
a live session. Factoring now would lock in a guess; factoring then
locks in a known requirement.

If Dylan wants a deeper extraction this pass, it's a 2–4 hour follow-up.
Flagged here so it doesn't get lost.

---

## Decisions made

1. **SessionTemplate is its own table, not an Observation.** Templates
   have no `occurredAt`, no fidelity, no tier — the constitution's
   "everything is an Observation" applies to timeline events, not
   user-authored definitions. Modeled on the `benchmarks` and
   `MealTemplate` precedent.
2. **`shape` is a discriminated union by `surface`.** Same pattern as
   `SessionPayload`'s sport-block fields, but with target semantics
   ("targetReps: '5-8'" not "reps: 5"). Reps are a freeform string
   because intent is descriptive — a template can say "AMRAP" or "5-8"
   or "5".
3. **`dayAssignment` and `isActive` are stored but unused this pass.**
   Pass 4 will consume them (auto-populate active templates onto future
   weeks). The UI lets you set them now so users don't have to revisit
   templates after Pass 4 ships.
4. **Hard-delete, hard-overwrite.** Matches the session edit contract
   from Phase 4 Pass 6 — supersede is for tier-1 facts (observations),
   not for user-authored shapes that the user can freely edit.
5. **Library entry: quiet "Library →" link, no count, no active row.**
   Pass 2 will rebuild the Training tab as the week view anyway, so the
   entry is short-lived. Dylan agreed: surfacing active templates inline
   only makes sense once Pass 4 makes "active" mean something.
6. **Gym templates carry freeform exercise-name strings.** Phase 4 Pass 4
   (exercise library) is deferred; until then "barbell bench" is just a
   string. Upgrade path: a future migration adds an `exerciseLibraryId`
   column and a one-time mapping pass.

---

## Verify bar — Dylan's tap-through

From `~/Projects/health-coach-training`:

```
npx expo start --port 8085
# in the simulator, press i
```

(Confirm the simulator Expo Go is the SDK-53 build per the handoff.)

1. Open the **Training** tab. Confirm the "Library →" link sits top-right
   under the "Training" label.
2. Tap **Library →**. Confirm empty state: "No templates yet. Tap '+ New'
   to save your first one."
3. **Push Day** — tap **+ New** → tap **Gym** tile → name "Push Day" → add
   exercises:
   - Barbell bench · upper-push · 3 sets · 5-8 reps · 80 kg target
   - Overhead press · upper-push · 3 sets · 6-10 reps · 45 kg
   - Dips · upper-push · 3 sets · AMRAP · (no weight)
   - Leave day unassigned · Active checked · **Save**.
4. **Park run** — back in Library, **+ New** → **Run** tile → name "Park
   run" → target distance 5 km → energy: aerobic → notes "Easy zone-2" →
   assign Wed → Active → **Save**.
5. **Vinyasa** — **+ New** → **Yoga** tile → name "Vinyasa" → duration 60
   min → style "vinyasa" → no day → Active → **Save**.
6. Confirm all three appear in the Library list with sensible one-line
   summaries.
7. **Force-reload** the app (shake → Reload, or kill + reopen). Library
   still shows all three.
8. **Edit** Push Day: change weight on bench to 85 kg → Save. Re-open;
   confirm 85 kg sticks.
9. **Swipe-delete** Vinyasa. Confirm it's gone and the other two remain.

If anything's off — wrong UI, fields don't stick, crash, navigation gets
stuck — flag the exact step and I'll fix.

---

## Known followups (not blocking Pass 1)

- **Deeper surface-form extraction** (scope decision above). Worth doing
  alongside Pass 3.
- **Exercise-library autocomplete** for gym templates — depends on Phase 4
  Pass 4 landing first.
- **Richer climbing template shape** — current "style + grade range +
  sends" is light. May want planned routes or per-grade breakdown when
  Pass 3 reveals what climbing-session pre-fill actually needs.
- **Swim template UX** — pool-mode templates store "target laps" but
  "target distance" is in raw metres only. Should probably display in the
  user's distance unit, like GPS does.
- **No commits made this pass.** Per the handoff house rules, Dylan asks
  for commits.

---

## Files changed

```
core/src/index.ts                                          (1 line)
core/src/sessionTemplate.ts                                NEW
src/storage/migrations/index.ts                            (1 line)
src/storage/migrations/002_session_templates.ts            NEW
src/storage/serialize.ts                                   (+50 lines)
src/storage/sessionTemplates.ts                            NEW
src/storage/index.ts                                       (1 block)
src/storage/__tests__/sessionTemplates.test.ts             NEW (8 tests)
src/lib/sessionFormOptions.ts                              NEW
src/components/index.ts                                    (1 block)
src/components/surface/GymExerciseEditor.tsx               NEW
app/log-session.tsx                                        (refactor; behavior unchanged)
app/templates.tsx                                          NEW
app/edit-template.tsx                                      NEW
app/_layout.tsx                                            (2 routes)
app/(tabs)/training.tsx                                    (Library link)
dev-log/phase-6-pass-1.md                                  NEW (this file)
```

## Test posture

- `npx jest` → **13 suites, 95 tests, all green** (8 new template tests).
- `npx tsc --noEmit` → **0 errors**.
- `npx expo export --platform ios` → bundle generated successfully (caught
  no metro-level issues).
- Live sim verify → **Dylan, per the script above**.
