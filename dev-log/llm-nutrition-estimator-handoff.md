# LLM nutrition estimator — handoff & planning brief, 2026-06-29

**This is a PLANNING brief, not a build spec.** The next session's first job is
to *plan* (architecture + open decisions below), get Dylan's sign-off on the
design, and only then write code. Do not start implementing on read.

## Where we are (as of this handoff)

- `llm-food-parser` was **merged into `main`** (merge commit `cf83921`,
  "merge: describe-mode LLM food parser"). 201/201 jest, tsc 0. The current
  Describe-mode pipeline is now live on `main`:

  > free text → Claude Haiku extracts `{food, quantity, unit}[]` →
  > **each item resolved against USDA** → portions default to 100 g when the
  > unit doesn't map → entries are USDA database rows.

- It works (multi-item phrases produce multiple rows). But Dylan flagged the
  **USDA-resolution step as the weak link** — see "The problem" below.

## The vision (Dylan's words, 2026-06-29)

> "I feel like how I picture it is like when I type to Claude and it gives me
> estimates and calculations, and doesn't necessarily attach to the database."
>
> "I definitely think it should be more LLM, but then capable to be adjusted
> post. Like it referring Burger King burger when I just say 'burger' might not
> really be best. I've had great success logging food when showing Claude
> photos and describing some."

So the target Describe experience is **Claude estimates the nutrition directly**
— like a conversation with a nutritionist who eyeballs it — **with the numbers
editable afterward**, and (later) **photo input** feeding the same pipeline.

## The problem with today's USDA-resolution approach

1. **Wrong specificity.** "burger" → `BURGER KING, Cheeseburger`. The DB match
   invents brand/precision the user never said.
2. **Portion guessing as 100 g.** When the LLM's unit ("slices", "a side")
   doesn't map to a mass, the item falls back to `DEFAULT_PORTION_G` (100 g) —
   rarely what was eaten.
3. **Feels robotic.** Casual language gets force-fit onto rigid rows instead of
   estimated holistically.
