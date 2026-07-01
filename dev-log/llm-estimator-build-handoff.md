# LLM nutrition estimator — BUILD handoff (2026-06-29)

**TL;DR** — Describe-mode direct LLM nutrition estimation is **built, verified, and live**.
Phases 0–3 + spec v0.2 landed on `main`; the estimator runs on **Sonnet 4.6**
(commit `ac1edb7` on the current `phase-5-benchmarks` branch). **247/247 jest, tsc
clean.** The live Sonnet call is confirmed working (real, accurate estimates;
billing funded). The feature is functionally done — what's left is small follow-ups
+ photo input (deferred).

This supersedes the planning brief `dev-log/llm-nutrition-estimator-handoff.md`
(that was the PLAN; this is what got BUILT).

---

## What shipped (commits)

On **`main`** (local, not pushed):
| Commit | Phase | What |
|---|---|---|
| `58f67ae` | 0 — data model | `FoodItem.foodId/sourceDb` → optional; `ObservationSource` += `{type:'estimate',modelVersion}`; `Extraction.macrosEstimated`; `mealSource()` keyless branch; `getRecentFoodItems` skips keyless. **No SQL migration** (JSON payload). |
| `e50592d` | 1 — estimator | NEW `src/lib/foodEstimate.ts`: `estimateMeal()` / `estimatedItemToFoodItem()` / `describedToItems()`; `FoodItem.portionText` added. |
| `7d5b519` | 2 — routing | `useFoodLog.addDescribed` calls `estimateMeal` (USDA loop gone from Describe); `logMeal` stamps `estimateModel`. |
| `d272098` | spec v0.2 | `planning/food-logging-spec.md` amendment permitting direct estimation, bound by the honesty contract. |
| `3b4859c` | 3 — edit UI | `app/log-food.tsx` editable estimate rows (tap **Edit** → inline pane); `recomputeKcal` (guarded 4·P+4·C+9·F+7·alc); `useFoodLog.updateItem`. |

On **`phase-5-benchmarks`** (current checkout, cut off `main` *after* the above):
- `48176f1`, `f01dcf6` — **NOT mine** (other session: v0.3 spec reconcile + safe-area padding fix).
- `ac1edb7` — **mine**: `ESTIMATOR_MODEL = claude-sonnet-4-6` (Decision F; ~3× Haiku cost but ~$1/mo at single-user volume).

## Verification status
- **247/247 jest, tsc clean** (full suite).
- **Live API test** — replicated the app's exact `estimateMeal` request (model `claude-sonnet-4-6`, same system prompt + JSON schema) against the real key for *"two eggs and a slice of toast"* → Sonnet returned 2 accurate items (eggs 143 kcal / 12.6P / 0.7C / 9.5F; toast 79 / 2.7 / 14.7 / 1.0), `portionStated: true`, honest `basis`. **Billing is funded.**
- App **builds + loads** on the iPhone 17 simulator (dev client).
- **NOT verified:** the visual tap-through — synthetic clicks don't register in the iOS Simulator (only real taps do). Dylan drives that.

## Decisions as built (A–H)
- **A** Replace (Describe drops USDA-resolution; "Search & Weigh" untouched).
- **B** Weight-aware fidelity: vague → LOW, stated portion → low-MID (~0.45), never HIGH.
- **C** Lean on the fidelity visual; no rounding.
- **D** Keyless model (optional `foodId`/`sourceDb`; `estimate` source; `macrosEstimated`; kept `InputMethod='described'`; no migration).
- **E** Tap-to-edit inline pane.
- **E′** Dylan chose **recompute** calories from macros — built **guarded**: only when P/C/F all non-null, else calories stay (honors `null ≠ 0`). *This was the one override of my recommendation — keep the guard.*
- **F** `ESTIMATOR_MODEL = claude-sonnet-4-6` (flip to `claude-haiku-4-5` to benchmark).
- **G** Photo deferred (seams ready — see below).
- **H** Honesty contract approved (provenance reads 'estimate', fidelity LOW/MID, null≠0).

## Candidate next steps
1. **Phase 4 — photo input** (deferred). Seams ready: widen `callClaude` `userMessage: string | ContentBlock[]`; add `expo-image-picker` + base64; reuse `estimateMeal` with an image block; `{type:'photoestimate',modelVersion}` source is already reserved.
2. **Phase 2.5 — remove `extractFoodItems`/`foodNLP.ts`** (now unused after rerouting). PARKED — Dylan was undecided; one-commit delete, recoverable from git.
3. **More live spot-checks** — run a vague meal ("some fries and a burger" → expect `portionStated:false` → LOW) and a restaurant dish ("chicken tikka masala with naan") to sanity-check Sonnet's range before relying on it.
4. **Phase-5 benchmark layer** — the purpose of the `phase-5-benchmarks` branch (separate effort).

## Key files
- `src/lib/foodEstimate.ts` (estimator + builders; `ESTIMATOR_MODEL`)
- `src/lib/foodLog.ts` (`mealSource` keyless branch, `recomputeKcal`)
- `src/hooks/useFoodLog.ts` (`addDescribed`, `updateItem`, `logMeal`)
- `app/log-food.tsx` (`EstimateItemEditor`, editable rows)
- `core/src/observation.ts` / `core/src/nutrition/fidelity.ts` (data model + fidelity)
- `planning/food-logging-spec.md` (v0.2)
- Plan file: `/Users/dolkoan/.claude/plans/luminous-painting-eclipse.md`

## ⚠️ Operational hazards / must-knows
- **PARALLEL SESSION WAS ACTIVE (2026-06-29).** Another Claude session (scratchpad `f3aa0431…`) ran `expo run:ios --device <physical iPhone> --port 8087` and edited `useWearableSync.ts` / `db.ts` on THIS folder. Metro hot-reloaded its half-saved files into the sim → repeated **"Maximum update depth exceeded"** freezes. **Do NOT run two sessions on one folder.** Before doing anything sim/build/edit: `lsof -i :8081 -i :8084 -i :8087` and `pgrep -fl expo` — if another build is live, stop and coordinate.
- **NEVER `git add app.json`.** It holds Dylan's real Anthropic key in `extra.anthropicApiKey` (uncommitted; committed value is `null`). A real `usdaApiKey` is also committed (pre-existing, low-severity). Stage specific files; never `git add .`. **Don't push** — `main` is local-only.
- **Running the sim** (dev client, NOT Expo Go): `npx expo run:ios` builds native + installs + launches. Installing a prebuilt DerivedData `.app` FAILS (stale native, missing `expo-notifications`/`ExpoPushTokenManager`). Bundle id `com.dylan.healthcoachproject`, sim "iPhone 17". If it freezes: `xcrun simctl launch booted com.dylan.healthcoachproject` to clear. **Synthetic clicks don't register** — only Dylan can tap.
- Discipline: single-concern commits, `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`, `tsc` LAST, HARD review checkpoint before new UX, flag-don't-reinterpret.
