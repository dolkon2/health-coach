# Handoff — Build the whole expenditure + nutrition-benchmark system

*Bootstrap for a fresh hands-off session (Fable) on the `benchmarks` worktree
(`~/Projects/health-coach-benchmarks`, branch `benchmarks`). Authored 2026-07-02
from a strategy session with Dylan, who wants the ENTIRE system built while he
sleeps. Every product decision below is pre-locked so you never have to guess —
if you hit one that isn't, pick the honest default, leave a `⚑` in the dev-log,
and keep going. Source-of-truth companions: vault note "Outcome Depth — thinking
notes" (Projects/Health Coach/), `planning/benchmarks-spec.md` v0.4,
`planning/food-logging-spec.md`, `planning/correlation-engine-spec.md`.*

---

## The vision

A **general TDEE estimator that is a better classic TDEE**: the familiar starting
point, but the activity multiplier is *measured*, not guessed, and **fidelity carries
the uncertainty** so the number is never faked-precise. It graduates from a day-one
prediction into a personal measurement. On top of it sits a **nutrition benchmark
family** — the goal layer for food, the same two-face (behavior/outcome) model the
training benchmarks already use.

**Three separate levers — keep them separate in code, they are not one number:**

1. **Range CENTER** ← intake + weight trend (the *measured* burn; MacroFactor's residual).
2. **Range WIDTH** ← fidelity. Already in the engine: `residualConfidence =
   logCompleteness × trendConfidence` (`core/src/expenditure.ts:153`).
3. **What training is worth** ← correlation of the measured center against logged
   sessions. Descriptive, backward-looking. **NOTE-ONLY this session** (see below).

### The firewall that must never break (spine rule 1)

The measured residual **already contains** the user's training burn. Training is
*correlated against* the measured burn to learn what a session is worth — **never fed
forward to predict it.** "You did 4 sessions, so TDEE = X" rebuilds the wearable's
active-calorie guess, the exact thing this product replaces. Prediction-from-activity
is a summoned-coach (Ring 3) conversation only. If you write activity → expenditure, stop.

---

## Locked decisions (do not re-litigate — build to these)

- **Cold-start baseline = labeled weak placeholder.** Day one has no measured data, so
  the number is predicted from body metrics + activity, shown with a WIDE range,
  explicitly the weak kind. **Measured overwrites it** once the weight trend clears the
  noise floor. Never hide that day-one is weak.
- **BMR formula:** Mifflin–St Jeor floor (height/weight/age/sex). Bodyfat% given →
  Katch–McArdle + narrower band (give more, get sharper).
- **Fidelity tiers (nutrition capture method) — Dylan's revision:**
  - **T1** — incomplete log: a bare macro, "42g protein." Lowest.
  - **T2** — describe OR photo (description gets surprisingly accurate).
  - **T3** — weighed / scanned. Precise.
- **Activity at cold-start:** **Route 1 (build now)** — ask "how active are you,
  typically?", a transparent placeholder, wide band, graduates away. **Route 2
  (NOTE-ONLY)** — "do you have training plans?" → interpret activity from them; depends
  on the unbuilt Plan tab.
- **Fidelity benchmark firewall (resolves the food-spec tension):** a fidelity
  benchmark targets the **capture-method distribution** (e.g. "80% of entries at T2+"),
  a behavior the user controls. It must **NEVER** target the engine's derived
  *earned-fidelity* score — making that a goal corrupts it (Goodhart). Two different
  numbers; keep them apart.
- **Macro targets = user-planned OR calculator-suggested.** The calculator may *offer* a
  target (baseline TDEE + a rule like 0.8 g protein/lb, deficit for a weight goal), but
  it lands as a benchmark the user **owns and edits** — prescription-on-request, never
  imposed. Default the field to the suggestion; let them overwrite it.
- **Nutrition benchmarks reuse the existing two-face model + entry flow** — extend
  `src/lib/benchmarkForm.ts`, `app/edit-benchmark.tsx`, `app/benchmarks.tsx`, the Today
  cards, and the Reflect rhythm/hero. Do NOT invent a parallel system.
- **`days` measure type (the new primitive):** `{ type: 'days'; condition; target }` —
  count of days in the window meeting a per-day condition, over week/month. Unifies with
  the sports "outing days" idea. The condition references a daily dimension (protein ≥ X,
  calories ≤ Y, or "day has a complete-enough log").
- **Three-valued day (the honesty win):** for a day-predicate, a complete day is HIT or
  MISSED; an incomplete-data day is **UNKNOWABLE** — rendered hazed (reuse the shipped
  in-progress rhythm-bar treatment), never counted a miss, never breaks or extends a
  revealed run. Averages compute over complete days only, with completeness shown
  ("2,180 avg · 5 of 7 days logged"), never zero-padded (`null ≠ 0`).
- **New `ResolvedDimension` members (additive union in `core/src/benchmark.ts`):**
  `{ metric: 'calories' }`, `{ metric: 'macro'; macro: 'protein'|'carbs'|'fat'|'fiber' }`,
  `{ metric: 'loggingConsistency' }`, `{ metric: 'loggingFidelity' }`, and
  `{ metric: 'energyBalance' }` (measured intake − measured burn; the deficit outcome).
  Migration if columns/format require it; the benchmark payload is JSON so likely not.

## NOTE-ONLY — record in the dev-log/backlog, do NOT build

- **Training ↔ measured-burn correlation** ("your real multiplier is ~1.6"). Depends on
  the correlation engine, its own spec. The measured TDEE ships without it.
- **Step + sleep benchmarks.** The union reserves `{ metric: 'steps' }` /
  `{ metric: 'sleepDuration' }` as commented rows. Note; don't wire.
- **Plan-tab activity Route 2.** Noted above.

---

## Build plan — the whole system, pass by pass, each verified before the next

Build A→F in order. Each is a single-concern commit (or a tight few) + a `dev-log/`
note. Verify every pass (jest → export → tsc LAST) before moving on. Do not stop until
F is green or you hit a genuine blocker you must flag.

- **Pass A — Baseline TDEE engine (pure `core/`, test-first).**
  `estimateBaselineTdee({ heightCm, age, sex, weightKg, bodyFatPct? }, activityLevel)`
  → `{ tdeeKcal, range: {low, high}, fidelity: 'LOW' }`. Mifflin–St Jeor × activity
  factor; Katch–McArdle branch on bodyfat. Real tests: known BMR values, bodyfat upgrade,
  band widening, reference-adult sanity.

- **Pass B — Body-metrics capture + baseline surface.** Persist height/age(or birth
  year)/sex/optional bodyfat + activity level (real settings; `useSettings` holds only
  units today). Migration as needed (follow `src/storage/migrations/`). A profile/settings
  input + a surface showing baseline TDEE **with range + "predicted, replaced by
  measurement" label**. Honest empty state before metrics are set.

- **Pass C — Fidelity chunking.** Make capture method the legible unit (T1 incomplete /
  T2 describe·photo / T3 weighed·scanned) in the food layer; a method→fidelity mapping
  in `core/`; surface the method on entries. This is the substrate the fidelity benchmark
  and the expenditure band both read.

- **Pass D — Wire the measured residual.** A hook feeding live `estimateExpenditure`
  intake (`dailyTotals`) + weight trend; measured TDEE with a `residualConfidence` band;
  **measured overwrites the baseline** once the trend clears noise; honest "not enough
  data yet" until then. (No training input — firewall.)

- **Pass E — Day-predicate + nutrition-dimension math (pure `core/`, test-first).** The
  `days` measure type; the new dimensions; the three-valued-day counting; energyBalance
  from intake − measured burn (degrades to "not enough data" honestly). Heavy tests —
  this is the logic core.

- **Pass F — Nutrition benchmark entry + surfaces.** Extend the benchmark form/flow to
  create nutrition benchmarks (cadence, fidelity, macro/calorie behavior; bodyweight +
  energyBalance outcome), with the calculator-suggested-but-editable macro target. Today
  cards + Reflect render them via the shipped components (three-valued rhythm for
  day-predicates). Fidelity benchmark targets capture-method distribution only.

**Then STOP** and write a `dev-log/` handoff for what's left (correlation, step/sleep,
Route 2, any `⚑`s).

