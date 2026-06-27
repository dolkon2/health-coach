# Correlation Engine — Spec Notes (v0.1)

*Companion to the product overview. This is the first layer where the philosophy stops being a stance and becomes a mechanic.*

---

## Where this sits in the build plans

The product overview is the **what** and the **why**. These notes are the **how** for the first real feature — the correlation engine and the AI that reads it. The material splits into three homes:

- **Principle refinement** (AI as engine, not face) → updates the philosophy section of the overview.  
- **Feature spec** (expenditure, plateau forensics, detection threshold) → *new*. This is the spec layer beneath the overview, sitting alongside `data-model.md` (the Observation schema, now written).  
- **Competitive update (Cora)** → updates the existing competitive analysis.

The data model is now spec'd in `data-model.md` — the single Observation record (tier + fidelity + source) that everything below assumes. Companion specs that have since landed: `training-logging-spec.md` (session logging surfaces), `benchmarks-spec.md` (the Reflect layout key), `cohorts-spec.md` (Ring 4 social layer).

---

## Core principle (refined): AI is the engine, not the face

- A chat box that keeps prompting you is a **confession** — the product leaning on conversation because its core loop isn't strong enough to stand alone.  
- AI's job here is **connective tissue**: turn a photo into a confident estimate, make a climbing session count as pull volume, notice a stall lines up with sleep. Invisible work. No personality on the surface.  
- The user never sees "AI." They see their own stats and what changed, and they make the call. The intelligence leaves no fingerprints.  
- This is the market inversion: everyone else races to put AI *on top* (easier to market, easier to raise on). The plumbing is where it belongs — it keeps the surface calm, factual, and yours.

---

## Feature 1: Expenditure / TDEE from outcome

**The mechanic — get this exactly right:**

- Don't track "calories out." Track calories **in** \+ **weight trend**, and infer total expenditure as the **residual** — the number that explains the gap between intake and what bodyweight actually did. (MacroFactor's method.)  
- "Out" is never measured; it's solved for. That's what makes it honest and a wearable's active-calorie guess dishonest: the watch *predicts* from motion, we *back it out* from outcome.  
- Framing is **"in vs what my weight did → infer out,"** never "in vs out." Don't accidentally rebuild the wearable you're trying to replace.

**The steps → expenditure question (the first real use case):**

- Inferred expenditure is a single aggregate (BMR \+ lifting \+ steps \+ NEAT, fused). Steps don't break out for free — you correlate the total against step count over time.  
- Signal is small, noise is large: \~3k extra steps ≈ 100–150 kcal/day; a single week's weight trend wobbles more than that (water/glycogen alone swing \~1 kg). One 7k week vs one 10k week \= reading static and calling it signal.  
- Honest version: bucket **many** weeks — all your \~7k weeks vs all your \~10k weeks, averaged, with the spread shown. The answer emerges from repetition, not a single comparison.  
- Stay **silent** on the link until the data clears the noise floor. A one-week "you burn 150 more on 10k weeks\!" card is the Cora move — false precision dressed as insight.

**Forecasting TDEE — allowed, with the arrow pointed the right way:**

- Predicting expenditure from activity *before* the outcome (the watch, Cora) \= invention.  
- Extrapolating from your own measured history, revised the instant reality disagrees \= the mirror tilted slightly forward. Fine.  
- The forecast owes **everything to outcome, nothing to a population formula.**  
- Note: steps are mostly NEAT — the single biggest *hidden* variable in expenditure and the thing every wearable butchers. Isolating it from your own outcome data beats any "active calories" number you'll ever be handed.

---

## Feature 2: Plateau forensics (the summoned AI)

**The unique move — fidelity as a candidate cause:**

- When weight stalls, every other app can only reach for biology (eat less, move more). Yours can surface that **nothing physical changed** — your logging just got blurrier (switched from food scale to photo estimates), so the "deficit" is an artifact of measurement, not reality.  
- No other app can say this, because no other app treats *how confidently you logged* as data. It falls straight out of the fidelity field. **Amplify this — possibly the sharpest single thing in the whole product.**

**The discipline — avoid the multiple-comparisons trap:**

