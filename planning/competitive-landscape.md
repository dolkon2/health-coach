# Competitive Landscape (v0.3)

*Planning doc. Pulls the Cora / trainhybrid / Edge / Nick Bare / STNDRD / Strava intel into one place. Companion to `product-overview.md` and `correlation-engine-spec.md`. v0.3 merges the two prior drafts that had drifted apart: the **two-axis framing** (Cora = tracking/intelligence axis, Strava = retention axis) and the **Strava structural-anchor lessons** (solo-first, what-not-to-borrow, the network-effects disanalogy). Nothing from either draft was dropped.*

---

## The one-line read

Every competitor worth naming is **prescriptive and prediction-led.** They assume the user doesn't know what to do and sell a plan. The descriptive, outcome-measured, mirror-not-coach lane is still empty — which is the whole bet. But the lane is empty on *two* axes, not one: no one combines real tracking depth (outcome-measured expenditure, fidelity, correlation) with the social gravity that drives daily opens. Cora is the primary overlap on the **tracking/intelligence axis** — same four pillars, same vocabulary, wrong posture. Strava is the primary overlap on the **retention axis** — the reason someone opens an app every day is to see that their friends trained, not to read a readiness score. The combination of Strava's daily-open social pull and genuine descriptive tracking depth doesn't exist anywhere. The catch: from the outside the feature surfaces now look nearly identical (training \+ recovery \+ nutrition \+ wearables, all in one app), so the position can only be *felt*, not screenshotted. That's the standing problem this doc exists to keep in view.

The market has converged on one shape — "AI coach that tells you what to do, grounded in wearable data." Cora, trainhybrid, and Edge are three executions of that same shape. Nick Bare and STNDRD are the older content-and-program model the AI ones are eating. None of them measure outcomes and back the numbers out; all of them predict forward from activity and a population model, then hand you a plan.

---

## Positioning

The axis that matters isn't feature count — it's **predicted vs. measured** and **prescriptive vs. descriptive.** Plotted that way:

| Product | Plan source | "Out" / expenditure | Surface AI | Gamification | Business model |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Cora** | AI-generated, adapts daily | Predicted from wearable strain | Chat coach, proactive nudges | Streaks, Moments, habits, journals | VC (YC W24), engagement-driven |
| **trainhybrid.app** | AI-generated periodization | Predicted; macros adapt to volume | Chat coach ("grounded in research") | Lighter, but plan-adherence framed | Startup, subscription |
| **Edge** | Built-for-you plan, 24/7 human coach chat | Predicted from plan/load | Real coaches in-app | Plan adherence, race prep | Subscription, coaching-heavy |
| **Nick Bare** | Preset programs (Hybrid Athlete 1/2/3) | Not measured; manual logging | None — it's a content library | Reminders, challenges | Creator content (Playbook), \~$15/mo |
| **STNDRD (cbum)** | Preset splits (PPL, Arnold, Olympia prep) | Not measured; manual logging | None — explicitly "NOT AI" | Discipline/transformation framing | Creator content, \~$15/mo |
| **Strava** | None — user brings their own | GPS-measured (outdoor); manual/basic (gym) | None | Social feed, clubs, segments, user-created challenges | Freemium (\~$11.99/mo premium), network-effect-driven |
| **\[this product\]** | **None — you bring/keep the plan** | **Measured: back out of weight trend** | **None on surface; engine only** | **None, by constitution** | **Self-built; retention, not acquisition** |

The whole right column is where the prescriptive cluster lives. Strava sits apart — it doesn't prescribe, doesn't predict expenditure, doesn't run an AI coach — but it gamifies hard (kudos, segments, leaderboards) and lives off feed engagement. The bottom row is the inverse of every cell above it.

---

## Cora — the loud twin (primary overlap on the tracking/intelligence axis)

**What it is.** AI fitness coach by PurplePill AI (YC W24, pivoted from "Purple," an AI leasing assistant). \~$9.99/mo, App Store rating in the high 4s — but review signal is thin and curated, and much of what ranks for "Cora reviews" is Cora's own SEO blog (their `/blog/best-fitness-app-reddit`, `/compare`, etc. — they're farming comparison and Reddit-intent keywords).

