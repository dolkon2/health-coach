# Food Logging — Spec Notes (v0.1)

*Companion to the product overview and correlation-engine spec. Locks the Ring 2 data contract: which APIs, how meals get logged, how fidelity is assigned and earned, and how all of it stays silent.*

---

## Where this sits in the build plans

This is the Ring 2 spec — food logging via API. It assumes the observation schema, timeline, weight-trend engine, and expenditure engine from Ring 1 already exist; earned fidelity in particular is a consumer of the expenditure engine's output, not a standalone feature.

Three things this doc settles:

- **The data layer** — which nutrition APIs back the food database, and why no paid tiers.  
- **The input contract** — the ways a meal enters the system and the fidelity each one carries.  
- **Earned fidelity** — the mechanic where consistent logging quietly raises a meal's confidence, validated against outcome rather than asserted by repetition.

Forward references that land here: the fidelity field (first-class fact, from the overview) gets its concrete capture rules; the plateau-forensics "logging went blurry" move (correlation-engine spec) gets the data it consumes.

---

## Data layer: free only, no vendor lock

This is a self-funded side project with no business entity. The data layer is built entirely on free, open sources. No paid API tiers, no signup beyond a free key.

- **USDA FoodData Central** — the ground-truth backbone. Public domain (CC0), free, \~380k foods with verified nutrient profiles plus a monthly-updated branded-foods set. 1,000 requests/hour per IP, which is far beyond a single-user load. The response format is deeply nested (nutrient IDs, no serving normalization), so the adaptation layer flattens it into the internal schema. We own the adaptation logic, not the database — same principle as the overview.  
- **Open Food Facts** — the barcode / packaged-goods layer. Free, no auth, 3M+ products with UPC lookup. Crowd-sourced, so coverage is patchy and quality varies — which is fine, because provenance maps onto fidelity rather than being hidden.

**Deferred, with a landing place:** FatSecret offers a "Premier Free" tier (startups under $1M revenue) that includes API-side photo recognition and NLP logging. Not adopted now — it requires more setup and a future business posture. The schema reserves room for it as just another input method with its own fidelity ceiling, so adopting it later changes nothing structural.

**Explicitly rejected:** Nutritionix (now \~$1,850/mo, free tier killed — enterprise only).

**Provenance → fidelity mapping** (defaults; see below): USDA lookup \+ weighed \= high · OFF barcode \= medium-high · photo \= low · described \= variable.

**Adjacent rule — input parsing is not part of the data layer.** The free-only constraint above governs food *databases* (USDA, OFF, the deferred FatSecret). Tooling that *parses input* — regex parsers, NLP/LLM extractors, voice transcription — is a different category and is **not** subject to the data-layer rule. An LLM call that turns "two slices of pizza with mushrooms" into structured `{food, quantity, unit}` candidates is permitted; the extracted candidates still flow through the free food-database layer for resolution. Honesty binds across the boundary: a quantity the model can't see stays `null`, never invented; LLM-extracted items inherit the existing `described` input method and its fidelity ceiling, not a new tier. A regex fallback must remain in place so the logger keeps working without network or without a key.

---

## Input contract: four methods, fidelity from what's known

A meal enters the timeline through one of four input methods. Fidelity is computed from **what the system actually extracted**, never from which device or screen captured it.

