# CLAUDE.md — Avatar Training

A personal health \+ training hub. One timeline for training, food, recovery, and outcomes, so inputs can be correlated against results instead of living in separate apps. Built by me, for me — I am the primary user, and that's the strongest starting point, not a limitation.

## North star (non-negotiable)

This product is a **mirror, not a coach that leads.** Every feature is judged against these. If a proposed feature violates any of them, stop and flag it before building — don't quietly reinterpret it into something "safer." Flag it once, plainly, with the reasoning. If the user considers it and overrides anyway, that stands — the rule exists to prevent silent reinterpretation, not to relitigate a decision the user has already made deliberately.

1. **Descriptive by default, prescriptive only on request.** Measure what actually happened. The app never *volunteers* a plan, target, or program — but when the user explicitly asks for one ("here are my goals, give me a plan"), the summoned coach answers fully and honestly (see § The summoned coach). Every unrequested surface stays purely descriptive.  
2. **Outcome-measured, not predicted.** Derive things like TDEE from real weight trends, not forecasts. Show the user what their body did, not what a model guessed it would do.  
3. **The AI reveals, not invents.** It surfaces what the data shows that the user couldn't easily see themselves. It never predicts the user's future, or tell them what to do. It assumes a competent user and earns its keep by surfacing things they couldn't easily see for themselves.  
4. **The felt sense outranks the model.** When a wearable score conflicts with what you actually did, what you actually did wins. Tier-1 facts \> Tier-2 accumulated \> Tier-3 modeled. A "recovery score" may never gate, override, or contradict a logged session.  
5. **No gamification of the mirror.** *Amended 2026-07-11.* The descriptive surfaces — your own logbook, Reflect, Home, every unrequested view — carry no streaks, badges, scores, points, or completion meters, ever. These are incompatible with an honesty-first mirror, and the pressure to add them is strongest in beginner/onboarding flows — hold the line hardest exactly there. **The opt-in social layer is the one sanctioned place applause may live.** By deliberate founder decision (2026-07-11; detail in `planning/rework/research/social-expansion-plan.md`), content a user *chooses to share* may carry kudos and follower counts, and members may set their own segments and leaderboards inside activity groups they create. The boundary is strict and structural, not a matter of taste: (a) a count exists only on content the user deliberately shared — a privately-saved session is never scored, so the mirror stays countless by construction; (b) competition is member-authored inside a member-made group — never app-authored, never global, never a default, never a thing the app starts for you; (c) no shareable body-change content — weigh-ins and the like stay structurally unshareable. The app hosts what people choose to share; it never authors a score, ranks users itself, or defines what winning is. Everything outside that opt-in social layer is still the pure mirror.  
6. **Pull, not push.** The user reaches for things on their own initiative; the system never pushes content at them. Notifications are sparingly earned, not engagement theater. An AI that talks because it's been quiet too long is a notification. An AI that talks because the data finally said something is a coach. *Amended 2026-07-11:* the opt-in social layer may notify on things a person did — a message addressed to you, a comment, a like, a new follower — all user-toggleable, because a human acted, not because the app grew impatient. The line that never moves: no digests, no "you haven't logged in a while," no app-authored nudge engineered to pull you back. A notification may carry only something a person did; it may never be the app talking because it's been quiet too long.

Most products in this space assume the user doesn't know what to do, and sell **coaching**. This one assumes competence and sells **infrastructure** — the system that removes friction from doing the work and seeing it, for the many people who already know what to do and just need the work made easier. Competence is the safe default, not the risky one: when a user's self-model is off, the mirror corrects it gently (the ledger reveals the gap) instead of the product talking down to them. Even the beginner onramp treats the user as capable and lets the data do the teaching.

## The line you do not cross

Before building any feature, check it against these:

- Would a user see this and think "the app is telling me what to do" *without having asked*? → reject. (A summoned-coach answer to an explicit request is the one sanctioned exception — see § The summoned coach.)  
- Does this use a population-level equation to generate a personal number? → reject.  
- Does this reward the user with anything that doesn't already exist in the world? (e.g. a badge, a streak count, confetti) → reject. (Exception, amended 2026-07-11: kudos/follower counts on *deliberately-shared* social content, and member-set segments inside member-created activity groups — a real-world social gesture between people, walled off from the mirror per rule 5.)  
- Does this fire without the user asking? Is the trigger "it's been a while" rather than "the data just said something"? → reject.  
- Does this push content at the user rather than letting them pull? → reject.  
- Does this define what "success" means for the user? (e.g. a goal picker limited to "lose weight / build muscle / maintain") → reject. The user sets their own benchmarks; the app relates inputs to each other, not to a prescribed target.