**Feature surface (it has sprawled since the last spec note).** Daily *Body Charge* readiness score from HRV/RHR/sleep; *Strain* tracking; AI-generated weekly training plans that adapt to recovery; cardio minute targets; strength levels with a radar that **compares you to your age/sex demographic** (population baseline, exactly the thing the constitution forbids); muscle-volume \+ per-muscle recovery; nutrition with goal-based calorie/macro targets; photo food logging; import workouts/recipes from social; and a Habits tab with **routines, journals, proactive coaching, smart notifications, and "Cora Actions"** (background recurring tasks). Syncs Apple Watch, Whoop, Garmin, Fitbit, Oura.

**Where it overlaps with us.** Same four-pillar surface (training, recovery, nutrition, wearables), same volume/recovery-per-muscle vocabulary, same photo logging, same "one app instead of five" pitch. From a feature grid we look like the same product.

**Where the daylight is — and it's wide.**

- **Predicted vs. measured.** Cora's nutrition is goal-based: set a target, get macros. Their *own* blog concedes the weight-trend (MacroFactor) method is more accurate and that estimated-TDEE calculators run hundreds of kcal off. By their published standard, their nutrition engine is the weaker, predicted kind — they've effectively admitted the outcome-measured TDEE wedge is where they're soft.  
- **AI on the surface vs. in the plumbing.** Cora is racing the opposite direction: proactive coaching, a redesigned chat, smart alerts, Cora Actions. Every one of those is a "the app talks because it's been quiet too long" trigger — a notification machine by design.  
- **Gamification they ship and we reject.** Moments (shareable PR/streak cards), streaks, demographic strength comparison, habit stacks. All of it assumes perfection and rewards the user with things that don't exist in the world.  
- **Population baseline vs. personal baseline.** The strength radar compares you to your demographic. The constitution's z-score-against-your-own-history rule is the direct inversion.

---

## trainhybrid.app — the AI-native generalist

**What it is.** "The first AI-native platform that programs strength, endurance & nutrition as one system." Heavy on integrations (Garmin, Strava, Wahoo, TrainingPeaks, Zwift, Whoop, Oura, Apple Health, MyFitnessPal, Cronometer) and the program-on-desktop / execute-on-phone workflow. Pulls activity in, **pushes structured workouts out** to your Garmin/Wahoo. 500+ exercise demos. AI chat that talks periodization and concurrent-training interference, explicitly "grounded in peer-reviewed research — not vibes."

**Where it overlaps.** Genuine hybrid framing (HYROX / marathon / triathlon / powerlifting / hypertrophy as one system), which is closest to the stimulus-based-programming intuition — they also think across modalities rather than in app categories.

**Where the daylight is.**

- It's **push, not pull**, at the mechanism level: the headline feature is shoving structured workouts onto your watch.  
- Nutrition is **AI-generated and periodized to planned volume** — predicted forward from the plan, the watch-logic this product is built to replace.  
- The differentiation between us and them is the cleanest of the four on the *philosophy* axis even though the *surface* (one-system hybrid) is the most similar. Caution from the last review still holds: trainhybrid being early/unshipped-feeling is **not a moat.** Don't lean on their incompleteness; lean on the posture inversion.

Naming note: "hybrid training" is a crowded keyword. trainhybrid.app (AI-native platform) is the relevant one. Distinct from HYBRD (hybrd.com / hybrd.app, personalized-plan app with a "Brain" that auto-adjusts and friend competition), Hybrid Performance Method (HYBRID Strength Coach, periodized strength programs), and hybridtraining.de (Coach Stef, a German bodybuilding-calisthenics content app). Worth knowing they exist so the name space doesn't surprise us, but only trainhybrid.app is a direct philosophical competitor.

## Edge (findyouredge.app) — the human-coached one

**What it is.** Built ground-up for hybrid athletes (HYROX, runner-who-lifts, marathon \+ strength). Sells **true concurrent programming** as the wedge: schedules your heavy leg day away from your long run, manages total stress across both modalities. Onboarding asks goals/schedule/history/equipment and **builds a personalized plan within 24 hours.** Differentiator they push hardest: **24/7 chat with real human coaches**, explicitly "no chatbots." Apple-Watch-first execution. Pricing: free trial then \~£69.99/6 months.

