# Ring 2 — Food Logging — Build Plan (v0.1)

*Implementation plan for the Ring 2 / Phase 2 food-logging spec. Consumes
`food-logging-spec.md` (the data contract), obeys `claude-md.md` (constitution),
slots into the build sequence in `game-plan-and-prompts.md`. Reconciled against
`core/src/observation.ts`, `timeline.ts`, `expenditure.ts` and the app-side
`src/storage` / `src/lib` layers as they exist on 2026-06-27.*

*This is a planning pass. No implementation code is written here — the output is
the pass breakdown a reviewer signs off on before the first session runs.*

---

## 0. Orientation — what already exists, what Ring 2 adds

Ring 1 shipped the spine this plan attaches to:

- **`Observation`** (`core/src/observation.ts`) — the one record type. Top-level
  `fidelity: number` (0..1) and `tier: Tier` are already present and load-bearing.
  `ObservationSource` already has a `foodapi` provenance variant and a
  `photoestimate` variant. `FoodEntryPayload` already exists but is **flat**
  (`description, servings, kcal, proteinG, carbsG, fatG, fiberG?, alcoholG?`).
- **`expenditure.ts`** — signature only; `estimateExpenditure()` returns
  `notImplemented(...)`. Its own header says it is *"Fully wired in Phase 2 (food
  via API)"* — i.e. it is **our** job to implement, because Phase 2 is the first
  time intake data exists.
- **Storage** (`src/storage`) — one generic `observations` table (JSON `source` /
  `payload` columns), append-only edit semantics, a `benchmarks` sibling table,
  a versioned migration registry (`001_initial`). The engine never touches SQLite;
  `src/lib` and `src/storage` own all I/O.

Ring 2 adds three things, in dependency order: (1) a nutrition **data layer**
(USDA + OFF adapters), (2) a richer **meal-log contract** + templates + the
per-method fidelity model, and (3) the **expenditure engine wired for real** —
which is the prerequisite that earned fidelity later consumes.

> The legend in `game-plan-and-prompts.md` budgets Ring 2 / Phase 2 as **"3
> passes."** That was a placeholder, exactly like Phase 4's original 3-pass
> placeholder that the HALT deep-dive expanded. The honest decomposition below is
> **6 core passes + 2 fast-follow**, with earned fidelity's scoring deferred to
> Phase 7. Recommend updating the legend row rather than forcing the work into 3.

---

## 1. Pass breakdown

Each pass is one clean Claude Code session: a single concern, a clear
start/end, and a green-tests exit. Passes are ordered so each one's exit
unblocks the next. Tests run with the existing `jest` + `jest-expo` setup;
**`tsc` runs last in each pass, after the test files are written** (per the
standing verify-order rule).

### Pass 2.1 — Core nutrition schema + fidelity module *(core, no I/O)*

- **Scope.** Add the Ring 2 types to the core and the pure fidelity math. No
  network, no SQLite, no UI. This is the pass that touches the core record type,
  so it is isolated and goes first.
  - Extend `FoodEntryPayload` → carry `items: FoodItem[]`, `inputMethod`,
    `fidelityCeiling`, `templateId?` while keeping the flat macro rollup always
    populated (see §3).
  - Macro fields (`kcal`, `proteinG`, `carbsG`, `fatG`) become `number | null`:
    `null` = not captured (partial log), distinct from `0` = captured zero. Full
    macros are still always written **when known**, regardless of focus (focus is
    display-only; there is no `focus` field on the log). Partiality is structural
    (any required macro `null`) — no `is_partial` flag; add a derived
    `isPartial(meal)` helper. Behavior is tested in 2.4 (capture) and 2.6
    (engine). See spec § Nutrition focus and data-capture invariants.
  - Add `InputMethod`, `FoodItem`, `MealTemplate` types.
  - New `core/src/nutrition/fidelity.ts`: `defaultFidelity(method, extraction)`,
    `fidelityCeiling(method)`, `blendComposite(items)`, and the tier mapping
    (`HIGH ≥ 0.8`, `MID 0.4–0.8`, `LOW < 0.4`) as the only numbers in the system.
  - Remove the now-dead `'nutritionix'` literal from `ObservationSource`
    (rejected in the spec) — **flagged core touch, see §5**.