4. **Lossy items.** Some items silently miss USDA and get dropped (e.g. "pizza
   / 2 slices" disappeared in testing) — the meal is quietly incomplete.

## Proposed architecture (to be validated in planning)

**Describe mode returns nutrition, not search terms.** Replace the
extract-then-resolve pipeline with a single estimation call:

```
free text (and/or photo) → Claude → [{ name, kcal, proteinG, carbsG, fatG,
                                        portionText, estimatedGrams?, basis }]
                         → editable rows → user adjusts → log
```

- **No USDA call in the Describe path.** USDA stays the engine for "Search &
  Weigh" (precision mode), untouched.
- **Items are keyless estimates.** No `foodId` / `sourceDb`. This is the crux
  of the data-model work (see Decision D).
- **Every row is editable** before logging: name, kcal, macros, portion.

### Real touchpoints in the current code (so planning is grounded)

| Concern | Where it lives today | What likely changes |
|---|---|---|
| Input methods | `InputMethod = 'weighed' \| 'described'` + `CEILINGS` record in `core/src/nutrition/fidelity.ts` | add an `'estimated'` method (or redefine `'described'`) + its ceiling |
| Meal provenance | `mealSource()` in `src/lib/foodLog.ts` builds `{type:'foodapi', provider, itemId}` from item 0 | needs an LLM/estimate source type — assumes a foodapi today |
| Item shape | `FoodItem` carries `foodId`, `sourceDb` (USDA/OFF) | estimates have neither — keyless item or a new variant |
| Fidelity | `fidelityCeiling`, `defaultFidelity`, `blendComposite` (tiers HIGH ≥0.8 / MID ≥0.4 / LOW) — visual only, never a number | estimates get a LOW (or capped-MID) ceiling |
| Describe call | `extractFoodItems()` in `src/lib/foodNLP.ts` (schema = food/quantity/unit) | new schema returning kcal+macros+portion |
| Routing | `addDescribed` in `src/hooks/useFoodLog.ts` (LLM → USDA resolve → fallback) | LLM → editable rows; no USDA resolve |
| Constitution | `planning/food-logging-spec.md` ("food *data* layer stays USDA+OFF free-only") | direct LLM estimation is a NEW data source — needs amending |

### The fidelity system already supports this (key insight)

The spec's design philosophy is **"fidelity carries the uncertainty rather than
a fake-precise number"** (`foodLog.ts:50`). An LLM estimate fits this *exactly*:
give the estimate a LOW (or capped) fidelity tier, let the existing visual
treatment signal "this is approximate," and keep the best-guess number as an
editable starting point. We do **not** need to invent ranges or hide numbers —
the uncertainty channel already exists. This is the strongest argument that the
redesign is additive, not a teardown.

## Open design decisions — the planning agenda

These are genuine forks Dylan should weigh in on. The session should reach a
recommendation on each, then confirm before building.

- **A. Replace or coexist?** Does direct estimation *replace* the USDA-backed
  Describe mode, or become a third mode alongside "Search & Weigh" and
  "Describe"? (Recommendation to pressure-test: replace Describe's *resolution*,
  keep the Describe tab.)
- **B. Fidelity tier for estimates.** LOW always? Or MID when the user gives a
  weight ("8 oz ribeye") and LOW when vague ("some fries")? Define the ceiling.
- **C. False precision.** Show "657 cal" or round estimates (nearest 5/10/25)?
  Lean on the fidelity visual vs. rounding — pick one, don't do both.
- **D. Data model for keyless estimates.** Can a meal Observation hold items
  with no `foodId`/`sourceDb` and a non-`foodapi` source? This is the biggest
  structural question — audit `FoodItem`, `mealSource`, `ObservationSource`,
  serialization, and the storage migrations before committing to a shape.
- **E. Edit UX.** Inline-editable rows, or tap-into-a-detail-sheet? How does
  editing a macro reconcile with the shown calories (recompute kcal from
  macros, or let them float independently)? HARD review checkpoint — this is
  new UX (per Dylan's review-discipline rule).
- **F. Model choice.** Haiku (fast/cheap, weaker estimates) vs. Sonnet 4.6
  (better nutrition estimates, ~3× cost, slower). Estimation quality matters
  more here than for extraction. Recommend benchmarking a few real meals.
- **G. Photo input — scope now or defer?** Same estimation pipeline with an
  image content block (expo-image-picker + base64). Likely its own pass *after*
  text estimation lands, but plan the schema so photo slots in without rework.
- **H. Honesty review.** "null ≠ 0" still binds: a portion the model can't see
  stays unstated, not invented. Estimates must never masquerade as measured
  data — provenance + fidelity must read "estimated."

## What stays / what changes

- **Stays:** "Search & Weigh" (USDA precision path) entirely. The fidelity
  engine. The "partial meal is valid / no completeness gate" rule. Regex
  fallback for the keyless/offline case (logger must work without a key).
- **Changes:** Describe mode's resolution step; the LLM call schema; the item +
  source data model; `food-logging-spec.md`; likely a storage migration.

## State / hygiene — read before touching git

- **Worktree `~/Projects/health-coach` is now on `main`** (the merge landed
  here). `main` HEAD = `cf83921`.
- **`app.json` holds Dylan's REAL Anthropic key, uncommitted, local-only.**
  Committed value is `null`; that's intentional. **NEVER `git add app.json`.**
  Stage specific files only — never `git add .`. (The merge preserved this: the
  key was stashed during the merge and restored to the working tree after.)
- Two untracked `dev-log/phase-3-pass-2-*.md` files are stray notes from the
  `phase-3-pass-2` branch — not part of this work, leave them.
- **Base note:** `main` was 22 commits ahead of where `llm-food-parser` was cut
  (`fb4335a`); the merge reconciled that. Git now reports `main` is ahead of
  `origin/main` — **do not push** unless Dylan explicitly asks (outward action).
- **Unmerged branches still parked** (per memory): `phase-3-pass-2` (`19c3fc4`,
  HealthKit/wearable, needs its own rebase), `logger-redesign`, `llm-food-parser`
  (now merged — safe to delete after Dylan confirms).
- Run order: plan → code → tests → **tsc LAST**. Single-concern commits,
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. HARD review
  checkpoint before any new UX (Decision E especially).
- Toolchain: Expo SDK 53, TS 5.8.3, jest-expo 53. Sim on **port 8084**. Restart
  with `npx expo start -c` after any `app.json` change (key is bundled at build
  time). No parallel CC sessions on one folder.

## Definition of done for the PLANNING session

1. A written design that resolves Decisions A–H with a recommendation each.
2. Dylan's sign-off on: replace-vs-coexist (A), edit UX (E), and the
   constitution amendment (H) — these three are his calls.
3. A phased build plan (text estimation first; photo input as a later pass)
   with the data-model change (D) scoped as its own commit before UI work.
4. `food-logging-spec.md` amendment drafted for review (not yet merged).
5. Only then: begin implementation, smallest vertical slice first.
