# Handoff — Initial TDEE calculator + the expenditure/nutrition-benchmark foundation

*Bootstrap for a fresh session (Fable) building on the `benchmarks` worktree
(`~/Projects/health-coach-benchmarks`, branch `benchmarks`). Authored 2026-07-02
from a strategy session with Dylan. Source-of-truth companions: the vault note
"Outcome Depth — thinking notes" (Projects/Health Coach/), `planning/benchmarks-spec.md`
v0.4, `planning/food-logging-spec.md`, `planning/correlation-engine-spec.md`.*

---

## The vision (what we're actually building toward)

A **general TDEE estimator that is a better classic TDEE**: same familiar starting
point, but the activity multiplier gets *measured*, not guessed, and **fidelity
carries the uncertainty** so the number is never faked-precise. It graduates from a
day-one prediction into a personal measurement.

The whole thing decomposes into **three separate levers** — keep them separate in
the code, they are not one number:

1. **Range CENTER** ← intake + weight trend (the *measured* burn). MacroFactor's
   residual method: "out" is solved for from what bodyweight actually did, never
   predicted from motion.
2. **Range WIDTH** ← fidelity (how sure we are). High fidelity → tight number; low
   fidelity → wide band. **This already exists in the engine** as
   `residualConfidence = logCompleteness × trendConfidence` (`core/src/expenditure.ts:153`).
3. **What training is worth** ← correlation of the measured center against logged
   sessions, over time. Descriptive, backward-looking.

### The one firewall that must never break (constitution / spine rule 1)

**The measured residual already CONTAINS the user's training burn.** Training data is
what we *correlate the measured burn against* to learn what a session is worth — it is
**never** fed forward to *predict* the burn. The instant we go "you did 4 sessions, so
your TDEE = X," we have rebuilt the wearable's active-calorie guess — the exact
dishonest thing this product exists to replace (see `correlation-engine-spec.md`,
"Don't accidentally rebuild the wearable"). Prediction-from-activity is a **summoned-
coach (Ring 3)** conversation only ("what levers can I pull on my expenditure?"),
never a background mechanic. If you find yourself writing activity → expenditure, stop.

---

## Locked decisions (Dylan's calls + delegated defaults)

