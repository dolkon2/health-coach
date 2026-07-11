# Nutrition UX — adjacent-app research for the Nutrition tab spec

*Research note, 2026-07-11. Feeds the Nutrition tab rework (locked: Intake/Trend split + single-metric Focus mode; targets self-set only — never prescribed). Companion to `planning/nutrition-tab-plan.md`, `food-logging-spec.md`, `correlation-engine-spec.md`. Apps surveyed: MacroFactor (closest philosophically), Cronometer, Lose It, and the GLP-1-adjacent single-metric cluster (MeAgain, Pep, Shotsy, MyNetDiary GLP-1, Nutrola). Web-sourced; benchmark numbers from third-party review sites are flagged as claims, not gospel.*

---

## 1. Why these apps, and what we're extracting

The Nutrition tab already has a locked plan (`nutrition-tab-plan.md`): Today-in-full, History, Energy balance, Trends, Saved meals. What's new since that plan is the locked Intake/Trend split, the Focus mode, and the 5-tab shell. This note answers five questions against the field: (a) how the Intake-vs-Trend IA should divide the plan's five surfaces, (b) how focus modes are actually implemented, (c) how self-set targets can render without becoming prescriptive, (d) what fidelity/confidence display precedents exist, and (e) what logging-friction numbers we should design against.

## 2. MacroFactor — the philosophical neighbor

MacroFactor is the only mainstream app built on the same spine as our expenditure engine: intake + weight trend → TDEE solved as a residual, never predicted from a formula. `correlation-engine-spec.md` already credits the method. Its UX choices are therefore the highest-signal reference — and also the sharpest place to mark where we diverge.

### 2.1 The IA: log surface vs. interpretation surface

MacroFactor splits cleanly into a **Food Log page** (timeline of the day, plus three swipeable widgets pinned at the top: *Nutrition & Targets* — today in the context of weekly targets; *Energy Balance* — the last month of eating vs. expenditure; *Daily Nutrition* — just today) and a **Dashboard** ("Insights & Analytics": Expenditure, Weight Trend, Goal Progress widgets, each tapping into a full page). The dashboard is user-reorderable — sections can be moved or hidden, and each houses more than the default view shows.

This is exactly the Intake/Trend split, independently arrived at: *the surface where facts enter* is separated from *the surface where facts are interpreted*. The one structural difference worth copying carefully: MacroFactor still leaks interpretation into the log surface (the Energy Balance widget sits at the top of the food log). For us that's wrong — energy balance is a tier-3 modeled value and belongs on the Trend side with its error band, not floating above tier-1 meal facts. Keeping the tiers spatially separated is a cheap, structural way to honor "a modeled value sits beside, never above, a logged one."

**Adopt:** two sub-surfaces; log-side header limited to today's tier-1/2 facts (daily totals, honest nulls); all windowed/modeled material on Trend. **Reject:** modeled widgets headlining the log surface.

### 2.2 Expenditure confidence display

MacroFactor communicates expenditure confidence *visually and gradually*: early in an account's life the expenditure bar renders in a lighter color, darkening as confidence grows; the algorithm carries forward the last high-confidence value across data gaps rather than fabricating a fresh number. Its v3 algorithm also down-weights implausible logging days rather than trusting them blind.

This validates two things our stack already commits to: (1) confidence as a first-class *visual* output, not a number the user must interpret — the same idiom as our fidelity opacity/stroke tiers; (2) "we don't know yet" rendered as visibly-tentative data rather than hidden. Our version goes further than MacroFactor in one honest direction: we show the **error band** explicitly (`ExpenditureReport` + `residualConfidence`), where MacroFactor shows a single line whose *color* encodes trust. Do both — band width and tentative rendering are complementary, and the treatment maps directly onto the existing HIGH/MID/LOW visual grammar (full opacity/solid → 0.45 opacity/dashed).

Note for the rebrand in flight: this means confidence/fidelity rendering must be expressed as **tokens** (opacity steps, stroke styles, the slate-for-tier-3 reservation), not hardcoded colors, so the Gorge palette migration is a token swap, not a redesign. Mechanics only — visual values stay open per the parallel rebrand.

### 2.3 Targets without prescription — the adherence-neutral precedent

