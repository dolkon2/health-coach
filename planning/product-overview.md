# Avatar Training — Product Overview

*An honest, connected training \+ nutrition app that tracks how you actually show up.*

---

## What it is

One home for the parts of training that currently live in four disconnected apps — gym, running, swimming, climbing, kayaking, biking, surfing, food, bodyweight, sleep, steps — placed on a single timeline so you can finally see how your inputs relate to your progress.

Built for yourself first: the hybrid athlete who lifts, runs, climbs, paddles, rides — and who wants the *truth* about their training rather than a plan handed down or a streak to protect.

The user treats the gym and nutrition as infrastructure for the things they actually love — climbing, surfing, trail running, whitewater, whatever their outdoor life is. They bench and squat because it makes them a better climber, a more durable surfer, a runner who doesn't get hurt. Nutrition is the same: science-based, serious about it, but in service of a life that happens mostly outside. The gym isn't their identity; it's the engine room. The product treats a surf session, a kayak lap, and a heavy push day with equal weight, because the user does.

This makes the product fundamentally **multi-sport**, but not in a "we have a kayaking module and a climbing module" sense. Every modality enters the same timeline as Observations — duration, distance, route, heart rate, RPE, stimulus contribution. The differentiation isn't a feature per sport; it's that the kayak race time, the climbing project send, the deadlift PR, and the weekly weight trend all live next to each other in one ledger. Most multi-sport ingestion is essentially free via HealthKit / Health Connect — kayaking, hiking, cycling, climbing are native Apple Watch workout types with GPS and HR attached. We do not build native sport tracking at MVP; we ingest what the platform already records.

The difference isn't the feature list — every competitor has the feature list. It's the posture:

**Descriptive, not prescriptive. Outcome-measured, not predicted. A mirror, not a game.**

---

## The spine (what every feature must obey)

1. **Outcome over prediction.** Like MacroFactor, expenditure is *measured* from the weight trend, never guessed from activity. What you do — sessions, effort, steps, sleep — flows in as *descriptive* context and surfaces as correlation. It explains; it never gets baked back into your targets as a standard to live up to.  
     
2. **Reveal, never invent.** The only rewards shown are ones that already exist in the world: the real trend moving, the run on a map, the work recorded. No streaks, badges, or points — those assume perfection and punish the middle, and "sitting in between" is where most of training actually lives.  
     
3. **Fidelity is a first-class fact.** A weighed meal and a snapped-photo estimate are the same field at different confidence. This is how one app serves the bodybuilder *and* the first-time tracker — and your own different moods — without forking into two products.  
     
4. **Intentional by mechanism, not by slogan.** It won't be enough to *say* intentional. The product has to make you feel it in the first session without anyone explaining. The moment intentionality has to be narrated, it's just marketing wearing the word.  
     
5. **No gamification.** No streaks, badges, scores, points, or shareable body-change content. These are incompatible with an honesty-first product. The pressure to add them will be strongest for beginner/onboarding flows — hold the line hardest exactly there.  
     
6. **Pull, not push.** The user reaches for things on their own initiative; the system never pushes content at them.  
     
7. **Goals are yours, not ours.** The app never reduces success to "lose weight" or "build muscle." The user sets their own benchmarks — climb 5.12, finish a 50k, run the river section faster, stay consistent through a stressful quarter. The correlation engine works regardless of what the goal is, because it relates inputs to each other, not to a predicted target. Goals are *written by the user in their own words*, not picked from a category list — because a category list is the app deciding what success means. Over months and years, the archive makes success stories and failure patterns legible — but the user writes the narrative.  
     
8. **The felt sense outranks the model.** Wearable composite scores (strain, recovery, readiness) are tier-3 modeled values. They sit *below* what you actually did (tier-1 facts) and what your weight trend shows (tier-2 accumulated). A "recovery score" never gates or overrides a logged session.

---

## AI philosophy: engine, not face

- AI's job is **connective tissue**: turn a photo into a confident estimate, make a climbing session count as pull volume, notice a stall lines up with sleep. Invisible work. No personality on the surface.  
- A chat box that keeps prompting you is a **confession** — the product leaning on conversation because its core loop isn't strong enough to stand alone.  
- The user never sees "AI." They see their own stats and what changed, and they make the call. The intelligence leaves no fingerprints. (The one deliberate exception is the *summoned* coach — a door the user opens, never a face that opens itself; see `benchmarks-spec.md`, "Summoned coach.")  
- Most products assume the user doesn't know what to do and sell **coaching**. This one assumes competence and sells **infrastructure** — the system that removes friction from doing the work and seeing it. Competence is the safe default: when a user's self-model is off, the mirror corrects it gently instead of the product talking down to them.  
- When the AI *does* speak (plateau forensics, pattern detection), it speaks only when the user's own data clears the noise floor. An AI that talks because it's been quiet too long is a notification. An AI that talks because the data finally said something is a coach.

---

## The product should feel like

