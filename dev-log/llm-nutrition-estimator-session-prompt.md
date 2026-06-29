# Session prompt — LLM nutrition estimator (PLANNING FIRST)

Copy-paste the block below into a fresh session in `~/Projects/health-coach`.

---

Work on the health-coach app in `~/Projects/health-coach` (currently on `main`).
**This session is PLANNING FIRST — do not write feature code until we've agreed
on a design.**

Read `dev-log/llm-nutrition-estimator-handoff.md` first — it's the full brief.
Short version: the food logger's Describe mode currently runs free text through
Claude Haiku and then resolves each item against the USDA database. That USDA
step is the weak link — "burger" becomes "BURGER KING, Cheeseburger", portions
default to 100 g, and some items silently drop. I want Describe mode to instead
have **Claude estimate the nutrition directly** (calories + macros + portion,
no database lookup), show the results as **editable rows I can adjust before
logging**, and later accept **photo input** through the same pipeline. "Search
& Weigh" (the USDA precision mode) stays as-is.

Your job this session:

1. **Plan, don't build.** Enter plan mode. Audit the real touchpoints listed in
   the handoff (fidelity `InputMethod`/`CEILINGS`, `mealSource`/`ObservationSource`,
   `FoodItem` shape, `foodNLP.ts`, `addDescribed`, storage/serialization,
   `food-logging-spec.md`). The biggest unknown is Decision D — whether a meal
   Observation can hold keyless LLM-estimated items with a non-foodapi source.
   Verify that against the actual code before proposing a shape.
2. **Resolve Decisions A–H** from the handoff with a recommendation each.
3. **Get my sign-off** on the three that are my call: replace-vs-coexist (A),
   the edit UX (E), and the constitution amendment (H). Use AskUserQuestion for
   these rather than assuming.
4. **Produce a phased build plan** — text estimation first, photo input as a
   later pass, with the data-model change scoped as its own commit before any UI.
5. Draft the `food-logging-spec.md` amendment for my review (don't merge it yet).

Hard constraints:
- **NEVER commit `app.json`** — it holds my real Anthropic key locally (committed
  value is `null`, intentional). Stage specific files only, never `git add .`.
- Single-concern commits, `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- tsc runs LAST, after tests. HARD review checkpoint before any new UX.
- Honesty binds: a portion the model can't see stays unstated, never invented;
  estimates must read as estimates (provenance + LOW/ capped fidelity), never
  masquerade as measured data. The regex fallback must keep working keyless.
- Default to the latest capable Claude model; decide Haiku vs Sonnet for
  *estimation quality* as part of Decision F (benchmark a few real meals).
- Restart Expo with `npx expo start -c` (port 8084) after any `app.json` change.

Don't push unless I ask. The merged `llm-food-parser` branch can be deleted once
you confirm it's fully in `main`.

---