- **Cold-start baseline is a labeled weak placeholder.** Day one there is no measured
  data, so the number is a prediction from body metrics + activity, shown with a WIDE
  range and explicitly marked the weak predicted kind. **Measured TDEE overwrites it**
  the moment the weight trend clears the noise floor (`benchmarks-spec.md`, "TDEE
  cold-start"). Never hide that the day-one number is the weak kind.
- **BMR formula:** Mifflin–St Jeor as the floor (needs only height/weight/age/sex).
  If bodyfat% is provided, upgrade to **Katch–McArdle** and narrow the band — give
  more, get a sharper number (fidelity philosophy applied to the formula itself).
- **Fidelity tiers (nutrition capture method), Dylan's revision:**
  - **Tier 1** — incomplete log: a bare macro, e.g. "42g protein." Self-report, lowest.
  - **Tier 2** — describe OR photo (description gets surprisingly accurate).
  - **Tier 3** — weighed / scanned. Precise.
- **Activity at cold-start — two routes (Dylan):**
  - **Route 1 (ships now):** ask a simple "how active are you, typically?" — a
    transparent placeholder, wide band, graduates away as measurement arrives.
  - **Route 2 (future, noted):** "Do you have training plans?" → if so, they set them
    and we *interpret* activity from the planned training. Depends on the Plan tab
    (`phase-6-plan-tab-spec.md`), not built yet. Note it; do not build it this session.
- **Range width:** wide population-formula error on the day-one predicted number
  (~300–500 kcal, per the Cora note); the measured side narrows via
  `residualConfidence`. Exact widths are tunable — flag them, don't agonize.

## Future notes to RECORD (do not build this session)

- **Step + sleep benchmarks** are coming — new behavior/outcome dimensions. The
  `ResolvedDimension` union already reserves `{ metric: 'steps' }` and
  `{ metric: 'sleepDuration' }` as commented additive rows in `core/src/benchmark.ts`.
  Add a backlog note; do not wire.
- **Nutrition benchmark family** (later pass, Dylan awake): cadence (log N days/wk),
  fidelity (% at tier 2–3 — targets the *capture-method distribution*, NEVER the
  engine's earned-fidelity score, which must stay un-goal-able / Goodhart), macro &
  calorie targets (user-planned OR derived from the calculator), bodyweight outcome,
  and eventually **deficit-vs-measured-expenditure** once the residual is wired + mature.

---

## Build scope for THIS session (the initial TDEE calculator, end to end)

Ship the cold-start calculator front to back. Two passes; stop and hand off after.

### Pass 1 — Baseline TDEE engine (pure, `core/`, test-first)

- New pure function, no I/O: `estimateBaselineTdee({ heightCm, age, sex, weightKg, bodyFatPct? })`
  → `{ tdeeKcal, range: { low, high }, fidelity: 'LOW' }`.
- Mifflin–St Jeor BMR × activity factor (Route-1 activity level passed in). Katch–McArdle
  branch when `bodyFatPct` is present, with a narrower band.
- Real unit tests: known-value BMR checks, the bodyfat-upgrade path, range widening,
  a sanity band on a reference adult.

### Pass 2 — Body-metrics capture + a surface

- `useSettings` today holds only units ("real persisted settings come later" — that's
  now). Add persisted body metrics (height, age/birth-year, sex, optional bodyfat) —
  storage + a migration if a table/columns are needed; follow the existing migration
  pattern (`src/storage/migrations/`).
- A profile/settings entry to input them, and a surface that shows the baseline TDEE
  **with its range and the "predicted — replaced by measurement" label**. Honest empty
  state when metrics aren't set yet (never a fabricated number).

**Then STOP.** Do NOT wire the measured residual, build fidelity chunking, or build the
nutrition benchmarks unsupervised — those carry product-decision surface (the firewall,
benchmark UI, the fidelity-goal spec fork) that Dylan wants to do awake. Leave a
`dev-log/` handoff for Pass 3+ instead. Attempting Pass 3 (wiring `estimateExpenditure`
to intake+weight) is allowed ONLY if 1+2 are fully clean and the path is obviously
spine-safe; if in any doubt, stop and hand off.

---

## Guardrails (hard build constraints)

- **Engine-first, test-first.** Pure math in `core/`, tested, before any screen.
- **Verify order:** jest → `expo export --platform ios` → **tsc LAST** (tsc after the
  test files exist — jest strips types and will hide type errors otherwise).
- **Single-concern commits**, a `dev-log/` note per pass, trailer
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Flag, don't reinterpret.** Where a decision isn't locked above, pick the honest
  default, leave a `⚑` note in the dev-log, and keep moving — never silently resolve a
  product question.
- **Honesty spine:** predicted is labeled the weak kind; fidelity carries uncertainty
  (never round to fake precision); `null ≠ 0` (a missing input is never a zero);
  measured overwrites predicted.
- **Secrets:** never commit `.env.local` or real keys; `app.json` holds no secrets.
- **This is an isolated worktree** — do not `rm -rf node_modules` / `expo install --fix`;
  if installing, `npm install --legacy-peer-deps`. Pick an unused Metro port.

## Self-check before finishing (does it reach the vision?)

1. Is the day-one number visibly the **weak predicted kind**, with a range — never a
   bare confident figure?
2. Did you keep the **three levers separate**, and did you avoid *anywhere* letting
   training predict the burn (the firewall)?
3. Does more input → sharper number (bodyfat → Katch–McArdle → tighter band)?
4. jest green, export clean, **tsc 0 (run last)**; single-concern commits + dev-log.
5. Did you RECORD (not build) the step/sleep benchmarks and the nutrition-benchmark
   family for the next session?