- Open it, upload, reflect, make decisions, leave. Minimal time-in-app, high-value reflection.  
- So good you open it every day and don't spend much time on it.  
- "Just works" — the highest bar in software, not the lowest. No theater to hide behind.  
- Quiet products that don't nail the loop read as empty, not elegant. The loop has to carry full weight from a near-empty state.  
- **Solo carries the weight; social earns its place on top.** Strava's structural lesson: the solo product — your run, your pace, your map against your own history — has to justify opening the app *alone*. Social then sits on something already worth using. Our solo artifact is richer than Strava's (the whole stack on one timeline, not a single activity), but the discipline is the same: ring 1 has to stand even if ring 4 never exists.

---

## Core features

### The correlation engine (ring 1 — the reason to exist)

Everything on one timeline: gym sessions, runs, climbs, kayak laps, surf sessions, food logs, bodyweight, sleep, steps. The engine doesn't prescribe — it *relates* these to each other so you can see what's actually happening.

- **Outcome-measured TDEE:** Calories in \+ weight trend → infer total expenditure as the residual. "Out" is never measured; it's solved for. The watch *guesses* active calories from motion; we *back them out* from outcome.  
- **Stimulus-based programming:** Organize around movement patterns (upper push, upper pull, hip hinge, quad dominant, etc.) and energy systems (aerobic, glycolytic, ATP-CP) rather than app categories. A climbing session counts as upper-pull volume. A HIIT row covers glycolytic. A kayak lap is aerobic \+ upper pull. Substitution stops being a hack and becomes a feature.  
- **Plateau forensics (summoned AI):** After months of data, the user can ask: what changed when my weight stalled? The AI surfaces suspects ranked by how much each moved, uncertainty shown. Unique move: fidelity as a candidate cause — "your logging went 70% photo-estimate" means the deficit might be a measurement artifact, not a real stall.  
- **Detection threshold (z-scores against personal baseline):** Each variable measured in its own noise units, baseline learned per-user. Threshold is visible and user-owned. Silence becomes information.  
- **Gear & environmental context (schema consideration):** The observation schema should accommodate contextual metadata — gear/equipment (which shoes, which boat, which harness) and environmental conditions (weather, water levels, trail conditions). These aren't first-class features; they're optional fields that compound into a personal archive over time. Validated by Strava's gear tracking: simple metadata that becomes invaluable across hundreds of sessions (shoe mileage, board quiver usage, gear-correlated performance).

### Nutrition (ring 2 — via API, not from scratch)

- Wire in a food database API (Nutritionix / USDA / Open Food Facts) plus photo estimation. Own the *adaptation logic*, not the database.  
- Every food log carries its fidelity: weighed \= high confidence, photo \= lower, quick text entry \= somewhere between. The fidelity field is what lets the AI tell you your plateau might be a *logging* problem, not a body problem.

### Sleep \+ steps \+ multi-sport ingestion (ring 2.5 — cheap, do it early)

- HealthKit / Health Connect ingestion. Trust step count and sleep *hours*; treat staged sleep scores as tier-3.  
- This is also where most multi-sport coverage comes from at MVP: native Apple Watch and Health Connect workout types (kayak, hike, climb, ride, surf, swim) flow in as Observations with their GPS, duration, and HR already attached. The differentiator is that they land on the same timeline as the food log and the heavy squat, not that we built a better kayak tracker.  
- Steps are mostly NEAT — the single biggest hidden variable in expenditure and the thing every wearable butchers. Isolating it from your own outcome data beats any "active calories" number.

### Workout library (pull-based)

- Browse and save workouts as draft Sessions (no timestamp, browsable by stimulus intent).  
- Strictly pull: the user reaches for templates on their own initiative. The system never pushes "recommended for you" content.  
- Two entry states, not two products: users with a plan who want it connected, and users without a plan who get a provisional scaffold that graduates them as data accumulates.

### AI coach (ring 3 — later)

- Assumes competence. Steps in when needed, doesn't lead.  
- **Retrospective forensics** (summoned): you ask, it digs through history. Build first.  
- **Prospective monitoring** (unsummoned): flags only when a currently-active pattern matches something *your own history proved mattered for you*. Earned, personal, rare.  
- The coach's assertiveness scales with demonstrated competence and the mode you're in. Never fills silence or talks because it's been quiet too long. It may propose a split or movement patterns *on request* (prescription-on-request), but the output is a draft scaffold the user saves and owns — never a plan it assigns and tracks adherence against (`benchmarks-spec.md`, "Summoned coach").

### Social layer (ring 4 — later)

> **Superseded 2026-07-11.** Dylan deliberately overrode the no-outcomes/no-counts framing below: the social layer is now a full opt-in public system (public accounts, kudos with counts, member-made groups and segments), recorded in amended constitution rules 5+6. Current source of truth: `rework/research/social-expansion-plan.md`. What survives from this section unchanged: no app-generated nudges, no shareable body-change content, the mirror itself stays countless.

The shareable unit is the act of showing up, not outcomes or body transformation. But the real wedge of the social layer is **cross-user accountability**: a friend texting "you hitting the gym today?" is a kind of motivation an AI coach structurally can't generate. Routing accountability through actual human relationships is the only philosophy-consistent way to get the accountability function at all — and it's a function the engagement-driven competitors can only fake with notifications.

