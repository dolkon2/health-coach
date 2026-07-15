# Nutrition Tab v2 — Intake / Trend (post-dimension-merge redesign)

**Status:** planning, decisions Dylan's (locked 2026-07-10 unless marked OPEN).
This doc extends [[nutrition-tab-plan]] (v1, Passes 0–4) — it does not replace the
honesty rules or the built surface; it reshapes the tab around them. Read both at
the start of each pass.

## What changed since v1

- The 5-tab Gorge nav briefly renamed this tab "Body." **Reverted: the tab is
  Nutrition.** "Body" stays reserved for the exercise dimension (`dimension/body`),
  killing the name collision.
- v1 deferred targets to "the benchmark mechanic, Phase 5." Phase 5 shipped
  (benchmarks branch, merging to main now). Targets therefore enter the tab —
  **self-set only**, rendered through the three-valued day engine
  (hit / missed / unknowable), never app-prescribed, never streaks/shame.
- The expenditure + weight-trend surface moves here from Profile/Reflect ambitions.
  This answers the open Notion question: **WeightTrendChart's home is the
  Nutrition tab (Trend view).**

## Shape

Top split nav inside the tab, paralleling Training's:

```
Nutrition
[ Intake | Trend ]
```

### Intake — "the doing view"

The daily loop: log, see where you stand, adjust. Contents (mostly relocation of
what exists):

1. **Day nav + week strip** — exactly the v1 Pass 2 hybrid (‹ day › row, oval week
   strip, in-tab local state). Unchanged.
2. **Target status card** (NEW) — replaces the plain daily-totals card *when a
   target is set*; falls back to the current totals card when none is. Shows
   consumed vs. target for the metrics in the user's target mode, using the
   three-valued day engine: a day is hit / missed / **unknowable** — an
   incompletely-logged day never renders as failure. No rings-that-shame; the
   idiom is the benchmark status-card language already built (Phase 5 Pass 3).
3. **Meal list** — per-meal fidelity rows, breakdowns, edit/delete, gutter
   timeline. Unchanged from what's shipped.
4. **Log food** + saved meals; logger date-picker (Pass 2.5) already covers
   backfill and **log-tomorrow-with-a-saved-meal** — that IS the meal-planning
   scope. No planner, no plan-ahead grid. (Closes the parked
   "nutrition planning / meal templates" Notion item.)
5. **Benchmark progress, in-line** — the nutrition benchmark family (Phase 5
   Passes A–F) surfaces its current-window progress natively here (e.g. "4 of 5
   protein days this week"), not on a separate benchmarks screen. Full adherence
   history / outcome pairing lives wherever benchmarks generally live (OPEN,
   not this tab's problem).

### Trend — "the how-is-it-going view"

Reflection over time; earns its sub-tab by being more than one card:

1. **Expenditure card** — measured-residual-overwrites-predicted, error band,
   confidence treatment. Exists on benchmarks branch (ExpenditureCard); relocates
   from its current Nutrition-tab spot into Trend.
2. **Weight trend** — the Reflect WeightTrendChart (EWMA trend line, honest
   gaps), now homed here. Weigh-in entry point nearby.
3. **Energy balance over time** — intake vs. expenditure per window, the v1
   Pass 3 surface, with unknowable days excluded not zero-filled.
4. **Intake trends** — Cal/macros over time, custom SVG in the Reflect idiom
   (v1 Pass 4, not yet built).
5. (Later, post-HealthKit-expansion: steps/sleep context lines.)

## Targets & the single-macro mode

**This is the flagship product idea of v2.** Two target modes, chosen during
target setup (not a buried settings toggle):

- **Full** (baseline, = current behavior): calories × protein/carbs/fat.
- **Focus** (single-metric): the user picks ONE metric — protein, or calories, or
  any single macro — and the whole tab visually reorients around it.
  Canonical user: Dylan's dad — GLP-1, tracks protein only. Expected to be a
  majority-share mode over time, so it must feel first-class, not "lite."

Focus-mode rules:

- **Surface one number everywhere**: target card, meal rows, logger review step,
  Today-glance total, benchmark progress — all show the focus metric alone.
- **Capture stays full behind the scenes.** Estimators, barcode, label, and
  weighed entries keep writing complete macro records exactly as now. Switching
  modes later loses nothing; history back-fills instantly. Focus mode is a
  *lens*, not a data model change.
- Capture flows may *prioritize* the focus metric (e.g. the estimator's review
  step leads with protein) but never skip honest capture of the rest when the
  source provides it. `null ≠ 0` unchanged — an unknown focus-metric value is
  unknown, and a focus-mode day with unknown values is unknowable, not missed.
- Target setup = the existing benchmark suggested-but-editable prefill flow
  (0.8 g/lb protein, TDEE−300 etc.), extended with the mode choice up front.
  Adherence-benchmark creation happens *in this same setup flow* — setting a
  target and declaring the benchmark are one gesture.

## Honesty rules (carried + amended)

All v1 rules stand: `null ≠ 0`; fidelity is a visual tier, never a number;
energy balance always renders with error band + confidence; modeled never
overwrites logged. Amendment: **self-set targets are now in-scope** — they are
the user's declared intent reflected back (constitution-compatible: descriptive
of *their* goal), rendered exclusively through the three-valued day engine. No
streaks, no nags, no red-shaming of unknowable days. If a rendering choice ever
forces "incomplete day" to look like "failed day," the rendering is wrong.

## Dependencies & sequencing

1. **benchmarks → main merge lands first** (PRO-63; Dylan merging 2026-07-10).
   Trend view is ~70% built there (ExpenditureCard, body profile, day engine,
   nutrition benchmark family, WeightTrendChart pieces).
2. Then this build, on a fresh branch off post-merge main:
   - **Pass V2-1 — Split nav + relocation.** Intake/Trend top nav; move
     expenditure + trends surfaces into Trend; Intake = current day view.
     Pure reshuffle, no new capability.
   - **Pass V2-2 — Target setup flow + target status card.** Mode choice
     (Full/Focus), prefills, benchmark creation folded in; status card wired to
     the day engine.
   - **Pass V2-3 — Focus lens.** The single-metric rendering pass across meal
     rows, logger, Today glance, benchmark line.
   - **Pass V2-4 — Trend view completion.** Intake-over-time charts (old
     Pass 4), energy-balance history polish.
3. The Gorge rebrand/nav work proceeds independently; this tab should adopt the
   brand kit tokens when they land but is not blocked on them.

## Open questions (for Dylan)

- **OPEN-1:** Where does full benchmark adherence history live (Reflect vs.
  Profile vs. own surface)? Parked; in-line progress here is enough for v2.
- ~~OPEN-2~~ **RESOLVED (Dylan, 2026-07-10):** target card primary =
  **consumed-of-target** ("142g / 160g"); remaining shown secondary.
- ~~OPEN-3~~ **RESOLVED (Dylan, 2026-07-10):** focus lens applies
  **everywhere including the Today glance** — one number app-wide in Focus mode.

## Out of scope

- Meal planner / plan-ahead grid (log-tomorrow-via-saved-meal covers the need).
- Prescriptive/coach-generated targets. Never.
- Adherence-benchmark home (OPEN-1).
- Steps/sleep overlays (post-HealthKit expansion).
- Earned-fidelity computation (Phase 7, unchanged).