## AI as engine, not face

- AI lives in the plumbing, never on the surface. It turns a photo into a confident calorie estimate, makes a climbing session count as pull volume, notices a stall correlates with a sleep drop. Invisible work.  
- A chat box that keeps prompting is a confession — the product isn't good enough to stand alone. The core loop carries the full weight.  
- The user sees their own stats and what changed. The intelligence leaves no fingerprints.  
- When AI speaks (plateau forensics, pattern detection), it surfaces suspects ranked by how much each moved, with uncertainty shown. It never delivers a verdict the data can't support.  
- Detection thresholds use z-scores against the user's own personal baseline, not population constants. The threshold is visible and user-owned.

## The summoned coach (Ring 3b) — the one sanctioned exception

*Amended 2026-07-02.* This app is built for users who don't need prescriptive planning — but for those who ask, it's there. If someone says "give me a plan, here are my goals," give them the plan. The exception stays an exception through architecture, not labeling:

- **Summoned only.** It exists when the user opens it and asks. It never initiates, never follows up unprompted, never appears because "it's been a while."  
- **A separate room, not the mirror.** The coach lives in its own explicit mode. Ambient surfaces (Home, the logbook, Nutrition Trend, the ledger — whatever the descriptive surfaces are called in the current shell) never show AI-authored programming.  
- **Output is a draft.** A generated plan enters exactly like a PT-prescribed one: source-tagged, browsable, edited or discarded by the user, logged only when they actually do it. It never writes to the ledger on its own and never overrides a logged fact.  
- **Grounded, not generic.** It reasons from the user's own data — restrictions, medications, history, benchmarks, forensics. Where the data can't support a claim, it says so.  
- **Not medical advice.** Programming suggestions, never diagnosis or treatment.

## The four dimensions — Earth, Sky, Water, Body

*Amended 2026-07-04.* The organizing question underneath every session: **what dimension are you training?**

- **Earth** — traversing ground. Hiking, trail/road running, MTB, cycling, climbing.
- **Sky** — traversing air. Paragliding, wingfoiling, skydiving.
- **Water** — traversing water. Kayaking, surfing, swimming, SUP.
- **Body** — building/maintaining the instrument itself, independent of location or terrain. Gym, yoga, PT, breathwork, mobility, calisthenics.

The generative rule: Earth/Sky/Water are the domain you move *through*; Body is anything where the point is the instrument, not the terrain. Body is not "ground-based" by default just because it usually happens indoors — it's a fourth, non-geographic dimension, not a subset of Earth.

This is also the product's positioning wedge, not just a data lens: Strava and single-sport apps are built to serve one sport at a time and structurally can't follow a user across paragliding, whitewater, skiing, and the gym in one coherent view — a shape only a life-mirror product occupies (see `four-dimensions-framework.md` for the full research this came out of).

**A mirror, not a mechanic.** A session is *tagged* with a dimension, and Reflect can show the honest mix — "you trained Water three times this week" is a true sentence about what happened. That's descriptive, and it's as far as this goes. None of the following may ever exist, here or anywhere downstream of this framing:

- Mastery levels or percentage-complete per dimension.
- Unlockable content gated behind mastery of a dimension.
- Any language that defines what "success" in a dimension looks like.

This is the same two reject-tests from § The line you do not cross, applied to a new surface — "does this reward the user with anything that doesn't already exist in the world" and "does this define what success means for the user." A mastery/unlock system fails both; a descriptive dimension mix fails neither.

**Archetype per dimension is a voice choice, not a data restriction.** The data bucket for each dimension stays fully inclusive (a road run is Earth, same as a trail run). Brand voice and onboarding language can anchor to one vivid, archetypal sport per dimension (trail running/MTB for Earth, paragliding/wingfoiling for Sky, kayaking/surfing for Water, the gym/practice room for Body) without fragmenting the underlying data — no "road running doesn't count" logic anywhere.

**Body is infrastructure, not geography.** It never competes with Earth/Sky/Water for map space and is never gated behind mastery of the other three — it supports them (a stronger body is what lets you go further into all three) rather than sitting alongside them as a fourth place you travel to. This isn't just descriptive convenience: it's a direct application of the privacy line already drawn for GPS data (`gps-mapping-spec.md` § Privacy — the hardest line in the app) — Body sessions mostly happen at a small number of fixed indoor locations, so treating Body like the other three on a shared map would leak exactly the kind of location data the privacy rules exist to prevent.