**Where it overlaps.** The concurrent / interference-aware thinking overlaps with stimulus-based programming — they understand a hard session bleeds into the next one. They also run the same SEO-roundup playbook as Cora (their `/news/best-hybrid-training-apps-2026` ranks themselves \#1).

**Where the daylight is.**

- It is **maximally prescriptive**: a coach (human \+ algorithm) hands you the week and you execute it. The opposite of "you bring the plan, the mirror reveals what it did."  
- Expenditure/nutrition is plan-driven, not outcome-backed.  
- Their moat (human coaches) is also their cost structure and their ceiling — it's the coaching business, not the infrastructure business. Different customer: someone who *wants* to be told. Our user is the one who finds that condescending.

---

## Nick Bare — the incumbent content model

**What it is.** Creator-led program library on the Playbook platform: Hybrid Athlete 1.0 / 2.0 / 3.0, preset weekly templates (AM run / PM lift splits), an 8-lesson nutrition course, mobility days, workout reminders. \~$14.99/mo or \~$99.99/yr. Strong brand (BPN, "Go One More"), big audience, real community pull.

**Where it overlaps.** The hybrid-athlete *identity* and the lift+run audience are exactly our user. The push/pull patterns in his splits (push day, pull day, threshold run) are the same vocabulary stimulus-based programming formalizes.

**Where the daylight is.**

- It's **a PDF with a video player.** Static preset programs, manual logging, no correlation, no measured expenditure, no fidelity, no per-user baseline. The plan is the same for everyone who picks 2.0.  
- It's the *old* model the AI apps (Cora, Edge, trainhybrid) are actively eating — useful as evidence of where the audience already is, not as a live threat on the axes that matter.  
- Real lesson from Bare: the **identity and community** around showing up is powerful. That's the one thing worth borrowing — it maps to the social-layer-as-showing-up idea (ring 4), not to anything in the engine.

---

## STNDRD (cbum) — the bodybuilding incumbent \+ an instructive trap

**What it is.** Chris Bumstead's app, formerly *CBUM Fitness*, rebranded to **STNDRD** (Set The Standard LLC). 150,000+ members, \~$15/mo, Apple-featured. Creator-led program library — same bucket as Nick Bare but aimed at aesthetics/hypertrophy instead of hybrid endurance. Preset splits: PPL, Bro Split, Arnold, Powerbuilding, and Chris's own "Olympia Off Season" / 4-weeks-to-open prep. 200+ exercise demo videos. Basic set/rep/weight logging. Nutrition is a meal-plan \+ macro-calculator, no food-DB integration (reviewers actively ask for a MyFitnessPal tie-in — a gap our ring-2 API plan fills natively). Notably buggy post-rebrand: reviews report crashes, lost-workout data, and timers that don't run in background.

**Where it overlaps.** Almost nowhere on mechanism — it's a "train like Chris" content product, no correlation, no measured expenditure, no fidelity, no baseline. The overlap is purely **audience**: serious lifters who already know what they're doing and want structure, which is partly our user.

**The instructive trap — why this one is worth a flag.** STNDRD's own marketing leads with *"This is NOT AI-generated workouts. Real programs. Real coaches."* On the surface that sounds adjacent to our anti-AI-slop instinct — and it's a useful data point that "AI-generated plan" has become a **negative** signal in this segment, fatigue we can ride. But it means the **opposite** of our position. Their answer to AI slop is *a human champion's fixed plan handed down* — maximally prescriptive, the same program for all 150k members. Our answer is *no prescription at all; AI in the plumbing, you keep the wheel.* Don't let the shared "not AI" surface language blur that: STNDRD is anti-AI-on-the-surface **and** anti-descriptive. We're anti-AI-on-the-surface but the AI is doing all the invisible work. Same three words, inverse product.

- **Useful borrow:** the "discipline / set your standard" identity converts a static plan into a reason to keep showing up — same community lesson as Bare, same mapping to ring 4, same firewall against importing any of their gamified transformation framing.

---

## Strava — the social-gravity incumbent (primary overlap on the retention axis)

**What it is.** GPS-first activity platform, 120M+ athletes, freemium with a \~$11.99/mo premium tier. Best-in-class outdoor tracking: running, cycling, swimming, paddling, hiking, skiing — anything with a GPS trace. Social feed of friends' activities, clubs, segments (leaderboard-on-a-stretch-of-road), user-created challenges, and route discovery. Gear tracking (shoes, bikes, boats) with mileage/session counters. The app that serious outdoor athletes already open every day.

**Why it matters more than the feature grid suggests.** Strava is the closest competitor on the axis that actually drives daily opens — not tracking intelligence, but **cross-user accountability.** The social feed (ambient awareness that your friends trained this morning) is the primary reason users open it, not the feature set. No readiness score or AI nudge competes with seeing that your training partner already logged 6 miles before you got out of bed. That's the retention mechanism every AI coach is trying to manufacture with streaks and notifications, and Strava has it organically.

**Where it overlaps with us.**

- **The outdoor-first user is identical to ours.** The runner-who-lifts, the paddler who also does gym work, the hiker who cares about volume across modalities — Strava's core audience *is* the hybrid athlete, they just don't call it that.
- **Strava's social layer validates the Ring 4 design.** Clubs, segments, and user-created challenges work precisely because the app never authors them — it only hosts infrastructure that users fill with their own stakes. No algorithmically generated "30-day challenge," no badges the app invented. That's the exact posture: platform, not author.
- **Gear tracking validates contextual metadata.** Running shoe mileage, which bike, which kayak — metadata attached to sessions that compounds into a personal archive over months and years. Same instinct as our session-level context fields (which boat, which trail, which gym), and evidence that users will maintain that metadata if the payoff is a long-term record.

**Where the daylight is — and it's structural.**

- **Strava is a GPS company that added a social layer.** Its core data model is the GPS trace. Everything downstream — segments, pace charts, elevation profiles, estimated power — flows from the trace. A gym session has no trace. This means the gym is **structurally second-class**: manual entry, no stimulus organization, no volume tracking worth the name, no correlation between what you lifted and what happened to your run the next day. Strava can't treat a barbell session and a paddle session with equal weight because only one of them produces the data type the entire platform is built on.
- **No nutrition.** Not thin nutrition — zero. No food logging, no expenditure, no TDEE, no caloric correlation. The whole energy-balance axis doesn't exist.
- **No fidelity, no outcome-measured expenditure, no correlation engine.** Strava tells you what you did (descriptive, which is good) but stops there. It never closes the loop: did that training week move the needle? What's the actual cost of that session in kcal backed out of a weight trend? It's a **record**, not an **engine.**
- **The timeline is segmented by sport, not unified.** Your running history and your cycling history are separate feeds with separate stats. There's no unified view of training stress across modalities — no way to see that your heavy squat day and your threshold run are drawing from the same recovery budget.

**Key insight.** Cora overlaps on what the app *knows* (the tracking/intelligence axis). Strava overlaps on why someone *opens it* (the retention/social axis). Neither combines both. A product that has Strava's daily-open gravity — because your friends are there and the record is real — *plus* the descriptive depth that Strava can't build because its data model is the GPS trace, occupies a position neither can reach from where they stand. Strava can't add a correlation engine without rebuilding its core around sessions that aren't GPS traces. Cora can't add organic social gravity without abandoning the AI-coach surface that drives its engagement metrics. The combination is the gap.

### Solo first, social on top — the structural lesson

Strava works because the solo product is genuinely great alone. Your run, your pace, your map, your splits against your own history — that justifies opening the app even if no friend ever sees it. Social then sits on top of something already worth using. This is the right sequence and the right load-bearing structure. The mistake to *not* make is concluding "Strava works because of the feed." Strava works because the solo artifact is honest and good, and the feed is a layer on top — and the feed is also where Strava's compromises live (kudos as engagement currency, segments breeding cheating, badges that punish the middle). Our solo artifact is richer than Strava's — the whole stack on one timeline, not a single activity — so the discipline is the same but the underlying object is more powerful. Quiet products that don't nail the loop read as empty, not elegant: the loop has to carry full weight from a near-empty state, and ring 1 has to stand even if ring 4 never exists.

### What we explicitly do not borrow from Strava

Kudos, segments, leaderboards, achievement badges, the algorithmic feed. All of it is the engagement-economy version of what we're trying to build — different surface from Cora's streaks but the same business-model obligation. Strava's feed exists because Strava needs DAU; ours doesn't. The accountability we want routes through real relationships *without* the kudos/leaderboard substitution (the two rails — the app never generates the nudge for the friend; cohort hubs stay pull — are in the product overview).

### Honest disanalogy

Strava's network effects (your friends are already there, your routes are already there) are a moat we don't have and won't get for years. Borrowing the *structure* of Strava's stack (great solo, social on top) doesn't mean borrowing their growth dynamics. The cohort hub is a slower, smaller, opt-in artifact — less viral, more durable.

---

## The structural argument (the real moat)

Feature parity is reachable by anyone; the durable separation is **business model**, because the model dictates what each competitor is *structurally allowed* to build.

- **VC-funded products grow on engagement.** Cora (and any venture-backed peer) runs on DAU, time-in-app, and retention curves shown to investors. Streaks, Moments, proactive nudges, Cora Actions, journals — these aren't product taste, they're **business-model obligations.** A "use it and leave" product is the *enemy* of that model. They structurally cannot build the quiet thing, because the quiet thing doesn't generate the metrics the next round is raised on.  
- **The flashy AI coach acquires beginners** — the segment that quits fastest (\~half gone within \~6 months). That's an acquisition strategy with a churn problem baked in. The honest mirror is a **retention play, not an acquisition play** — and in a subscription business retention is the whole game. We're aimed at the user who already knows what to do and will keep opening the thing for years because it tells the truth, not at the beginner who needs to be sold a transformation.  
- **Coaching and creator businesses (Edge, Bare, STNDRD) are capped by their cost structure or content cadence.** Human coaches don't scale to infrastructure margins; a creator's program library is only as fresh as the creator and is identical for every member. Neither is an engine that compounds with the user's own accumulated history. Ours gets *better the longer one person uses it* — the baseline sharpens, the correlations clear the noise floor — which is the opposite of a program that's identical on day 700\.  
- **Self-funded changes the objective function.** Not building for VC means the bar can be "open it, it works, leave," which no engagement-funded competitor can adopt without breaking their own economics. The structural point: this isn't a feature they've missed, it's a feature they're **forbidden** from shipping.  
- **Cross-user accountability is structurally unavailable to AI coaches.** A friend's text moves you in a way a notification cannot. Cora, Edge, and trainhybrid can simulate it (better nudges, smarter cadence), but the simulation has a ceiling that real relationships don't. Strava captures a sliver of this and dilutes it with kudos. The opening is to route accountability through real relationships without the kudos economy substituting for it.

---

## Standing risks (carry these forward)

- **Surface similarity is the real threat, not any single competitor.** Cora/Edge/trainhybrid have the same grid. The differentiator is a feel, not a screenshot, so the first-session experience has to *make* the descriptive stance felt without narrating it. This is the open problem from the last review and it's still open.  
- **"Competitors are unshipped/on-waitlist" is not a moat.** trainhybrid looking early, Cora's reviews being thin — these are temporary. Don't build strategy on a window that closes.  
- **Don't let "anti-Cora" become the identity.** The win isn't being Cora's opposite; it's being so quietly good someone opens it, sees the truth, and gets on with their day. The structural argument explains *why we can win*; it isn't the pitch.  
- **They'll copy the words, not the mechanism.** Anyone can put "outcome-measured" and "honest" on a landing page. The defense is that the mechanism (back expenditure out of the trend, fidelity as a candidate cause, z-score against personal baseline, no surface AI, accountability through real relationships not algorithms) is genuinely incompatible with their engagement economics — so they can borrow the language but not the build.

---

## Open follow-ups

- Pull concrete user-review daylight on Cora (real reviews vs. their SEO blog) to sharpen the "their nutrition is the weak, predicted kind" claim with quotes from actual users, not their marketing.  
- Decide the one-line reason-to-switch — the razor-sharp sentence that survives the surface-similarity problem. Candidate territory: *"Every other app guesses what you'll do. This one measures what you did."*
