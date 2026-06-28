# Food Logging — Master Fix Ticket

*The Phase-2 food loop. Diagnosis of what shipped, what was broken, and the gameplan to make it real.*

*Companion to `claude-md.md`, `data-model.md`, `product-overview.md`.*

---

## Status

**Current branch:** `claude/food-logging-demo-status-cpgbe8`

**What's done (commit `1df9147`):**
- USDA FoodData Central API client (SR Legacy + Branded only — no more Foundation research papers)
- Per-100g macro extraction by nutrient ID, with title-cased food names
- Search → select → adjust grams → log Observation flow
- Today screen has a "Log food" card

**What's broken or missing** — everything below.

---

## The original demo was half-baked. Here's why.

The version on the user's phone (from a prior session, not in this repo) had four killer bugs that made the whole feature feel broken:

1. **Search returned scientific papers.** USDA FDC has four data types — Branded, SR Legacy, Survey, **Foundation**. Foundation is a research catalog full of strings like *"Effect of Far-Red Light on Biomass Accumulation… Ruby Streaks Mustard."* The query didn't filter, so every search surfaced lab papers next to real food. **Root cause:** missing `dataType` filter. (Fixed in current commit.)

2. **Macros showed dashes.** Foundation/Survey items often have no consumer nutrient panel — protein/carbs/fat just aren't there. Even on items that did, the parser likely walked the `foodNutrients` array by name instead of by nutrient ID, so capitalization or punctuation drift broke it silently. **Root cause:** unstructured nutrient extraction. (Fixed by mapping nutrient IDs 1008/1003/1005/1004/1079.)

3. **Saved meals showed "1 item · saved YYYY-MM-DD" — nothing else.** No food name, no macros, no way to identify what's in there. Useless. **Root cause:** saved-meal storage was abstract before there was a real meal to save. Building this before the underlying food loop worked got the priorities backwards. (Not fixed yet — see Phase 3 below.)

4. **No barcode entry.** This is the *fastest* way to log a packaged food. Its absence makes every entry feel like work. **Root cause:** out of scope on first pass. (Not fixed yet — Phase 4.)

Underneath all four: **the original demo was building UI ahead of the data layer working.** Saved-meals UI without a search that returns real food. Two tabs ("Search & Weigh" / "Describe") before either was solid. The fix is to rebuild ground-up: the search has to actually work, then quantity, then daily totals, then meals, then barcode.

---

## Constitution check — does food logging belong here, and how

Per `claude-md.md`, food logging is **Phase 2**, the first thing after the daily loop (weigh-in + session) proves itself. It's also where the product's sharpest differentiator lives: **fidelity as a queryable fact.** A gram-weighed meal and a photo guess are the same field at different confidence, so plateau forensics can say *"your logging went 70% photo-estimate — the deficit might be a measurement artifact, not a real stall."*

That means every food entry must carry an honest `fidelity` value:

| Source | Fidelity |
|---|---|
| Barcode scan or gram-weighed entry | 1.0 |
| API search + manual gram amount | 0.7 |
| Free-text description ("8 oz ribeye") | 0.5 |
| Photo estimate / AI guess | 0.4 |

No "felt sense" guesses dressed up as precise numbers. **Confidence is a first-class visual property**, not metadata. The `FidelityIndicator` shows on every food row, every meal summary, every daily total.

What food logging is **not**:
- Goal pickers ("lose weight / build muscle"). The user sets their own benchmarks.
- Macro targets ("you need 180g protein today"). Not the product's job.
- Streaks or "you've logged 7 days in a row." Hard no.
- Push notifications. Not even "you forgot to log lunch."

---

## The four-phase gameplan

### Phase 1 — Make search actually work *(shipped, commit `1df9147`)*

Already in. Concretely:
- `src/services/usda.ts` — search + scaling
- `app/log-food.tsx` — debounced search, results list, quantity adjust, log to storage
- Today screen wired

**Next pass on this:** test it on the device. Search "chicken breast," "rice," "oatmeal," "banana." If any of those return junk, the filter needs to widen (e.g. add Survey/FNDDS for whole foods) or narrow (drop branded items that pollute the top results for plain ingredients).

---

### Phase 2 — Make daily intake visible

You can log food, but the Today screen still says "No food logged today." That's a lie the moment you log one.

**Build:**
- `src/storage/queries.ts` (or extend `observations.ts`) — `listFoodEntriesForDay(localDate)` returning all `foodEntry` observations within a civil-day window in the user's tz.
- On `app/(tabs)/index.tsx`, replace the empty state with:
  - **Daily totals card**: total kcal + protein + carbs + fat for the day. Use data font, no targets, no progress bars. Fidelity indicator = weighted avg of the day's entries.
  - **Entry list**: each logged food as a small row (description, kcal, fidelity dot). Tap to view/edit/delete.
- Tap an entry → `app/food-entry/[id].tsx` modal with edit (re-opens the same scaling UI, `supersedeObservation`) and delete.

**Done when:** logging a food on Today screen, closing the modal, and seeing it on Today within 1 second. No fabricated numbers — if no food logged, show "Not logged" not "0 kcal."

---

### Phase 3 — Recent foods + composite meals

Saved meals failed the first time because they were built before the food data was real. Now that search works, retry — but split the concept honestly:

**3a. Recent foods (cheap, high-value).** A horizontal scroller above the search field showing the last 10 distinct foods this user logged. Tap one → goes straight to the quantity-adjust step with last-used grams pre-filled. **No new data model needed** — derive from `listObservations({ kinds: ['foodEntry'] })` deduped by `description`.

**3b. Saved meals (composite).** A meal is multiple food items logged together. New payload in `core/src/observation.ts`:

```ts
export type MealPayload = {
  kind: 'meal';
  name: string;
  items: Array<{
    description: string;
    grams: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    source: ObservationSource;
  }>;
};
```

Or keep it flat: a meal is just N `foodEntry` observations sharing a `mealId` field in payload. Decide before building (see Open Decisions).

Either way, the UI surface:
- "Save meal" button after logging one+ foods together → prompt for a name, persist.
- Meal library section: each meal shows its **name**, total kcal, and item count (not "1 item · saved date" garbage).

**Done when:** logging "breakfast" once, then re-logging it tomorrow in two taps.

---

### Phase 4 — Barcode scanning

Add `expo-camera` dependency. New screen `app/scan-barcode.tsx` accessible from a camera icon on the log-food header.

UPC lookup:
- **USDA FDC supports `gtinUpc` query** — `?query=<barcode>&dataType=Branded`. Try it first.
- **Fallback to Open Food Facts**: `https://world.openfoodfacts.org/api/v2/product/<barcode>.json`. Free, no key, has barcode coverage USDA misses.

Match → jump straight to the quantity-adjust step with `fidelity: 1.0` (the barcode means we know exactly what the product is — only grams uncertain). Pre-fill grams from the package serving size if available.

No match → fall back to text search with the partial info shown.

**Done when:** scanning a protein bar, hitting log, and walking away in under 5 seconds.

---

### Phase 5 — Describe (AI estimation) + photo

Describe is real and uses AI. Two entry points sharing the same backend:

- **Free text**: user types "8 oz ribeye, medium-rare, side of asparagus." LLM call returns macros + a parsed description. Entry persists with `source: { type: 'photoestimate', modelVersion }` and `fidelity: 0.5` (text is more specific than a photo, less than a weighed amount).
- **Photo**: small camera icon. Image → multimodal model → macros. `fidelity: 0.4`.

Both write to the same `foodEntry` payload as Search & Weigh. The only difference is `source` and `fidelity`. The fidelity indicator on the entry row tells the truth about how it was captured.

This phase only ships after Phases 1–4 are solid.

### Note: AI coach (separate concern)

The user is considering an AI coach feature. **It does not belong on the home screen** — per the constitution, AI in the plumbing, never on the surface; pull not push. Any coach surface ships as its own tab or pull-only entry point, not as a notification, not as a card on Today. When this gets specced, it goes through the constitution checklist before any code.

---

## What's *not* in scope (intentional)

- **Targets, goals, recommended intake.** Constitution.
- **Streaks, "you logged X days," charts of "consistency."** Gamification.
- **Notifications, "you usually log lunch around now."** Push, not pull.
- **Branded "recommended for you" foods.** Library content is browsable; nothing is pushed.
- **Macro splits as percentages of target.** No target = no percentage.
- **Population-default activity multipliers** (no "lightly active = 1.4×"). Expenditure comes from the trend engine in Phase 2 of the broader build, not from a Mifflin-St Jeor table.

---

## Open decisions (need a yes/no before building)

1. **Meals: flat or composite payload?** Flat (N food entries with a shared `mealId`) is simpler; composite (a new `MealPayload`) is cleaner for the engine. The flat approach also makes deleting/editing individual items in a meal trivial. **Recommendation: flat, with `mealId` and `mealName` optional fields on `FoodEntryPayload`.**

2. **Which dataset filters for search?** SR Legacy + Branded gives recognizable whole foods + packaged items. Adding Survey (FNDDS) helps for things like "lunch combo" entries but adds noise. **Recommendation: ship with SR Legacy + Branded; revisit after dogfooding two weeks.**

3. **Free-text fallback when no match?** When search returns 0 results, do we (a) say "no match, try again," (b) offer to free-text estimate via AI, or (c) save it as a tier-1 entry with description only and macros = unknown (`null`)? Option (c) is the most honest but breaks the daily-total math. **Recommendation: (b) when AI is ready (Phase 5), (a) until then.**

4. **Edit-by-superseding or in-place?** Storage layer supports `supersedeObservation` (append-only edits). Should food edits use it? Yes for trend integrity — but it means deleting a wrongly-logged food creates an audit trail row that has to be filtered out. **Recommendation: use supersede for edits, hard-delete only for entries logged in the last 60 seconds (typo recovery).**

---

## Files to touch, by phase

| Phase | New files | Modified files |
|---|---|---|
| 1 *(done)* | `src/services/usda.ts`, `app/log-food.tsx` | `app/_layout.tsx`, `app/(tabs)/index.tsx` |
| 2 | `src/storage/queries.ts`, `src/components/DailyIntakeCard.tsx`, `app/food-entry/[id].tsx` | `app/(tabs)/index.tsx`, `src/storage/observations.ts` |
| 3 | `src/components/RecentFoods.tsx`, `src/services/meals.ts` | `app/log-food.tsx`, `core/src/observation.ts` (FoodEntryPayload + mealId) |
| 4 | `app/scan-barcode.tsx`, `src/services/openfoodfacts.ts` | `app/log-food.tsx`, `package.json` (expo-camera) |
| 5 | `src/services/ai-estimate.ts` | `app/log-food.tsx` (search field becomes universal) |

---

## Success criteria (the dogfood test)

You're done with food logging when, over one full week of real use:

- You log every meal without thinking "I should really pull out the app for this."
- You can identify any past day's log at a glance — no "1 item · saved date" mystery boxes.
- The Today screen shows what you actually ate, with honest macros and honest confidence.
- You don't lie to the log. (If the UI nudges you toward a fake-precise number, fix the UI.)
- You'd rather log here than in MyFitnessPal. If not, find out why and fix it.

If those hold, Phase 2 is real. If not, the loop isn't done — keep iterating before moving on.