Full framework: `four-dimensions-framework.md`. The Ring-4 world-map/cohort application extends `gps-mapping-spec.md`'s existing cohort-map section — not built or scoped by this document.

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

    benchmark.ts     User-defined benchmarks; the data-dimension anchor for Reflect.

    notImplemented.ts  Helper for stubbed-but-typed engine functions.

    index.ts         Barrel exports.

*(Founding modules, listed for the shape of the idea — the engine has since grown: gear, spots, conditions, routes, swim, climbing grades, session templates, and more. `core/src/` is the live index.)*

Data flow: things happen \-\> become Observations \-\> timeline orders them \-\> engines turn them into facts (trend \-\> expenditure; stimulus) \-\> only those facts, with confidence attached, are ever shown.

A workout saved from the library is a draft Session — no timestamp, browsable by stimulus intent. It becomes a real Session when the user actually does it and logs the outcome. The system never pushes "recommended for you" content from the library.

Two entry states, not two products: users with an existing plan who want it connected, and users without a plan who get a provisional scaffold that graduates them into the first state as data accumulates.

## Conventions

- TypeScript, ESM. Relative imports are **extensionless** (`from './observation'`, not `'./observation.js'`). The build uses `moduleResolution: "bundler"` (Expo/Metro + jest-expo), which resolves without file extensions; every `core/` file follows this. Don't add `.js` suffixes — they're for a Node/tsx ESM resolver this project doesn't use.  
- Heuristics are tunable and must be documented honestly with their error band. KCAL\_PER\_KG \= 7700 and the EWMA half-life are guesses, labeled as such.  
- Any user-facing string the engines produce must be descriptive, not imperative. See `stimulus.ts` `reveal()` for the tone: observations, not orders.  
- Confidence is a first-class output. "We don't know yet" is a valid, honest answer — never paper over it with a fabricated number.

## Build order (rings, inside-out)

1. **Correlation engine \+ stimulus** — the core. Stimulus is done; the correlation step (relating stimulus to outcomes on the shared timeline) is the next piece and stays in this stack-agnostic core.  
2. **Food via API** — integrate a nutrition database via API; do not build one from scratch.  
3. **Sleep \+ steps via HealthKit / Health Connect** — ingestion adapters that emit Observations. Trust step count and sleep hours; treat staged sleep scores as tier-3.  
4. **AI coach, then social layer** — later rings. The coach obeys rule 3 absolutely. Social follows the amended rule-5/rule-6 boundary: a full opt-in public layer (sharing, kudos with counts, member-made groups and segments) walled off from the mirror — see `planning/rework/research/social-expansion-plan.md` for the S0–S9 ladder. *(The original "showing up, never outcomes" framing was deliberately overridden 2026-07-11.)*

**Forward reference — Ring 4 shapes Rings 1–3:** Cross-user accountability is likely the primary retention driver, and session/observation data must be designed with sharing/privacy scoping in mind — visibility toggling should be a permission change, not a schema migration. *Updated 2026-07-11:* the social layer is no longer "ships last" — it's an active build ladder (S0–S9) with its own backend spec. Current source of truth: `planning/rework/research/social-expansion-plan.md` (plan + amended-rule rationale), `supabase-backend-spec.md` (backend), `activity-groups-spec.md` (groups/segments). `cohorts-spec.md` and `product-overview.md` § Social layer are the pre-override documents — historical context only.

## Planning docs

See `planning/` for the full product context:

- `product-overview.md` — north star, features, traps, taglines  
- `data-model.md` — the Observation schema (the data contract)  
- `correlation-engine-spec.md` — expenditure, plateau forensics, thresholds  
- `training-logging-spec.md` — session logging architecture (gym, climbing, GPS, swim, practice)  
- `four-dimensions-framework.md` — Earth/Sky/Water/Body, the organizing lens behind § The four dimensions  
- `benchmarks-spec.md` — user-defined benchmarks; the Reflect layout key  
- `rework/master-plan.md` — **the current product shape**: 5-tab shell (Home/Training/Map/Nutrition/Social), Profile + Settings, phased build order — read this before trusting any older nav/layout claim  
- `rework/research/social-expansion-plan.md` — the social layer as actually decided (S0–S9; supersedes `cohorts-spec.md`)  
- `cohorts-spec.md` — pre-override Ring 4 social sketch (superseded, historical)  
- `ai-consultant-prompt.md` — Ring 3 / Phase 7 AI consultant  
- `competitive-landscape.md` — Cora, trainhybrid, Edge, etc.  
- `brand-kit.md` — design tokens and visual direction  
- `phase-1-build-spec.md` — what was built first (the minimum useful loop)  
- `game-plan-and-prompts.md` — build sequence + ring↔phase↔pass legend  
- `backlog.md` — deferred items, open constraints, known quirks

