# CLAUDE.md — \[app name TBD\]

A personal health \+ training hub. One timeline for training, food, recovery, and outcomes, so inputs can be correlated against results instead of living in separate apps. Built by me, for me — I am the primary user, and that's the strongest starting point, not a limitation.

## North star (non-negotiable)

This product is a **mirror, not a coach that leads.** Every feature is judged against these. If a proposed feature violates any of them, stop and flag it before building — don't quietly reinterpret it into something "safer."

1. **Descriptive, not prescriptive.** Measure what actually happened. Never generate AI plans, targets, or recommended programs.  
2. **Outcome-measured, not predicted.** Derive things like TDEE from real weight trends, not forecasts. Show the user what their body did, not what a model guessed it would do.  
3. **The AI reveals, not invents.** It surfaces what the data shows that the user couldn't easily see themselves. It never predicts the user's future, or tell them what to do. It assumes a competent user and earns its keep by surfacing things they couldn't easily see for themselves.  
4. **The felt sense outranks the model.** When a wearable score conflicts with what you actually did, what you actually did wins. Tier-1 facts \> Tier-2 accumulated \> Tier-3 modeled. A "recovery score" may never gate, override, or contradict a logged session.  
5. **No gamification.** No streaks, badges, scores, points, or shareable body-change content. These are incompatible with an honesty-first product. The pressure to add them will be strongest for beginner/onboarding flows — hold the line hardest exactly there.  
6. **Pull, not push.** The user reaches for things on their own initiative; the system never pushes content at them. Notifications are sparingly earned, not engagement theater. An AI that talks because it's been quiet too long is a notification. An AI that talks because the data finally said something is a coach.

Most products in this space assume the user doesn't know what to do, and sell **coaching**. This one assumes competence and sells **infrastructure** — the system that removes friction from doing the work and seeing it, for the many people who already know what to do and just need the work made easier. Competence is the safe default, not the risky one: when a user's self-model is off, the mirror corrects it gently (the ledger reveals the gap) instead of the product talking down to them. Even the beginner onramp treats the user as capable and lets the data do the teaching.

## The line you do not cross

Before building any feature, check it against these:

- Would a user see this and think "the app is telling me what to do"? → reject.  
- Does this use a population-level equation to generate a personal number? → reject.  
- Does this reward the user with anything that doesn't already exist in the world? (e.g. a badge, a streak count, confetti) → reject.  
- Does this fire without the user asking? Is the trigger "it's been a while" rather than "the data just said something"? → reject.  
- Does this push content at the user rather than letting them pull? → reject.  
- Does this define what "success" means for the user? (e.g. a goal picker limited to "lose weight / build muscle / maintain") → reject. The user sets their own benchmarks; the app relates inputs to each other, not to a prescribed target.

## AI as engine, not face

- AI lives in the plumbing, never on the surface. It turns a photo into a confident calorie estimate, makes a climbing session count as pull volume, notices a stall correlates with a sleep drop. Invisible work.  
- A chat box that keeps prompting is a confession — the product isn't good enough to stand alone. The core loop carries the full weight.  
- The user sees their own stats and what changed. The intelligence leaves no fingerprints.  
- When AI speaks (plateau forensics, pattern detection), it surfaces suspects ranked by how much each moved, with uncertainty shown. It never delivers a verdict the data can't support.  
- Detection thresholds use z-scores against the user's own personal baseline, not population constants. The threshold is visible and user-owned.

## Evidence hierarchy (encoded in types)

Every observation carries a tier:

- **Tier 1 — HAPPENED:** A logged fact or lived experience. Sovereign. Nothing overrides it.  
- **Tier 2 — ACCUMULATED:** A fact that emerges from many tier-1 readings over time (a weight *trend*, a derived expenditure). True by repetition.  
- **Tier 3 — MODELED:** A composite/opinion from an external model (a wearable "strain" or "recovery" score). Lives below the line.

A tier-3 value may never overwrite, gate, or contradict a tier-1 value. It can only sit beside it.

Every observation also carries `fidelity` (0..1): capture precision. A gram-weighed meal is \~1.0, a photo guess \~0.4. Fidelity lets one product serve meticulous trackers and casual loggers without forking into two products — and it lets the AI use logging confidence as a candidate explanation for plateaus.

## Architecture

Plain TypeScript, no platform dependencies. This is deliberate: the core is identical whether the app ships on Expo or native, so the engine is never thrown away.

core/

  src/

    observation.ts   The one record type everything becomes. Tier \+ fidelity \+ source.

    timeline.ts      Orders, windows, and per-day buckets the observations.

    trend.ts         Noisy weigh-ins (tier 1\) \-\> smooth weight trend (tier 2).

    expenditure.ts   Trend \+ intake \-\> measured TDEE, with confidence that rises with data.

    stimulus.ts      Sessions \-\> weekly per-pattern/energy-system ledger \+ reveal().

  demo.ts            Throwaway proof: recovers a hidden true expenditure from noise.

  demo\_stimulus.ts   Throwaway proof: climbing substitutes for pull work; legs gap revealed.

Data flow: things happen \-\> become Observations \-\> timeline orders them \-\> engines turn them into facts (trend \-\> expenditure; stimulus) \-\> only those facts, with confidence attached, are ever shown.

A workout saved from the library is a draft Session — no timestamp, browsable by stimulus intent. It becomes a real Session when the user actually does it and logs the outcome. The system never pushes "recommended for you" content from the library.

Two entry states, not two products: users with an existing plan who want it connected, and users without a plan who get a provisional scaffold that graduates them into the first state as data accumulates.

## Conventions

- TypeScript, ESM. Relative imports use the `.js` extension even though the source is `.ts` — required for the tsx/Node ESM resolver.  
- Heuristics are tunable and must be documented honestly with their error band. KCAL\_PER\_KG \= 7700 and the EWMA half-life are guesses, labeled as such.  
- Any user-facing string the engines produce must be descriptive, not imperative. See `stimulus.ts` `reveal()` for the tone: observations, not orders.  
- Confidence is a first-class output. "We don't know yet" is a valid, honest answer — never paper over it with a fabricated number.

## Build order (rings, inside-out)

1. **Correlation engine \+ stimulus** — the core. Stimulus is done; the correlation step (relating stimulus to outcomes on the shared timeline) is the next piece and stays in this stack-agnostic core.  
2. **Food via API** — integrate a nutrition database via API; do not build one from scratch.  
3. **Sleep \+ steps via HealthKit / Health Connect** — ingestion adapters that emit Observations. Trust step count and sleep hours; treat staged sleep scores as tier-3.  
4. **AI coach, then social layer** — later rings. The coach obeys rule 3 absolutely. Social is framed around showing up, never around outcomes.

## Planning docs

See `planning/` for the full product context:

- `product-overview.md` — north star, features, traps, taglines  
- `correlation-engine-spec.md` — first feature spec (expenditure, forensics, thresholds)  
- `competitive-landscape.md` — Cora, trainhybrid, Edge, etc.  
- `brand-kit.md` — design tokens and visual direction  
- `data-model.md` — the session/log schema (TBD)

