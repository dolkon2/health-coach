# Phase 5 — Pass 2: Structured benchmark entry + active list

*Date: 2026-06-29 · Worktree: `~/Projects/health-coach-benchmarks` · Branch: `benchmarks`*

*(Isolated worktree off Pass 1's `f06a049`, branched to escape a parallel session
contending on `~/Projects/health-coach`. See `phase-5-pass-1.md` + the worktree note.)*

---

## TL;DR

You can now create a benchmark and see it. A `Benchmarks →` link on the Training
tab opens a list; `+ New` is a two-step **Structured** flow: pick a tracked thing
(one of your activities, or Bodyweight) → fill the natural target → save. The
**family is derived** from what you filled — a per-window count makes it a cadence,
a direction makes it a trend — **there is no goal-type picker anywhere.** Tap a row
to edit; archive sets it down quietly into a muted section. Deterministic, no LLM.

**Verify posture:** `npx jest` → **26 suites, 264 tests** (10 new, pure logic).
`npx tsc --noEmit` → **0**. `npx expo export --platform ios` → bundle clean (routes
+ screens resolve through Metro). **Live sim tap-through is Dylan's** — script below.

---

## What shipped

### Pure logic (fully tested) — `src/lib/benchmarkForm.ts`

The deterministic core, no React/storage/LLM (mirrors `lib/session.ts`):

- `BenchmarkForm` + `BenchmarkDimension` (`{kind:'activity',activityId}` | `{kind:'bodyweight'}`).
- `buildBenchmarkFields(form, weightUnit)` → `{ resolution, shape, title }`. The
  resolution + shape + **family** all fall out of the dimension and the filled
  fields: activity ⇒ `sessionCount` resolution + `cadence` shape; bodyweight ⇒
  `bodyweight` resolution + `trend` shape. Weight target parsed display-units → kg.
- `validateBenchmarkForm`, `defaultTitle` (a live preview of the auto-title),
  `formFromBenchmark` (edit-mode hydrate, the inverse), `summarizeBenchmark` (the
  one-line "Paddle · 4×/week" / "Bodyweight · down to 75.0 kg" label).
- `src/lib/__tests__/benchmarkForm.test.ts` — **10 tests**: family derivation,
  cadence + trend builds, blank-target pure trend, lb→kg conversion, user title
  override, validation, form round-trip (build → hydrate → rebuild), summaries.

### Screens

- `app/edit-benchmark.tsx` — create/edit, modeled on `edit-template.tsx`. Step 1
  "What are you working toward?": your activity tiles (headline + More) **plus a
  Bodyweight tile** — concrete things you track, never goal types. Step 2: cadence
  shows count + `Week/Month` chips; trend shows `Lose/Gain` chips + an optional
  target weight (blank = direction only). Optional "name it" field (placeholder
  previews the auto-title). Save → `createBenchmark` (`pinned: true`) /
  `updateBenchmark`. Edit mode adds an `Archive` / `Reactivate` action.
- `app/benchmarks.tsx` — the list, modeled on `templates.tsx`. Active benchmarks
  with their one-line summary + `+ New`; archived drop to a muted "Archived"
  section (retrievable, no ceremony). **No swipe-to-delete** — benchmarks archive
  (status lifecycle), they don't hard-delete.

### Wiring

- `app/(tabs)/training.tsx` — a `Benchmarks →` link in the header, above `Library →`.
- `app/_layout.tsx` — `benchmarks` + `edit-benchmark` registered as modal screens.

---

## Lines held

- **No category picker / no goal-type enum.** Step 1 is concrete trackables (your
  activities + bodyweight). Family (cadence/trend) is computed in
  `buildBenchmarkFields`, never shown or chosen. Tested directly (`familyOf`, the
  build tests).
- **Resolution-gates-existence.** Every path resolves to a real dimension before
  `createBenchmark`; the form can't produce a resolution-less benchmark.
- **Count, never streak.** A cadence stores only `count + window`; nothing here
  rewards or streaks.
- **Pull, not push.** Nothing scheduled or notified. `pinned:true` only marks it
  for Today (Pass 3) to *surface on open*.

## Decisions

1. **Two-step activity-first flow** (Dylan's call) — matches the template editor,
   reuses the activity tiles, keeps step 1 free of any goal-type concept.
2. **Header label `Benchmarks`** (Dylan's call, "for now").
3. **Archive lives in the editor**, not a swipe — benchmarks have a status
   lifecycle, not a delete. List shows active prominently + archived muted.
4. **`pinned` defaults true** (carried from Pass 1) — consumed by Pass 3's Today
   cards.

---

## Verify bar — Dylan's tap-through

From `~/Projects/health-coach-benchmarks` (its own deps; **pick a free port** so it
doesn't collide with your other session, e.g. 8086):

```
npx expo start -c --port 8086
# then open it on the sim (coordinate with the other session — one app per sim):
xcrun simctl openurl booted "exp://127.0.0.1:8086"
```

1. **Training tab** → confirm `Benchmarks →` sits top-right, above `Library →`.
2. Tap **Benchmarks →** → empty state ("No benchmarks yet…").
3. **+ New** → "What are you working toward?" → confirm it's your activities **+ a
   Bodyweight tile**, and there is **no "goal type" choice anywhere**.
4. **Cadence:** tap **Paddle** (or Run) → "How many times" `4`, Per **Week** → Save.
   List shows "Paddle · 4×/week".
5. **Trend (threshold):** + New → **Bodyweight** → **Lose** → target `75` → Save.
   List shows "Bodyweight · down to 75.0 kg" (in your unit).
6. **Trend (pure):** + New → **Bodyweight** → **Gain**, leave target blank → Save.
   Shows "Bodyweight · trending up".
7. **Edit:** tap the Paddle row → change `4` → `3` → Save → summary updates.
8. **Archive:** open a benchmark → **Archive** → it drops to the muted "Archived"
   section. Open it there → **Reactivate** → back up top.
9. **Force-reload** the app → all benchmarks persist.

If anything's off — a goal-type picker sneaks in, fields don't stick, a crash, the
summary reads wrong — flag the exact step and I'll fix.

---

## Files changed

```
src/lib/benchmarkForm.ts                       NEW
src/lib/__tests__/benchmarkForm.test.ts        NEW (10 tests)
app/edit-benchmark.tsx                         NEW
app/benchmarks.tsx                             NEW
app/(tabs)/training.tsx                         (Benchmarks → link)
app/_layout.tsx                                 (2 routes)
dev-log/phase-5-pass-2.md                       NEW (this file)
```

## Test posture

- `npx jest` → **26 suites, 264 tests** green (10 new benchmarkForm).
- `npx tsc --noEmit` → **0 errors** (run last).
- `npx expo export --platform ios` → bundle generated clean.
- Live sim tap-through → **Dylan, per the bar above.**

---

## Next — Pass 3: Today status cards

Surface the pinned active benchmarks on Today as factual status: a cadence shows
"2/4 this week" by **counting real logged sessions** in the window (matching the
resolution's activity/modality) — a count that resets without drama, no flame, no
celebration; a trend shows current-vs-target / direction off the weight trend. Then
the benchmark-keyed Reflect view is the later milestone.