- "Find what changed when I stalled" is a loaded gun. With a dozen drifting variables, an AI will *always* find something. Confidently naming one cause \= false precision in a smarter coat.  
- Instead: surface **suspects, ranked by how much each actually moved, uncertainty shown.** Hand over the lineup:  
    
  "Three things shifted in that window: your logging went 70% photo-estimate, your post-gym incline walks dropped, your sleep got ragged. Here's the size of each. Which rings true?"  
    
- It names the candidates. **You** name the cause. Keeps user competence load-bearing — you're the one who knows you dropped incline because your knee hurt.

**Two different AIs hide inside "notice going forward":**

- **Retrospective forensics** — you ask, it digs through history. All upside; speaks only when summoned. *Build this first.*  
- **Prospective monitoring** — flags unprompted. Edges back toward the nudge machine. Allowed ONLY on a brutal trigger: a currently-active pattern matches something *your own history already proved mattered for you.*  
  - Not "people who walk less tend to stall" (population \= Cora).  
  - Yes "last time your weight stalled, your steps had quietly dropped two weeks before you noticed — they're dropping again right now." Earned, personal, rare. Almost never fires, which is exactly why it's worth hearing when it does.

---

## Feature 3: Detection threshold (what counts as a meaningful change)

- The unit **can't be raw counts** (steps, minutes) or a single global threshold — each variable's natural noise differs wildly. A ±2k daily step swing means a 1k move is nothing; a steady 40-min sleep drop might be real.  
- Use **z-scores against personal baseline**: "how many standard deviations off your own normal is this?" A 2.5-sigma move in sleep and a 2.5-sigma move in steps are equally worth attention even at very different raw magnitudes. This is what lets suspects rank honestly instead of by biggest raw number.  
- The baseline is **learned per-user from their own history** — no population constant anywhere. The system must watch enough boring weeks to know what boring looks like *for you* before it can call anything abnormal.  
  - This is the **cold-start discipline reappearing as a statistical requirement.** The philosophy and the math are the same constraint. Good sign: honesty is falling out of the structure, not being bolted on top.  
- **The threshold must be visible and user-owned.** A hidden sensitivity dial tuned to maximize how often the app speaks *is* the engagement knob in disguise. If the user sets it, **silence becomes information**: when the app says nothing, you know nothing crossed the line *you* drew — not that it missed something. Silence has to be earned and legible, or it's just a black box that happens not to be talking.

---

## Competitive update: Cora

- **Shipped, real, moving fast.** YC W24, built by PurplePill AI (pivoted from "Purple," an AI leasing assistant). \~$9.99/mo, 4.8 on the App Store — but review signal is thin and curated, and much of what ranks for "Cora reviews" is Cora's own SEO blog.  
- **Sprinting into everything the spine rejects:** daily meal plans delivered each morning, smart alerts/nudges, "Cora Actions" (background recurring tasks), "Moments" (shareable PR/streak cards), streaks. AI on the surface, as a face.  
- **Nutrition is predicted/goal-based.** Their *own* blog concedes MacroFactor's weight-trend method is better and that estimated-TDEE calculators run 300–500 kcal off. By their published standard their nutrition engine is the weaker, predicted kind — and outcome-measured TDEE is the wedge they've effectively admitted they're soft on.  
- **The structural argument (the real moat):** Cora is VC-funded, so growth runs on engagement — DAU, time-in-app, retention curves for investors. Streaks, nudges, and Moments aren't product decisions, they're business-model decisions. A "use it and leave" product is the *enemy* of that model — they structurally can't build yours. The flashy coach also acquires beginners (\~50% quit within 6 months), the highest-churn segment. The honest mirror is a **retention play, not an acquisition play** — and in a subscription business, retention is the whole game.

---

## Standing risks (keep visible)

- **"Just works" is the highest bar, not the lowest.** The quiet tool has nowhere to hide — no notifications to paper over a weak core loop. The upload → reflect → decide loop has to carry full weight from a near-empty start.  
- **Don't let "not building for VC" become "no rigor, it's a hobby."** Intrinsic motivation is the fuel that gets a build through the unglamorous middle; the bar you set yourself ("open it, it works, leave") is brutal *precisely because* it's quiet. A quiet product that doesn't nail the loop reads as empty, not elegant.  
- **Don't let "anti-Cora" become the identity.** The win isn't being the opposite of Cora — it's being so quietly good that someone opens it, sees the truth, and gets on with their day.