---

## Guardrails (hard)

- **Engine-first, test-first.** Pure math in `core/`, tested, before screens.
- **Verify order:** jest → `expo export --platform ios` → **tsc LAST**. Keep the FULL
  suite green (currently 305 jest); never let a pass regress it.
- **Single-concern commits**, `dev-log/` note per pass, trailer
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Flag, don't reinterpret.** Unlocked decision → honest default + `⚑` note, keep moving.
- **Honesty spine:** predicted is labeled weak; fidelity carries uncertainty (no fake
  precision); `null ≠ 0`; measured overwrites predicted.
- **Secrets:** never commit `.env.local`/keys; `app.json` has none.
- **Isolated worktree:** no `rm -rf node_modules` / `expo install --fix`; installs use
  `npm install --legacy-peer-deps`; pick an unused Metro port.
- **Optional self-verify (strong if the sim is up):** the iPhone 17 sim has sample data
  seeded. You can seed more via python→sqlite3 in the app's row format, relaunch with
  `xcrun simctl openurl <udid> "healthcoach://expo-development-client/?url=http%3A%2F%2Flocalhost%3A<port>"`,
  deep-link (`healthcoach://reflect`), and screenshot with `xcrun simctl io <udid>
  screenshot` — no taps needed. Terminate the app before writing the DB (WAL).

## Self-check before finishing (does it reach the vision?)

1. Day-one number reads as the **weak predicted kind** with a range — never a bare figure.
2. **Three levers stayed separate**, and training **never** predicts burn (firewall held).
3. More input → sharper number (bodyfat → Katch–McArdle → tighter band).
4. Three-valued days render hit/missed/**unknowable**; runs unbroken by unknowable; no
   zero-padding.
5. Fidelity benchmark targets **capture-method distribution**, not earned-fidelity.
6. Nutrition benchmarks reuse the shipped two-face flow + components (no parallel system).
7. Full jest green, export clean, **tsc 0 (last)**; single-concern commits + dev-logs.
8. Recorded (not built) the correlation, step/sleep, and Route 2 follow-ups.