- **`weighed`** — food scale \+ USDA/OFF lookup. Highest fidelity. The user knows the food and the mass. This is the meticulous-tracker mode. It *feels* like 100% effort — the most a person can do — even though the stored value sits just below 1.0 to account for database-level measurement variance the user never needs to see.  
- **`barcode`** — OFF (or later FatSecret) UPC scan. High item-identity fidelity; portion fidelity depends on whether the whole package was eaten or a serving was eyeballed. Item and portion confidence may be tracked as sub-components of the composite.  
- **`photo`** — AI identifies items and estimates portions; user confirms or adjusts. Low fidelity by nature — portion estimation from a 2D image is fundamentally limited (current vision models run \~36% mean error on weight/energy from food images). This ceiling is a feature, not a bug: it's what lets forensics later surface "your logging went blurry."  
- **`described`** — text or voice, collapsed into one method because the channel is irrelevant. Both run the same NLP extraction pipeline. Fidelity keys off what the parser got: "8 oz ribeye" yields a specific food \+ quantity \+ unit (moderate fidelity); "steak" yields a food with unknown portion (low). Voice tends toward the vaguer end but removes enough friction that meals get logged that otherwise wouldn't — net positive for the expenditure engine, which values coverage over per-meal precision.

Each adjustment a user makes to an AI estimate is itself signal (consistently bumping a chicken estimate up implies something about their portions), feeding the earned-fidelity process below.

> **Shippable surface (Phase 2) — `photo` is schema-reserved only.** Of the four methods, Phase 2 ships **`weighed`** and **`described`**. **`barcode`** is the 2.7 fast-follow (OFF UPC is free and no-auth). **`photo`** stays in the `InputMethod` union as a forward-compatible reservation, but has **no build surface in Phase 2**: no photo UI, no photo adapter, no free-provider hunt. The locked free data layer has no free vision provider and FatSecret's photo tier is deferred. This absence is intentional — do not re-litigate it.

---

## Nutrition focus and data-capture invariants

Nutrition focus — the hero-number choice, e.g. a user who reads protein first versus one who reads calories first — is a **display concern only.** It changes which number surfaces prominently in the food UI. It never changes what gets written.

**Invariant: full macros are always captured.** Every MealLog persists the full macro set (calories, protein, carbs, fat, fiber) whenever the system has them, regardless of focus. A user on "protein focus" still writes calories. This is non-negotiable: the expenditure engine back-calculates TDEE from calories in — if focus could suppress calorie capture, the engine would have nothing to consume and the outcome-measured spine would break. Focus is a lens over the data, never a gate on it.

### Partial logs are a first-class honest state

Capture integrity is separate from focus, but focus makes the underlying issue more visible, so it is settled here. When an input genuinely yields only some macros — a `described` entry like "42g protein" with no food or portion resolved — the missing macros are stored as **`null`**, never as **`0`**, and never **inferred** (no protein×4 calorie fill, no zero-padding).