- **Files.** `core/src/observation.ts`, `core/src/nutrition/fidelity.ts` (new),
  `core/src/index.ts` (barrel), `core/__tests__/fidelity.test.ts` (new).
- **Done looks like.** The core compiles with the richer food payload; fidelity
  is computed purely from extraction, never from channel; tier boundaries are
  centralized in one module.
- **Proof.** `fidelity.test.ts`: weighed → ≥ ceiling-band HIGH; `"8 oz ribeye"`
  (food+qty+unit) → MID; `"steak"` (food only) → LOW; a mixed-method composite
  blends to between its parts and never exceeds the highest per-item ceiling;
  tier mapping returns the right band at the 0.4 / 0.8 edges.

### Pass 2.2 — USDA + OFF adapters *(core, pure, fixture-tested)*

- **Scope.** The adaptation logic the spec calls "the thing we own." Pure
  functions: nested API response → normalized `FoodItem` + flat macros +
  provenance + default fidelity. No live network — tests run against captured
  fixture JSON.
  - `usda.ts`: flatten `foodNutrients[]` by nutrient id/number; reconcile
    per-100g (Foundation/SR Legacy) vs `labelNutrients` per-serving (Branded);
    scale to requested quantity.
  - `openfoodfacts.ts`: parse `product.nutriments` (`energy-kcal_100g`,
    `proteins_100g`, …) + `serving_size`; derive a completeness signal that feeds
    fidelity (crowd-sourced → quality varies → reflected, not hidden).
  - Provenance → default fidelity wired through `fidelity.ts` from 2.1.
- **Files.** `core/src/nutrition/usda.ts`, `core/src/nutrition/openfoodfacts.ts`
  (new), `core/src/nutrition/__fixtures__/*.json` (captured responses),
  `core/__tests__/nutritionAdapters.test.ts`.
- **Done looks like.** Both adapters emit the identical internal shape; a USDA
  Branded item and a USDA Foundation item both normalize correctly despite
  different unit bases; OFF completeness maps onto fidelity.
- **Proof.** Feed a real captured USDA Branded fixture → assert kcal/macros per
  requested quantity within rounding; feed an SR Legacy per-100g fixture → same;
  feed an OFF fixture with missing fields → fidelity drops accordingly;
  provenance on each emitted item matches `ObservationSource.foodapi`.

### Pass 2.3 — Food lookup service + cache *(app I/O)*