MacroFactor offers three program styles: **Coached** (app designs targets), **Collaborative** (user sets macros, app adjusts the calorie budget), **Manual** (user sets everything; the app never assigns or adjusts, but all analytics still work). And across all three it is explicitly **adherence-neutral**: no red numbers when over target, no warnings, no pop-ups, no praise; adjustments derive from actual intake + weight data, never from how well the user "complied." Their stated rationale is that shame-based rendering suppresses honest logging — the same argument our constitution makes from the mirror side.

The mapping for us is clean: **our entire target mechanic is MacroFactor's Manual mode plus their adherence-neutral rendering, and nothing else.** Coached/Collaborative are constitutionally out (population-seeded, app-adjusted targets = prescription; the summoned coach is the only sanctioned door for "give me targets," and its output enters as a user-owned draft). Concretely, adherence-neutral rendering means:

- A self-set target renders as *context on a fact*: consumed-of-target primary, remaining secondary (already the idiom in the Home spec's nutrition-today card, which reuses the tab's three-valued day-engine component — build it once, here).
- Over/under is a **position, not a judgment**: no red, no green celebration, no "you went over." The number and the band, same weight either way.
- No target set → the surface renders totals alone, fully first-class. "No target" is the default state, not a degraded one — no empty target slot, no "set a goal" affordance chasing the user (absent, not empty, same rule as Home's optional modules).
- Never auto-adjust a self-set target. If the measured expenditure drifts away from what a user's target assumed, that's Trend-side information they can *see*; the app doesn't touch their number. (The summoned coach may propose an adjustment — when asked.)

### 2.4 Logging speed

MacroFactor's own materials and reviews converge on the real speed levers being the boring ones: recents/frequents surfaced first, saved meals, and copy-day actions ("to Today"/"to Tomorrow"), with AI describe (text/voice/photo) breaking meals into *editable ingredients* the user confirms — "AI as a speedy collaborator rather than the primary decision maker." That editable-candidates posture is exactly our Describe mode contract (v0.2 amendment: estimates are editable, provenance reads `estimate`, fidelity caps LOW–MID).

## 3. Cronometer — provenance labels and the hide-calories precedent

Cronometer matters for two patterns, not its overall shape (its dashboard is dense, clinical, 80+ nutrients — a different user).

**Per-entry provenance.** Cronometer labels each food's data source (NCCDB, USDA, crowd-sourced) so users can judge accuracy themselves, and its marketing leans on lab-verified vs. crowd-sourced error rates (a cited study: <5% error for lab-verified databases vs. ~27% for crowdsourced). This is the closest shipping analog to our fidelity field — but their answer is a *text label the user must interpret*; ours is a *visual tier that needs no interpretation* (dot + opacity, never a number). Keep ours. The one thing to borrow: provenance detail is available **on tap, in the item editor** — a curious user can see "USDA lookup, weighed" without the list view ever growing a label. Decision (obvious call): fidelity stays a three-tier visual in all list/summary views; source detail lives one tap deep where the item is already editable (the data is already source-tagged; this is exposure, not new capture).

**The hide-calories toggle — the strongest Focus-mode precedent.** Cronometer lets users remove the calorie display entirely and swap the diary's summary column to another nutrient (e.g., protein), while still *capturing* everything. Users describe it as "easily toggle calorie counting off and on." That is precisely our Focus-mode contract, already locked in `food-logging-spec.md` § Nutrition focus: **focus is a display lens; full macros are always captured** (the expenditure engine depends on calories-in even when the user never looks at them). Cronometer proves the pattern ships and that a real audience wants it — including the eating-disorder-adjacent case where *not seeing* calories is the healthy configuration. A mirror that lets the user choose which part of the reflection to look at is still a mirror.

## 4. Lose It — friction benchmarks and the anti-pattern

Lose It is the cautionary reference. Useful numbers first (third-party benchmark claims, treat as order-of-magnitude): its Snap It photo logging measured ~68.7% food-ID accuracy, ±22% portion error, and an ~11.2-second median processing wait — long enough that users reportedly abandon the flow and type instead. Barcode scans across Lose It/MyFitnessPal resolve in ~1–3 seconds. Manual database search runs 30–90 seconds *per item*. Voice/NLP logging lands around 5–10 seconds per meal and wins on multi-item meals (one utterance vs. N searches).

Three lessons:

1. **The photo numbers independently validate our schema decisions.** ~68% ID and ±22% portion error is the measured reality behind our "photo caps LOW fidelity" rule and the spec's ~36%-mean-error citation — and the 11-second dead zone justifies keeping photo schema-reserved rather than shipping a slow, low-fidelity flow. No change needed; the deferral is now externally evidenced.
2. **Barcode's 1–3s resolution is the friction floor.** That's the benchmark the 2.7 fast-follow should be held to (OFF lookup is one HTTP call; achievable).
3. **Anti-pattern inventory:** Lose It paywalls its barcode scanner for new free users (a friction *added* to the fastest input — pure monetization over honesty) and leans on streaks/challenges/celebrations. Both are constitutionally rejected already; listed here so the tab spec can cite a shipping example of what "engagement theater in a nutrition surface" looks like.

## 5. Single-metric focus — the GLP-1 pattern

A distinct app cluster has formed around GLP-1 users (MeAgain, Pep, Shotsy, MyNetDiary's GLP-1 mode, Nutrola): protein/fiber/water as the hero metrics, calories deliberately demoted — reviewers note a calorie-first lens is actively unhelpful when appetite is pharmacologically suppressed and the clinical risk is *under*-eating protein. Their logging pattern: 5–6 small meals a day, and a widely-repeated heuristic that if a log takes more than ~10 seconds, users quit by day three.

What this means for our Focus mode:

- **Focus is one metric, not a theme.** The cluster converges on a single hero number with everything else a tap away — matching the locked decision's "single-metric Focus mode" and the Home card's "a Focus-mode user sees their one metric here, nothing else."
- **Focus changes the hero everywhere the nutrition glance appears** (tab header, Home nutrition-today card), never what's captured (invariant stands) and never what History/Trend can show on request.
- **Focus must not suppress honesty.** A protein-focused day with null protein renders as unknown, not zero — the null ≠ 0 rule survives the lens.
- **Focus + self-set target compose.** A protein-focus user with a self-set protein target gets the same adherence-neutral consumed-of-target rendering, single metric. This quietly serves the GLP-1 audience without building a "GLP-1 mode" (no medication framing, no prescribed protein floor — their target, their number). Decision (obvious call): no dedicated GLP-1/medication features; the general mechanics (focus + self-set targets + low-friction logging) cover the use case descriptively.

## 6. Friction targets to design against

| Method | Field benchmark | Our stance |
| :-- | :-- | :-- |
| Re-log saved meal / recents | ~2–5s (best-in-class default) | Primary path; surface recents + saved meals first in the logger |
| Barcode | ~1–3s | 2.7 fast-follow; hold to this floor |
| Describe (text/voice → editable candidates) | ~5–10s | Shipped; matches MacroFactor's collaborator posture |
| Photo | ~11s wait, ~68% ID, ±22% portion | Stays schema-reserved; numbers validate the deferral + LOW ceiling |
| Manual search | 30–90s/item | Exists as fallback; never the default landing state of the logger |

## 7. Recommendations for the Nutrition tab spec

1. **Map the five planned surfaces onto the locked Intake/Trend split** — Decision (obvious call): **Intake** = Today-in-full + History (week strip, already MacroFactor-informed and locked in the plan's Pass 2) + Saved meals; **Trend** = intake trends + Energy balance. Rationale: Intake holds tier-1 facts and their entry/edit affordances; Trend holds everything windowed, derived, or modeled. Energy balance is unambiguously Trend-side (tier-3, error band, confidence-gated rendering).
2. **Targets = Manual-mode-only + adherence-neutral rendering** (§ 2.3): self-set, consumed-of-target/remaining idiom, no judgment colors, no auto-adjustment, "no target" fully first-class. Constitution: passes "does this define success for the user" because the user authors the number; passes "telling me what to do" because the app only ever *relates intake to a number the user wrote down*.
3. **Focus mode = Cronometer's summary-swap generalized** (§ 3, § 5): one hero metric, display-only, capture invariant untouched, nulls honest, composes with self-set targets, mirrored on the Home card via the shared three-valued day-engine component.
4. **Confidence rendered twice, honestly** (§ 2.2): error band (explicit) + tentative visual treatment (fidelity grammar) for expenditure/energy balance; both expressed as design tokens for the Gorge migration.
5. **Fidelity stays a visual tier; provenance one tap deep** (§ 3). No numbers, no labels in lists.
6. **Logger priority order: recents/saved → describe → barcode (2.7) → search; photo stays deferred** (§ 4, § 6).
7. ⚑ **Genuinely open — where nutrition adherence-benchmark history lives.** Two defensible homes: (a) the Trend side of this tab (an overlay on intake trends: "days within your self-set band," rendered as a factual count, never a streak), or (b) the benchmark surface (Reflect/benchmark detail), with the Nutrition tab showing only today's standing. (a) keeps the nutrition story in one room; (b) keeps all benchmark history in one idiom across domains. This is one of the user's declared open items — presented, not decided.
8. ⚑ **Intake landing view when a target exists but Focus is off:** lead with the four-macro totals card (current plan) or with the target-status component? Both are constitutional; it's a hierarchy call about whether a self-set target *earns* the top slot on the fact surface or stays subordinate to the facts. Leaning: facts first, target-status directly beneath — but this is the kind of tone call the user has overridden before, so flagging rather than deciding.

## Sources

- [MacroFactor — Get to Know Your Dashboard](https://help.macrofactorapp.com/en/articles/22-get-to-know-your-dashboard) · [Top-of-dashboard widgets](https://help.macrofactorapp.com/en/articles/225-understanding-the-widgets-at-the-top-of-the-dashboard) · [Dashboard customization](https://macrofactor.com/dashboard-customization/) · [Expenditure v3](https://macrofactor.com/expenditure-v3/) · [Adherence-neutral](https://macrofactor.com/adherence-neutral/) · [Program styles](https://help.macrofactorapp.com/en/articles/91-program-styles) · [Algorithms & core philosophy](https://www.strongerbyscience.com/macrofactor-algorithms-philosophy/) · [Fastest food logging workflows](https://macrofactor.com/new-food-logger/) · [AI food logging](https://macrofactor.com/ai-food-logging/)
- [Cronometer — Diary overview](https://support.cronometer.com/hc/en-us/articles/360018171731-Diary-Overview) · [Tracking without focusing on calories](https://cronometer.com/blog/tracking-nutrition-without-focusing-on-calories/) · [Cronometer review (Calorie Rankings)](https://calorie-trackers.com/reviews/cronometer/) · [Neura Health hands-on](https://neura.health/insight/cronometer-app-hands-on-review)
- [Lose It / Snap It benchmark (ai-food-tracker.com)](https://ai-food-tracker.com/reviews/lose-it/) · [MyFitnessPal vs Lose It logging speed (NutriScan)](https://nutriscan.app/blog/posts/myfitnesspal-vs-lose-it-2026-which-app-is-faster-d4cb63c7c2) · [Lose It pricing/paywall (NutriScan)](https://nutriscan.app/blog/posts/lose-it-pricing-2026-free-vs-premium-2b4e921555)
- GLP-1 cluster: [MeAgain](https://meagain.com/glp-1-food-tracker-app) · [Pep](https://apps.apple.com/us/app/glp-1-tracker-pep/id6504788281) · [Shotsy](https://shotsyapp.com/) · [MyNetDiary GLP-1](https://www.mynetdiary.com/glp-1-app.html) · [GLP-1 app comparison (learnmuscles.com)](https://learnmuscles.com/blog/2025/11/27/6-best-glp-1-tracking-apps-compared-which-app-actually-works-in-2026/) · [Protein tracking on GLP-1 (Nutrola)](https://nutrola.app/en/blog/best-app-to-track-protein-on-glp1-medication)
- Friction benchmarks: [Voice logging comparison (Nutrola)](https://nutrola.app/en/blog/best-free-app-to-voice-log-food-2026) · [AI calorie counter benchmarks (Amy Food Journal)](https://www.amyfoodjournal.com/blog/ai-calorie-counter-apps)

*Caveat: several benchmark figures (Snap It accuracy/latency, per-method timings) come from competitor-run review blogs; treat as directionally correct, not audited.*