Two rails to keep this clean:

- **The app never generates the nudge for the friend.** No "we noticed Dylan missed a session, want to text him?" pattern. That's an engagement notification laundered through a human. Friends notice on their own by looking — the app is the shared artifact they can both see, not the broker pushing them at each other.  
- **Cohort hubs stay pull.** Everyone training for the same race, climbing the same project, paddling the same river section can opt into a hub where they see each other's training and outcomes. The hub is something you go look at; the hub doesn't push at you. Same silence-is-information rule as the AI coach. A race-section hub on the Little White is exactly the structure that wraps the kayaker, the runner, and the lifter in the same product — because what shows up in the hub isn't sport-specific, it's "what people are doing to get there."

No shareable body-change content. No "Moments" celebrating streaks or perfect habit days. The unit that's worth sharing is showing up and what you did, full stop.

**Architecturally foundational, not a late-stage addition.** Cross-user accountability is likely the primary driver of daily opens and long-term retention. It ships last, but it shapes what comes before: session and observation data models in Rings 1–3 must be privacy-aware and sharing-ready from the start so that toggling visibility is a permission change, not a migration. Full spec: `cohorts-spec.md` (events, challenges, profile, friend mechanic).

A later, still-unscoped extension of the cohort hub: a world map of friends' activity, filterable by the four dimensions (`four-dimensions-framework.md`) and governed by the same privacy rules as any other route (`gps-mapping-spec.md` § Privacy). Not built or specced in detail yet — noted here so it isn't discovered as a surprise.

---

## Build order

1. **Correlation engine \+ stimulus-based programming** — your IP, the reason to exist. (Core TypeScript modules built and proven: observation schema, timeline, trend engine, expenditure engine, stimulus ledger.)  
2. **Food via API** — integrate a nutrition database; do not build one from scratch.  
3. **Sleep \+ steps \+ multi-sport ingestion via HealthKit / Health Connect** — adapters that emit Observations across modalities.  
4. **AI coach** — *summoned, never self-initiating* (pull, not push). Obeys all rules absolutely. May prescribe **on request**, grounded in the user's own data, with output owned by the user (`benchmarks-spec.md`, "Summoned coach"). Once summoned, speaks only when the data earns it.  
5. **Social layer** — opt-in public sharing, kudos, groups and member-set segments per amended constitution rules 5+6 (`rework/research/social-expansion-plan.md`); never app-generated nudges, never scores on the mirror.

---

## Stack

Expo \+ React Native \+ TypeScript (accepted). iOS-vs-cross-platform decision deferred until the HealthKit / Health Connect integration layer.

Core engine is platform-agnostic TypeScript — deliberate, so the engine is never thrown away regardless of what ships on top.

---

## Taglines (working)

- *Track how you actually show up.*  
- *A mirror, not a game.*  
- *It never assumes you were perfect.*

---

## Traps to avoid

- **Cold-start emptiness.** Value compounds with the user's own history; week one the mirror is near-empty — exactly when people bounce and competitors hook them with a flashy generated plan. Engineer the day-one reward (the dignity of the logged act) relentlessly.  
- **AI that leads.** Making the coach chatty to drive engagement turns it into a notification. Trigger discipline *is* the personality.  
- **Forking for beginners.** A "simple mode" that's secretly a second app. The fidelity field is how you flex instead of fork.  
- **Forking for goals.** A goal-picker that branches the app into "cut mode," "race prep mode," "climber mode." Same trap, different axis. Goals are written by the user in their own words and pinned; the IA is stable and the user shapes their own foreground.  
- **Marketing invisibility.** The differentiator is a feel, not a screenshot. From outside you look like the others until someone feels the difference — so the one-line reason-to-switch has to be razor sharp.  
- **"Not for VC" becoming "no rigor."** Intrinsic motivation is the fuel; the bar ("open it, it works, leave") is brutal precisely because it's quiet. A quiet product that doesn't nail the loop reads as empty, not elegant.  
- **"Anti-Cora" as identity.** The win isn't being the opposite of Cora — it's being so quietly good that someone opens it, sees the truth, and gets on with their day.  
- **The multiple-comparisons trap.** When AI hunts for what changed, it will always find *something*. Surface suspects ranked with uncertainty; let the user name the cause. The AI never delivers a verdict the data can't support.  
- **Hidden engagement knobs.** A sensitivity dial tuned to maximize how often the app speaks *is* the engagement knob in disguise. Keep thresholds visible and user-owned.  
- **Social as engagement theater.** The moment the app generates the nudge — even routed through a friend — it's the notification machine wearing a person's name. Human accountability must originate from humans. The app makes the artifact visible; it doesn't broker the prompt.

---

## The foundation

You want this for yourself, and if no one else does, oh well. That isn't a fallback — it's the strongest possible starting point. You're the user, so you can't be wrong about what the user wants. You'll dogfood it daily, which is how honest products stay honest. And the motivation is intrinsic, which is what carries a build through the long, unglamorous middle.

Build the thing you want to wake up and open. The rest is downstream of that.  