- **Scope.** The network client the pure adapters sit behind. USDA search +
  fetch-by-id, OFF fetch-by-barcode, the free API key handling, debounced
  search, and a local **recently-used / cached-foods** table (single-user load is
  far under USDA's 1000 req/hr, but offline logging needs a local cache).
- **Files.** `src/lib/foodSearch.ts` (new), `src/storage/migrations/002_*.ts`
  (cached-foods table), `src/storage/foodCache.ts` (new),
  `src/lib/__tests__/foodSearch.test.ts`.
- **Done looks like.** A query string returns ranked candidate foods; a barcode
  returns a product or an honest miss; results hydrate through the 2.2 adapters;
  repeated lookups hit the cache.
- **Proof.** Client tested against mocked `fetch` (no live calls in CI): search →
  candidates; cache hit avoids a second fetch; a 404/empty barcode returns a
  typed "not found", not a fabricated item.

### Pass 2.4 — Meal-log + template persistence *(app storage)*

- **Scope.** Persist meals as enriched `foodEntry` Observations (NOT a parallel
  table — constitution §architecture), and add the `meal_templates` sibling
  table (modeled on `benchmarks`). Save-a-meal creates a template; re-logging
  from it stamps `templateId` on the new log. **Occurrences are not duplicated** —
  they are a query over `foodEntry` observations carrying that `templateId` (each
  already records its `inputMethod`, giving `{timestamp, method}` for free).
- **Files.** `src/storage/migrations/003_*.ts` (`meal_templates`),
  `src/storage/mealTemplates.ts` (new), extend `src/storage/serialize.ts` for the
  richer payload, `src/storage/__tests__/mealTemplates.test.ts`.
- **Done looks like.** A meal round-trips through SQLite with items + method +
  ceiling intact; saving a template then re-logging produces a recoverable
  occurrence list; `earned_fidelity` is **nowhere** in the template table (§4).
- **Proof.** Insert a multi-item weighed meal → read back identical; save
  template, log it 3× via 2 methods → `occurrencesFor(templateId)` returns 3 rows
  with correct per-method tags; template table has no fidelity column.
  - **(Item 1 — focus never gates capture.)** Logging a fully-resolved food under
    a non-calorie focus (e.g. protein focus) still persists all macros; switching
    focus changes nothing in the stored row.
  - **(Item 6 — null vs zero.)** A `described` log that extracts only protein
    writes `null` carbs, fat, and kcal — never `0`, never inferred (no protein×4
    fill); `isPartial()` returns true for it and false for a complete log.

### Pass 2.5 — Logging UI: weighed + described, save-as-template, fidelity tiers

- **Scope.** The two input methods that the locked free data layer fully
  supports today: **`weighed`** (scale + USDA/OFF search) and **`described`**
  (text → NLP extraction → DB match). Save-as-template. Render the three fidelity
  tiers through the brand-kit treatment (opacity / stroke / dot style) — **never a
  number**. Nutrition-focus is a display-only setting (§3). **Confirmed shippable
  surface: `weighed` + `described` only** — no `barcode` (2.7 fast-follow), no
  `photo` (schema-reserved, no surface). **Partial logs render as valid:** no
  "complete this log" nag, no completeness prompt (spec items 6 & 7); the deferred
  rough-total backfill prompt is **not** a 2.5 surface.
- **Files.** `src/app/(tabs)/log-food.tsx` (new) or equivalent route, food-search
  components, fidelity-tier visual component, a settings entry for hero-number
  focus, `src/hooks/useFoodLog.ts`, component tests.
- **Done looks like.** A user can search/weigh a food and log it; type "8 oz
  ribeye" and get a parsed entry; save a meal and re-log it; data that is solid
  *looks* solid and rough data *looks* rough with no fidelity number on screen.
- **Proof.** Component/integration test: logging a weighed meal renders the HIGH
  treatment; a vague described meal renders LOW; switching focus changes only the
  displayed hero number, not stored macros; no numeric fidelity string is ever
  in the rendered tree; a partial (protein-only) log displays with no nag or
  completeness CTA.

### Pass 2.6 — Expenditure engine, wired for real *(core)*

- **Scope.** Replace the `estimateExpenditure` stub. Now that intake exists,
  compute TDEE as the residual (`KCAL_PER_KG` already defined), returning a
  **report of per-window estimates, each carrying its own residual confidence**,
  with an honest `null` intake/TDEE when a window is too sparse or partial to
  total. The per-window confidence API is **locked now** (below) so Phase 7
  earned fidelity forces no second core change.
  - **`timeline.bucketByLocalDay` lands here, in 2.6's declared scope.** Not its
    own pass (that would make 7 core passes, breaking the confirmed count); not in
    2.1 (a schema pass must not smuggle timeline work). Rationale: its only Ring 2
    consumer is this engine's day-bucketing of intake, and the new signature takes
    intake keyed by **local day** — so the function and its consumer are the same
    concern ("expenditure over real day-bucketed windows"). Building it in
    isolation risks the wrong civil-day/tz semantics with nothing to validate
    against. It gets its own dedicated tz-aware test regardless.
  - **Null macros are missing, not zero.** Null intake values are excluded from a
    window's total (never summed as `0`); the window's `logCompleteness` and
    `residualConfidence` drop in proportion to how partial its days are. A
    protein-only day never produces "you ate 168 calories."
- **Output shape (locked — supersedes the current single `ExpenditureEstimate`):**

  ```ts
  type ExpenditureWindow = {
    windowStart: LocalDate;
    windowEnd: LocalDate;
    meanIntakeKcal: number | null;     // null when the window is too partial to total honestly
    trendDeltaKg: number;
    inferredTdeeKcal: number | null;   // residual; null when intake insufficient
    residualConfidence: number;        // 0..1, PER WINDOW — the field Phase 7 earned fidelity consumes
    logCompleteness: number;           // 0..1, fraction of window-days with full (non-null) macro logs
    errorBandKcal: { low: number; high: number };
  };
  type ExpenditureReport = {
    windows: ExpenditureWindow[];
    latest: ExpenditureWindow | null;  // convenience for Reflect; null when none qualifies
  };
  ```

  Versus today's `ExpenditureEstimate`: the scalar `confidence` becomes per-window
  `residualConfidence`, intake/TDEE become nullable, `logCompleteness` is added,
  and results are wrapped in a report. The signature changes from
  `(trend, meanIntakeKcal: number | null)` to `(trend, dailyIntake)` keyed by
  local day. **Flagged core touch — see §5.**
- **Files.** `core/src/expenditure.ts`, `core/src/timeline.ts`
  (`bucketByLocalDay`), `core/__tests__/expenditure.test.ts`,
  `core/__tests__/timeline.test.ts` (new — `bucketByLocalDay`).
- **Done looks like.** Reflect can show a measured TDEE with an error band; the
  residual is solved from intake + trend, never predicted from activity; sparse
  *or* partial data returns `null` / low confidence, not a guess.
- **Proof.**
  - Known synthetic intake + known trend delta → residual within band of the
    hand-computed value; below `MIN_DELTA_DAYS` / no intake → `null` (mirrors the
    trend-engine test style).
  - **(Item 2 — per-window confidence.)** `residualConfidence` exists on every
    window and lies in `0..1`; a window of complete-macro logs scores **higher**
    than an otherwise-identical window with partial logs.
  - **(Item 6 — null is missing.)** A window containing null-macro (partial) days
    reports lower `logCompleteness` and lower `residualConfidence`, and excludes
    the nulls from intake rather than summing them as `0`.
  - `bucketByLocalDay` buckets instants into the user's civil day (tz-aware), not
    UTC slices.

### Fast-follow 2.7 — `barcode` input method

- **Scope.** `barcode` via OFF UPC (free, no-auth) + an RN scanner dependency.
  This is the **only** fast-follow with a build surface. The schema already
  reserves `barcode` with its own ceiling, so adding it is additive, not
  structural.
- **Proof.** Barcode scan → OFF lookup → MID-HIGH log with item/portion
  sub-confidence.

### Fast-follow 2.8 — `photo` (schema reservation only, no build surface)

- **Scope.** None — by design. `photo` stays in the `InputMethod` union as a
  forward-compatible reservation: **no UI, no adapter, no free-provider hunt**
  (item 3). The locked free data layer has no free vision provider and FatSecret's
  photo tier is deferred; current vision models run ~36% mean error regardless.
  Revisit as a later ring once a free/on-device path exists — not a 2.x build.
- **Proof.** N/A — nothing is built. The only assertion is negative: the union
  member exists and no photo surface ships.

### Deferred to Phase 7 — Earned-fidelity join + signal attribution

Not a Phase 2 pass. The *scaffolding* (templates store occurrences; expenditure
exposes per-window confidence; a typed `notImplemented` derivation stub) lands in
2.4 + 2.6 so the integrity boundary is expressed in types from day one. The
*computed value* and attribution are Phase 7 — see §4.

---

## 2. Data-layer plan (USDA + Open Food Facts)

**Two-layer split, dictated by the constitution (engine = no I/O):**

| Concern | Lives in | Why |
| :--- | :--- | :--- |
| Response → internal shape (flatten, scale, fidelity) | `core/src/nutrition/*` | Pure, platform-agnostic, "the logic we own." Fixture-testable, never thrown away. |
| Network, keys, debounce, cache | `src/lib/foodSearch.ts` + `src/storage/foodCache.ts` | Has I/O and a native dependency; app-side by rule. |

**USDA flattening.** The response nests nutrients as `foodNutrients[]`, each with
a `nutrientId` / `nutrientNumber`, `value`, `unitName` — no serving
normalization. The adapter holds a small nutrient-id map and pulls the macros we
store:

| Macro | nutrientNumber | nutrientId |
| :--- | :--- | :--- |
| Energy (kcal) | 208 | 1008 |
| Protein | 203 | 1003 |
| Carbohydrate | 205 | 1005 |
| Total fat | 204 | 1004 |
| Fiber | 291 | 1079 |
| Alcohol | 221 | 1018 |

Two unit bases must be reconciled: **Foundation / SR Legacy** report per-100g;
**Branded** foods report `labelNutrients` per `servingSize`. The adapter
normalizes to per-gram internally, then scales to the user's logged quantity.
This nested→flat normalization is the heart of Pass 2.2.

**Open Food Facts.** `GET /api/v2/product/{barcode}.json` →
`product.nutriments` (`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`,
`fat_100g`, `fiber_100g`, …) + `serving_size`. Crowd-sourced and patchy, so the
adapter derives a **completeness/quality signal** (how many of the required
fields are present and self-consistent) and routes it into fidelity rather than
papering over gaps.

**Provenance → default fidelity** (defaults; tunable, documented with error
band per constitution conventions):

| Source / method | Default | Tier | Note |
| :--- | :--- | :--- | :--- |
| USDA Foundation/SR + weighed | ~0.95 | HIGH | sits just below 1.0 for DB-level variance |
| USDA Branded + weighed | ~0.90 | HIGH | label-declared, small tolerance |
| OFF barcode (complete) | ~0.80 | HIGH/MID edge | item identity high; portion depends on package-vs-eyeball |
| OFF barcode (sparse) | ~0.55 | MID | completeness signal pulls it down |
| `described`, food+qty+unit | ~0.60 | MID | parser got a specific quantity |
| `described`, food only | ~0.30 | LOW | unknown portion |
| `photo` | ~0.35 | LOW | 2D portion estimation ceiling, by nature |

Provenance is recorded on each item via the existing
`ObservationSource.foodapi` / `photoestimate` variants — no new source machinery.

---

## 3. Schema additions

**Guiding decision: a MealLog is an Observation, not a sibling.** The
constitution forbids parallel per-kind tables. The spec's `MealLog` is therefore
realized as an **enriched `FoodEntryPayload`** under `kind: 'foodEntry'`, stored
in the existing `observations` table. The spec's `MealLog.id / timestamp /
fidelity` already live on the `Observation` envelope (`id`, `occurredAt`,
`fidelity`) — only the food-specific fields move into the payload.

**`FoodEntryPayload` — extended (reconciled to existing flat shape):**

- *Add:* `items: FoodItem[]` (composite meals — the `data-model.md` open question
  answered "yes, by Phase 2"), `inputMethod: InputMethod`,
  `fidelityCeiling: number` (set by method, never exceeded), `templateId?: string`.
- *Macros become nullable:* `kcal, proteinG, carbsG, fatG` move from `number` to
  `number | null`; `fiberG?, alcoholG?` stay optional. `null` = not captured
  (partial log), distinct from `0` = captured zero — the two must never be
  conflated (spec § Partial logs). Partiality is **structural** (any required
  macro `null`); a derived `isPartial(meal)` helper reads it — no stored flag.
- *Always populated when known:* the flat macros are the **rollup** of `items`
  and are written whenever the system has them. **Full macros are stored
  regardless of the user's hero-number focus.** Focus is display-only (which macro
  renders large) — there is deliberately **no `focus` field on the log.**
- `description` and `servings` stay for the user-visible label and the simple
  single-item case.

**New types:**

```
type InputMethod = 'weighed' | 'barcode' | 'photo' | 'described';

interface FoodItem {
  sourceDb: 'usda' | 'openfoodfacts';   // 'fatsecret' reserved; 'nutritionix' removed
  foodId: string;
  quantity: number;
  quantityMethod: 'measured' | 'package' | 'estimated';
  // flat macros for this item, normalized by the 2.2 adapter
}

interface MealTemplate {            // NOT an Observation — a saved definition
  id: string;
  canonicalItems: FoodItem[];
  userConfirmed: boolean;           // v1: created by the user saving a meal
  createdAt: ISOInstant;
  // NO earned_fidelity, NO occurrences[] — see §4. Occurrences are a query
  // over foodEntry observations carrying this templateId.
}
```

`MealTemplate` lives in a **`meal_templates` table** modeled on `benchmarks`
(it has no `occurredAt`; it is a definition, not a timeline event — same category
as a benchmark or a draft Session).

**Per-method fidelity ceiling** is a constant table in
`core/src/nutrition/fidelity.ts` (tunable, documented):
`weighed ~0.98 · barcode ~0.85 · described ~0.70 · photo ~0.55`. The ceiling
encodes systematic error repetition can't erase; it is tracked **per method** so
a mixed-method template blends without older weighed logs being degraded by later
photo logs.

**Reconciliation flags against `observation.ts` as it exists:**

- `ObservationSource.foodapi.provider` is already `'nutritionix' | 'usda' |
  'openfoodfacts'`. Spec rejects Nutritionix → **remove the literal** (core type
  change). Spec's sketch said `'off'` → use the existing `'openfoodfacts'`
  spelling; spec's `'fatsecret'` is reserved (add only when adopted).
- `FoodItem.sourceDb` must mirror that provider union — keep the two spellings in
  sync.

---

## 4. The integrity boundary (earned fidelity stays derived)

This is the non-negotiable separation the whole mechanic rests on. Three stores,
three owners, one join:

1. **The logging layer** writes `MealLog` (a `foodEntry` Observation) with a
   *starting* `fidelity` and a method-bound `fidelityCeiling`. It **never
   promotes its own fidelity.** A log's fidelity is set once, from extraction.
2. **The template layer** stores the *definition* only (`canonicalItems`,
   `userConfirmed`). Recurrence is a **query**, not a stored counter — so there
   is nothing on the template a logger could inflate by re-logging.
3. **The expenditure engine** (Pass 2.6) stores **per-window residual
   confidence** — independently computed from intake + weight trend, blind to any
   template.

**Earned fidelity is the join of (1)+(2) against (3) — and it is never written
by the logging layer.** A template earns only when recurrence *and* tight
expenditure residual hold simultaneously over an extended period; noisy residual
→ nobody earns anything. Because residual confidence comes from outcome (weight
trend), repetition alone is inert — which is exactly the silence/anti-streak
property the spec demands.

**Which pass owns the join:**

- **Phase 2 builds the scaffolding** so the boundary is structural from day one:
  templates store occurrences-as-query (2.4); expenditure exposes per-window
  confidence (2.6); a typed `notImplemented('earnedFidelity', 'Phase 7')` stub
  marks the derivation site. No earned-fidelity *value* is computed in Phase 2 —
  and the cold-start (2–3 months of data before anything could climb, per the
  spec) means there would be nothing to compute against anyway.
- **Phase 7 builds the computation**: the recurrence × residual-stability scoring,
  the per-method capped climb with diminishing returns, and — the genuinely hard
  part the spec defers — **signal attribution** (when a window is stable, which of
  its meals get the credit). AI-inferred recurrence and the exact threshold/decay
  curve are Phase 7 too.

Earned fidelity is consumed **only by the forensics engine** (Phase 7) and is
**never surfaced** as a metric, bar, or goal. The only visible artifact is a meal
quietly crossing a tier boundary, without announcement.

---

## 5. Open questions / risks

**Loud — touches the stable Ring 1 core (call before building):**

- **`FoodEntryPayload` extension** (Pass 2.1) changes the core record type. It is
  *pre-sanctioned* — `data-model.md` says items "can be expanded… probably yes by
  Phase 2" — but it is still a core change: confirm before writing. Risk is the
  flat→nested migration of any Phase-1 food rows (likely none yet; verify).
- **Removing `'nutritionix'`** from `ObservationSource` (Pass 2.1) is a core union
  change. Low blast radius (rejected, unused) but it is a core edit.
- **Expenditure output shape** (Pass 2.6) — **DECIDED.** Locked to the
  `ExpenditureReport` / `ExpenditureWindow` shape in Pass 2.6: per-window
  `residualConfidence` + `logCompleteness`, nullable intake/TDEE, wrapped in a
  report. This supersedes the single `ExpenditureEstimate` and changes the
  `estimateExpenditure` signature to take day-keyed intake — a real core edit
  landing in 2.6, called out so Phase 7 forces no second change.
- **`timeline.bucketByLocalDay`** — **DECIDED: rolled into Pass 2.6's scope** (not
  its own pass, to hold the confirmed 6-core-pass count; not in 2.1). It is the
  day-bucketing substrate the windowed, partiality-aware expenditure needs; full
  rationale in Pass 2.6.

**Underspecified for build (spec flags these as placeholders):**

- Recurrence threshold (~4), the diminishing-returns decay curve, and the exact
  per-method ceiling numbers are all "tune against real data." Ship as documented
  tunable constants; do not hard-commit.
- Numeric default-fidelity values in §2 are first-draft bands, not measured.

**Spec tensions worth surfacing:**

- **`photo` is schema-reserved only** — **DECIDED.** "No paid APIs" is locked,
  FatSecret's photo/NLP path is deferred, and current vision models run ~36% mean
  error anyway. Confirmed shippable surface: Phase 2 ships **`weighed` +
  `described`**; **`barcode` is the sole build fast-follow (2.7)**; **`photo` has
  no build surface** (2.8 = reservation only — no UI, no adapter, no provider
  hunt). The value stays in the `InputMethod` union for forward-compatibility.
  "Four input methods" must not be read as "four shippable in Phase 2." Do not
  re-litigate.
- **`described` NLP pipeline** (text and voice share it) needs a parser. Where it
  runs (on-device vs API) and the free constraint are unresolved. Recommend: text
  described first with a simple deterministic quantity/unit/food parser over the
  USDA/OFF search index; voice and richer NLP deferred.
- **Sharing/privacy scoping** (Ring 4 forward-reference in the constitution): meal
  logs and templates must be designed so visibility is a future permission change,
  not a migration. Keep that in mind in 2.4's table design even though nothing
  social ships now.

---

## 6. Recommended sequence & exit

Run **2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6** in order (each unblocks the next; 2.6
can run in parallel with 2.5 since it is core-only, and folds in
`bucketByLocalDay`). Fast-follow **2.7 barcode** after; **2.8 photo** is a schema
reservation only, not a build. Earned-fidelity computation is **Phase 7**, with
its scaffolding already standing from 2.4 + 2.6.

Phase 2 is "done" when: a meal can be logged weighed or described, saved as a
template and re-logged, displayed in honest fidelity tiers with full macros
always stored, and Reflect shows a real outcome-measured TDEE — with the
earned-fidelity boundary expressed in types but no value computed yet.

**Stop here for review before Pass 2.1.**