- **`null` means "not captured"; `0` means "captured, value is zero."** Conflating them is a data-integrity violation. A protein-only log must never read downstream as "you ate 168 calories" or "you ate 0 g fat."
- **Partiality is structural, not a flag.** A MealLog is partial precisely when any required macro is `null`. There is no separate `is_partial` boolean to drift out of sync with the data; a derived `isPartial(meal)` helper reads the null presence. (The macro fields therefore become nullable in the schema — see the plan's Schema additions.)
- **The expenditure engine treats `null` as missing, not zero.** Null macros are excluded from intake, and the per-window residual confidence drops in proportion to how partial the window's logs are. A day of protein-only logs lowers confidence; it never fabricates a low calorie total.
- **No nagging.** The logging UI never pushes the user to "complete" a partial log. Partial is valid. An optional rough-total backfill prompt ("rough calories for that meal?") is explicitly deferred — not a Phase 2 surface.

### Absent nutrition data is a valid user state, not a degraded one

A user whose benchmarks don't frame nutrition as central isn't "missing data" — they're a user for whom this isn't the lens. The engine's only job is to be honest about what it knows; the Reflect tab (Phase 5) decides whether to surface a given confidence based on what the user said they care about. For Ring 2 specifically: expenditure confidence reports low as low (never tuned to "look high enough to display something"); the logging UI never nags toward more logging; and nothing built here contradicts the principle that benchmark intent and engine confidence together — not logging volume — govern what Reflect chooses to show. The full statement lands in the Reflect spec when it is written.

---

## Fidelity display: three tiers, no numbers

Fidelity is stored as a continuous `0..1` value — the engine needs the granularity for expenditure weighting and suspect ranking. It is **never displayed as a number.** The user sees three visual tiers, rendered through the brand-kit treatment:

| Tier | Range | Treatment | Typical source |
| :---- | :---- | :---- | :---- |
| HIGH | ≥ 0.8 | full opacity, solid stroke, solid filled dots | barcode scan · scale |
| MID | 0.4–0.8 | 0.7 opacity, solid stroke, hollow ring dots | text entry · recipe |
| LOW | \< 0.4 | 0.45 opacity, dashed stroke, dotted / no dot | photo guess · AI estimate |

The tier boundaries (0.8, 0.4) are the only numbers in the system, and they live in code, not on screen. The visual *is* the explanation — a user never needs to learn what "fidelity" means as a concept; they just see solid data look solid and rough data look rough.

---

## Earned fidelity: engine-validated, not logger-asserted

The core mechanic. A meal's fidelity can rise over time as the user logs it consistently — but **repetition alone earns nothing.** Logging the same meal four times during a window where weight is doing something unexplained is, if anything, evidence against that meal's accuracy.

### The validation rule

Earned fidelity is a property of a meal template **measured against the expenditure engine's confidence**, not of the template alone. A template earns fidelity only when two things are simultaneously true over an extended period:

1. The same meal keeps appearing (recurrence), and  
2. The expenditure engine's residual stays tight during the windows that include it — i.e. logged intake and actual weight movement tell a consistent story.

When the residual is noisy or drifting, nobody earns anything, because the system can't distinguish accurate logging from errors that happen to cancel. The bar is deliberately high: not "eaten 4 times this week and weight behaved," but closer to "over the past several weeks, every week including this meal 3+ times showed expenditure confidence above threshold."

### Accrual mechanics

- Earned fidelity accrues on the **meal template**, not on individual logs.  
- A template is created when a user **saves a meal**; re-logging from a saved meal is a recurrence event. User-confirmed recurrence is the v1 standard. AI-inferred meal matching is deferred (Phase 7).  
- Starting fidelity is whatever the input method implies. Each qualifying recurrence (recurrence event \+ residual-stability check passing) nudges it up.  
- **Recurrence threshold:** \~4 occurrences before earning can begin — fewer risks reading coincidence as signal. *Placeholder; tune against real data.*  
- **Diminishing returns:** the increment decays with occurrence count (the 5th repetition teaches less than the 2nd). *Placeholder.*

### The ceiling — method-bound, tracked per method

Earned fidelity climbs **within a band, capped by the input method.** A photo-logged meal eaten 50 times might climb from \~0.35 to \~0.55 but never reaches HIGH, because the portions are still visually estimated. The ceiling encodes **systematic error that repetition can't erase** — you can be consistently wrong about the same portion the same way every time.

When a template is logged via mixed methods (photo three times, weighed twice), the ceiling is tracked **per method**: weighed instances stay high-fidelity, photo instances cap lower, and the template's composite is a weighted blend. Switching from weighed to photo never retroactively degrades the older weighed logs, and the forensics engine can read the method distribution shifting over time.

This ceiling is also what keeps forensics alive: without it, every frequently-logged meal would eventually look high-confidence, blinding the "your logging went blurry" move. The ceiling preserves the signal — even a well-worn photo meal carries a reminder that its number is an estimate.

### Cold start

The dependency chain: enough weigh-ins to establish a trend → enough intake logging to calibrate expenditure → enough stable windows with recurring meals to start earning. Realistically 2–3 months before any template begins to climb. This is fine — it's the same patience-over-false-precision discipline as the rest of the product, reappearing as a structural requirement. Consistency is the whole point; fidelity that takes time to build is fidelity that means something.

---

## The silence principle

Earned fidelity is invisible infrastructure. This is non-negotiable.

A fidelity progress bar ("log this 3 more times to raise confidence\!") would reinvent the streak — it would reward the *act* of repetition and incentivize logging meals that weren't eaten. The mechanic would eat itself. Instead:

- Earned fidelity is **never surfaced** as a metric, progress indicator, or goal.  
- It is consumed **only by the forensics engine**, as a filter for ranking suspects during a plateau.  
- The user experiences it solely as **the system getting better at knowing what to rule out** — e.g. at plateau time: "these five meals you eat regularly have been cross-checked against your weight trend over 10 weeks — probably not the problem. These three newer ones are still rough, and they showed up when the stall started."  
- The **only visible moment** is a meal quietly crossing a tier boundary (dashed → hollow-ring), and it happens **without announcement.** The user may never consciously register why; the visual just reflects that the system trusts the data more than it used to.

The person trying to game this would have to eat the same accurately-measured meals for months while their weight does exactly what the math predicts — at which point they aren't gaming anything, they're being consistent. The incentive and the desired behavior are identical. That's the design working.

---

## Architectural decisions lockable now (vs. deferred to Phase 7\)

**Locked now:**

- Data layer is USDA \+ OFF, free only. FatSecret reserved as a future input method.  
- Four input methods: `weighed`, `barcode`, `photo`, `described`. Fidelity computed from extraction, not channel.  
- Fidelity stored as continuous `0..1`, displayed as three tiers, never as a number.  
- Ceiling is method-bound and tracked per method; composite is a weighted blend.  
- Earned fidelity accrues on templates, gated by an expenditure-engine residual-stability check. The logging layer **never promotes its own fidelity** — the template stores occurrences, the expenditure engine stores per-window residual confidence, and a separate process joins them.  
- Earned fidelity is never surfaced; consumed only by forensics.  
- **Phase 2 shippable surface:** `weighed` \+ `described` ship in Phase 2; `barcode` is the 2.7 fast-follow; `photo` is schema-reserved with no build surface in Phase 2 (see the input-contract reservation note).  
- **Full macros are always captured regardless of nutrition focus.** Focus is display-only. Partial logs store missing macros as `null` — never `0`, never inferred. See § Nutrition focus and data-capture invariants.

**Deferred to Phase 7 (genuinely hard, needs experimentation):**

- **Signal attribution.** When the residual is tight, which of the day's meals get the credit? All proportionally, or only ones also present in prior stable windows? Isolating one meal's contribution to system-level accuracy while controlling for everything else eaten is the hard statistics here.  
- AI-inferred meal recurrence (v1 uses user-confirmed saved meals).  
- Exact recurrence threshold and decay curve for the earning increment.

---

## Schema sketch (illustrative, not final)

type InputMethod \= 'weighed' | 'barcode' | 'photo' | 'described';

interface FoodItem {

  source\_db: 'usda' | 'off' | 'fatsecret';  // fatsecret reserved

  food\_id: string;

  quantity: number;

  quantity\_method: 'measured' | 'package' | 'estimated';

}

interface MealLog {

  id: string;

  timestamp: number;

  items: FoodItem\[\];

  input\_method: InputMethod;

  fidelity: number;            // 0..1, composite, computed — never displayed

  fidelity\_ceiling: number;    // set by input\_method, never exceeded

  template\_id?: string;        // links to a saved/recurring meal

}

interface MealTemplate {

  id: string;

  canonical\_items: FoodItem\[\];

  occurrences: { timestamp: number; method: InputMethod }\[\];

  user\_confirmed: boolean;     // v1: created by saving a meal

  // earned\_fidelity is NOT stored here as a logger-asserted value.

  // It is derived by joining occurrences against the expenditure

  // engine's per-window residual confidence. Per-method ceilings

  // bound the climb; composite is a weighted blend.

}

The pointed note: `earned_fidelity` is a derived value, computed by the engine, not written by the logging layer. That separation is the whole integrity of the mechanic.  
