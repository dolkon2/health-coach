# Nutrition Tab

Full-depth food logging and energy-balance reflection. Symmetry: `Training tab : sessions :: Nutrition tab : food :: Reflect : outcomes`. Today (Home) keeps only the glance; all depth lives here.

## Current shape / status

- Bottom nav position: 4th of 5. Renamed from "Body" back to **Nutrition** (2026-07-10) — "Body" now refers only to the exercise dimension (gym/calisthenics/yoga/mobility/dance/breathwork/PT), keeping one name per concept.
- **Shape resolved (2026-07-10):** top split nav paralleling Training — **Intake** (log, target status, meal list, in-line benchmark progress) vs. **Trend** (expenditure card, weight trend chart, energy-balance history, intake-over-time charts).
- Already exists on `main`: the whole current Nutrition surface (week strip, day nav, per-meal fidelity rows, daily totals) — built under the older `nutrition-tab-plan.md`, being extended by the Intake/Trend split.
- Sequencing: waits on the benchmarks-branch → main merge (PRO-63, in progress), then Pass V2-1 (split nav + relocation) → V2-2 (target setup + status card) → V2-3 (focus lens) → V2-4 (trend view completion).
- A `planning/nutrition-tab-v2-spec.md` build doc is referenced by Notion as "authoritative" for the full V2 spec but **was not found in this repo checkout** — `planning/nutrition-tab-plan.md` is the closest repo doc actually present, and it predates the Intake/Trend split naming.

## Structural pieces / modules

- **Intake** — today's meals with per-item breakdowns, inline per-item delete, tap-to-edit, day's energy total. History: scroll back through past local days (week-strip pattern, MacroFactor-style hybrid layout), per-day totals, tap a day → its full breakdown.
- **Trend** — expenditure card (measured TDEE, tier-2, with error band), weight trend chart, energy-balance history (intake vs. expenditure), intake-over-time charts (custom SVG, no charting library — Reflect idiom).
- **Targets** — now in-scope, **self-set only**, created in one gesture alongside the adherence benchmark. Rendered via a three-valued day engine (hit / missed / unknowable) — never prescriptive, no streaks, no shame. Card idiom: consumed-of-target primary, remaining secondary.
- **Focus mode (flagship idea)** — user picks ONE metric (e.g. protein-only; canonical case is a GLP-1 user) at target-setup time. The whole app then surfaces that number alone (meal rows, logger, benchmark line, Home glance) while full macro capture continues silently underneath — nothing lost if the user switches back to Full mode. Dylan expects this could become the majority mode over time; must feel first-class, not a lite mode.
- **Saved meals** — manage templates (rename/delete; re-logging already exists).

## Full-screen features needing their own design pass

### Intake day view
Meals list with per-item breakdown, inline delete, tap-to-edit, week-strip day nav (hybrid layout: `‹ [day label] ›` row + oval-cell week strip with a logged-food dot, in-tab local state — no stack push, no deep link).

### Log Food (Weigh / Describe)
Weigh (scale + USDA/OFF lookup, highest fidelity) and Describe (text/voice → NLP extraction or direct LLM estimation) input paths. Logger date-picker lets a meal be logged onto a past or future local day. Barcode is a 2.7 fast-follow (schema-ready, not built); Photo is schema-reserved only, no build surface yet.

### Target setup
One-gesture creation of a target + its adherence benchmark together. Needs a design pass distinct from the generic benchmark-creation flow (Settings/Training), since it's meant to feel native to Nutrition.

### Trend / energy balance
Expenditure card with visible error band and confidence (`residualConfidence` / `logCompleteness`); null intake days excluded, never zero-filled. Weight trend chart. This is the 2.6 `ExpenditureReport` engine's first UI surface.

### Focus-mode toggle & lens
The setup flow for choosing a single hero metric, and the corresponding lens applied across meal rows, logger, benchmark card, and the Home Nutrition-today glance module.

## Open decisions

- **Adherence-benchmark history home** — Reflect vs. Profile vs. its own surface; in-line progress on Intake is judged enough for v2, full history placement still open.
- Exact wording/visual of the three-valued day engine (hit/missed/unknowable) — needs a design pass to avoid reading as a streak.
- `planning/nutrition-tab-v2-spec.md`, cited by Notion as authoritative, is missing from the repo — `nutrition-tab-plan.md` (present) may be stale against it; confirm before finalizing Figma specs.
- **Possible constitution tension to flag explicitly:** targets are now in-scope and self-set, which the spec is careful to keep non-prescriptive (no "you should eat X," self-set only, three-valued engine instead of pass/fail). This is a real shift from the original "no targets in v1" locked decision in `nutrition-tab-plan.md` — worth confirming with the user that the self-set framing still satisfies "the user sets their own benchmarks" rather than drifting toward the app defining success. Nothing found here appears to actually violate the constitution, but it's a meaningfully different posture from the doc present in the repo, so it's called out rather than merged silently.

## Out of scope

- No app-suggested/calculated targets — targets are self-set only, paired with a benchmark the user defines.
- No meal-planning grid — "log tomorrow's meal today via a saved meal" (existing date-picker) is explicitly the full scope; no planner, no plan-ahead grid.
- No streaks/shame UI around target adherence — three-valued engine, not pass/fail gamification.
- Barcode and Photo input — reserved in schema, not built (barcode is next fast-follow; photo has no free vision-API path yet).
- Earned-fidelity computation — deferred to Phase 7.
- Nutrition planning / meal templates as a distinct planning surface — parked, no tab home yet (noted in Training's "coming soon").

## Sources used

- Notion: "Pages and Features" (Nutrition summary row — shape, targets, Focus mode, sequencing).
- Repo: `planning/nutrition-tab-plan.md` (Intake/history/energy-balance/trends architecture, locked decisions, pass breakdown), `planning/food-logging-spec.md` (input contract: weighed/barcode/photo/described, fidelity rules, null≠0, LLM-estimation honesty rules), `CLAUDE.md` / `planning/claude-md.md` (constitution — descriptive-by-default, evidence tiers).
- Gap: `planning/nutrition-tab-v2-spec.md`, cited by Notion as the authoritative V2 spec (Intake/Trend split, targets, Focus mode), not present in repo; this doc is reconstructed from the Notion summary plus the older `nutrition-tab-plan.md`.
