# Benchmarks — Spec (v0.4) · the goal layer

*Companion to `product-overview.md`, `correlation-engine-spec.md`, `competitive-landscape.md`, and `phase-6-plan-tab-spec.md`. This is the spec for the goal layer: how a user sets what they're working toward, and how the app reflects progress without prescribing, gamifying, or inventing. **Supersedes v0.3** with one structural collapse (Jul 1 meeting insight): cadence and trend are not two categories of benchmark — they are two **faces** of every benchmark, a controllable behavior and a measured outcome (see "The two faces"). v0.3's other stances carry forward unchanged. Spine rules 5 (no gamification), 6 (pull, not push), and 7 (goals are yours) are the constitutional root; this spec is the mechanism, not a re-argument of them.*

*Decisions blessed 2026-06-29 (logged in vault `Decisions.md`): (1) a benchmark must resolve to something tracked before it is a benchmark; (2) a summoned coach may prescribe on request. Blessed 2026-07-01: (3) the behavior/outcome collapse below; behavior-only benchmarks are valid ("sometimes I don't care about certain goals, I just want to be consistent").*

---

## What a benchmark is

A **benchmark** is a user-set goal correlated to data the app can actually reflect — the answer to "what are you working toward?" It threads through three surfaces (Today, Training, Reflect) as a single object.

**The hard rule: a benchmark must resolve to a trackable dimension before it becomes a benchmark.** The app can only mirror what it can measure — sessions logged, gym split hit, getting stronger, weight moving, kilometers paddled. Freeform-described goals are welcome as an *entry path*, but the described text gets mapped to a measurable dimension (with the user confirming) before it lives as a benchmark. Truly unresolvable text is a **note**, not a benchmark. (As of v0.4 the gate applies **per face** — each face of a benchmark carries its own resolved dimension; a benchmark exists when at least one face resolves.)

This revises v0.2's "freeform text is sovereign even if it resolves to nothing" stance. Inert free text is dead weight in a mirror. The sovereignty that survives: the user names the goal and owns it; the app never narrows what they're *allowed* to want. It only refuses to pretend it can track what it can't see. The resolution step is the mirror being honest about its own reflective surface — not the app telling the user what to care about. (This lands near where v0.1 began — "unconnected text is a sticky note" — but softer: there is a confirm step, and unresolved text degrades to a note rather than being rejected outright.)

---

## The two faces of every benchmark

v0.3 treated *cadence* and *trend* as two families — two kinds of benchmark. The Jul 1 collapse: they were never two categories. They are **two faces of one object** — every real goal has a controllable side (what you do) and a measurable side (what happens), and a benchmark can carry either face or both.

- **Behavior** — the face you control. Training frequency, logging consistency, showing up. Every unit of it is a logged fact (evidence **tier 1**). Behavior is **sovereign**: fully inside the user's power, the thing they get to feel good about directly, this week, regardless of what the scale says. Its shape is a *rhythm*: a window (weekly/monthly) plus a measure — counting **events** (4 sessions) or summing a **magnitude** (100 km).
- **Outcome** — the face you watch. Weight moving, getting stronger, speed improving. It lives in accumulated and derived measurement (evidence **tier 2**) — trend lines, smoothed series. Outcome is **observed, never moralized**: the mirror reports which way it's moving; it does not grade the user for it. Its shape is a *movement*: a direction, optionally with a threshold ("bench 100 kg" is a direction plus a finish line, not a separate kind).

**Each face resolves to its own dimension.** That's what makes pairing across dimensions possible — the whole point: a sessionCount behavior + a bodyweight outcome is "train 4×/week and watch the weight come down." The outcome names success; the behavior is *your chosen path to it*. The app never draws that causal arrow for you — you set the path, it mirrors both faces.

**Valid combinations:**

- **Behavior-only** — "kayak 4×/week," no measured result attached. Fully valid: sometimes consistency *is* the goal ("I don't care about certain goals, I just want to be consistent"). The doing is sovereign.
- **Outcome-only** — "lose 5 kg," no behavioral commitment named. Also valid: you care where it goes, not how.
- **Both** — the richest case, and what most goals actually mean when someone says them out loud.

**The user still never picks a type.** No face enum, no category picker (that line from v0.2 holds, now per-face): filling in rhythm fields *is* setting a behavior face; filling in direction fields *is* setting an outcome face. The faces fall out of what the user writes down.

**Streaks are revealed, never invented** (unchanged, now anchored to the behavior face). A run of windows hit in a row is a true fact — show it as a stat (the dad-runs-10mi-a-week-for-five-years case). What the constitution forbids is the app *authoring a reward* around it: no flame icon, no "don't break it" guilt, no notification when a window is hit or missed. MacroFactor's day-grid is the precedent. The outcome face doesn't streak at all — it moves, and maybe crosses a line.

**Why this simplifies rather than complicates:** the two faces map straight onto the evidence-tier model the app already runs on (behavior ≈ tier-1 logged facts; outcome ≈ tier-2 accumulated), and the old families survive intact as the *shapes of the faces* — cadence math is the behavior face's shape, trend math is the outcome face's shape. Nothing about how each face reflects back changes; what changes is that they compose.

---

## Three entry layers

Modeled on the food-logging pattern (weigh / describe), extended with a third.

1. **Structured** — pick dimension, number, window directly. Resolves clean, needs no parser. (The "weigh it out" path: deterministic, no LLM.) This is the v1 baseline that ships first. The pick seeds the benchmark's *primary* face (an activity seeds a behavior; a measured dimension seeds an outcome); the other face is **pairable** right there — optional, never pushed.
2. **Described** — natural language in; a mapper proposes a candidate dimension and the structured version; the user confirms. (The "photo-estimate" path.) Example: "I wanna get better at kayaking" → app answers "I can mirror sessions/week, total km, or river grade — which one?" The user picks; that's the resolution step, not a recommendation. The resolver is a **deterministic keyword mapper first** (matches against the exercise library, stimulus patterns, activity labels, tracked dimensions), upgrading to a **Haiku-class parser** — the same upgrade path and shared NLP work as food logging. The text the user writes never changes; only how reliably it gets understood does.
3. **Coach-assisted** — the summoned coach helps shape a benchmark conversationally (see *Summoned coach*). Output is still a structured benchmark the user owns.

**Multiple concurrent benchmarks are allowed** — a bodyweight trend + a kayak cadence + a strength threshold can all be live at once. (Cap is an open question; see below.)

---

## Three surfaces, one object

A benchmark is set up once and appears in three places. Same record, three homes.

- **Training** — where benchmarks are created and managed (the planning surface; `phase-6-plan-tab-spec.md`). A behavior face is set and *felt this week* here.
- **Today** — pinned active benchmarks surface for at-a-glance status. The behavior face reads as a factual count ("kayak: 2/4 this week"); the outcome face reads as an observation ("trending down, 1.2 kg to go"). Same card, two registers: one you did, one you're watching.
- **Reflect** — benchmarks become the correlation hub's organizing key (below), *mirrored back over time*.

---

## The benchmark is a layout key, not a label

A benchmark is a dynamic layout key that reorders the Reflect hierarchy — not a tag pinned to a static dashboard. With a benchmark active, Reflect stops being "here's what happened" and becomes "here's what happened in the context of what you said you're working on." Switch the benchmark and the tab recomposes: different frame, different hero, different supporting context, all from the same underlying data. That recomposition is what earns the tab the name "Reflect." A view that always shows the same thing in the same order is a rearview mirror; a benchmark-keyed view is a lens.

### Three-layer hierarchy

Reflect renders in three layers, in order:

1. **Benchmark frame** — the user's benchmark sets what the view is about.
2. **Hero signal** — the primary visualization: the data dimension the benchmark promotes to the headline. **When both faces exist, the outcome face keys the hero** (the measured story is what Reflect exists to mirror) and the behavior face renders directly beneath it as consistency context — the user's own path, held or not, against the movement it was meant to produce. A behavior-only benchmark promotes its rhythm to the hero: the doing *is* the story.
3. **Supporting context** — everything else the correlation engine surfaces that moved in the same window, ranked by z-score magnitude.

The benchmark tells Reflect what to foreground; the correlation engine fills in the rest. When there is no active benchmark, the layer-2 region renders the no-benchmark default view in full — the stimulus ledger — so the frame always sits above a complete, intentional view, never an empty or half-rendered hero slot. This hierarchy is the contract between the benchmark system and the Reflect tab.

---

## Reflect = the benchmark-driven correlation hub

Reflect is where the user sees the story of their progress against their benchmarks. Visual reference: **MacroFactor's dashboard grammar** (their "Dashboard Customization" article), rebuilt in Reflect-native styling.

**Steal the structure:**

- Sectioned dashboard, each section a dimension.
- Paired small-multiple cards: label, time-window tag ("Last 7 Days" / "Today"), sparkline, headline number, chevron into the full story.
- Per-section "See All."
- The time-window tag carries the behavior face natively — a behavior card *is* "this week: 2/4," window-scoped and factual.

**The divergence from MacroFactor:**

- MacroFactor hard-codes its sections (Insights / Nutrition / Body). **Ours are driven by resolved benchmarks** — a section appears because you set a benchmark that resolved to that dimension, and is absent when you don't track it. Pick-what-you-see falls straight out of the layout-key model. (If you don't track weight, weight loss isn't in the dashboard.)
- Don't steal the palette. MacroFactor is neutral data-blue at full confidence. Reflect is warm-charcoal / earth-tone / Barlow Condensed, with **fidelity encoded visually** (opacity / stroke / dot treatment) and slate reserved for tier-3 modeled values. This is where the surface visibly becomes ours.

Reflect ends up reflecting the user's *process of achieving their benchmarks* — plus general correlation context — surfaced as tappable cards that open into a bigger narrative.

---

## No-benchmark default

With no benchmark set, Reflect falls back to the stimulus ledger as the neutral organizing frame. The tab still works — it shows the training landscape without a user-defined focal point. Weight trend is not the default hero; the ledger is.

Before any benchmark text exists, there is already one domain signal: the **onboarding activity picker** sets the user's initial headline row in the session logger (`training-logging-spec.md`, "Onboarding connection"). It's not a goal and not a benchmark — just "which activities do you care about" — but it gives the no-benchmark view a sense of the user's domain from the first session.

---

## Weight trend as optional hero

Weight trend is a common outcome dimension but is never hardcoded as the default hero. The active benchmark decides what gets promoted: a weight outcome makes the trend the hero; a behavior-only "kayak 4×/week" benchmark makes session frequency the hero and demotes weight to supporting context. A user whose goals are never weight-related never sees weight in the headline. The benchmark promotes; nothing is privileged by default.

---

## Consistency counters (the line that keeps a count descriptive)

A factual count — "4 weeks in a row at your kayaking frequency" — is information: the mirror reporting what happened. It is allowed and valuable, and it belongs to the **behavior face** (the only face that counts in windows). The constitutional line between a count and a streak:

- ✅ **Factual count:** "3 consecutive weeks at target." Resets without drama when missed. No animation, no sound, no shareable card, no punishment for the number going down. Just the new number.
- ❌ **Streak:** celebration on milestone, loss aversion on break ("you lost your 3-week streak!"), shareability, any psychological cost to the number dropping.

(MacroFactor precedent: a day-count nobody confuses for gamification.) This distinction is load-bearing — it's the difference between a benchmark consistency counter being a data point and being the gamification the product refuses (spine rule 5).

---

## Plan — the forward-looking container benchmarks populate

**Constitution tripwire.** "Plan" is one slip from the app authoring a program — the exact inverse position. The firewall is one sentence: **the app never generates the plan. It only stores and surfaces yours.** Every item in Plan is user-built or user-saved (a coach-drafted scaffold counts as user-built the moment the user saves it — see *Summoned coach*).

Plan is not a fourth tab — it is the forward-looking mode of the **Training** surface (`phase-6-plan-tab-spec.md`, which holds the detailed mechanics). It operates in two modes that map onto that spec's plan flavors:

### Scheduled  (≈ placed workouts)

You authored structure — e.g. a split mapped to Mon/Wed/Fri. When you open the app on Wednesday, Today surfaces "leg day." This is the app reading *your* plan back to you on the day. It is **pull** (you opened it; it didn't ping you). A "time for leg day!" notification would break the rule. Passive surface-on-open does not.

### Emergent  (≈ behavior faces + open activities)

You can't pre-schedule it (kayaking, when conditions allow). No plan slot. The **behavior face sets the rhythm target**, `log session` populates the record after the fact, and Today shows "2/4 this week" as a fact. The plan fills itself in from what actually happened — emergent, not assigned.

Same container, both modes honest, neither prescriptive. The two faces map cleanly onto the two plan modes: an **outcome** face *pulls scheduled workouts behind it* — the plan is the how, the path the user authored toward the movement they want; a **behavior** face *is its own plan* — the doing is the goal. A dual-face benchmark naturally spans both. (Per `phase-6-plan-tab-spec.md`.)

---

## Saved scaffolds

One pattern, used everywhere: **a reusable thing you return to that accumulates history each time you use it.** This is the **library** in `phase-6-plan-tab-spec.md` — same entity, named here for the goal layer.

- Gym splits / template workouts.
- Kayak runs / saved river sections / routes (a saved section grows a session log beneath it, with auto-pulled water-level data per the niche-sport plans).
- **Pinnable (active)** or **archived (inactive, retrievable).**

Name it once; reuse the mechanism across sports. **Strictly pull** — the library ships empty, the system never surfaces "recommended for you" scaffolds, and there is no app-authored program of any kind (spine rules 6/7).

---

## Summoned coach — the line that moved (set this on purpose)

This is a **deliberate revision** of the old "no AI on the surface, full stop" reading. The old framing welded two separate rules together: *pull-not-push* and *no-prescription*. They can be separated.

- **Pull-not-push survives.** Untouched.
- **Prescription-on-request is now allowed.** The user can summon a coach to brainstorm a training split, talk through a boulder problem, propose movement patterns that support a goal, or get help figuring out how to actually lose weight.

The whole firewall, one test: **the user reaches for it; it never reaches for them.** A chatbot is not disqualifying — *initiating* is (nudges, daily plans pushed, background actions). A summoned brainstorm partner is a different object than a notification machine even though they share a text box.

Three guardrails so it stays our coach (treat these as hard build constraints):

1. **Summoned only.** Lives behind a deliberate tap, *not* a core nav tab. No badges, no unread counts, no "I noticed you haven't logged" openers. Silence is the default state. (Door placement is open — settings may be too buried; a fifth nav tab too central.)
2. **Grounded, not freelancing.** It reads the user's actual timeline — sessions, benchmarks, fidelity — so advice is about *them*, not a generic model. This is the thing ChatGPT-in-a-tab can't do, and the actual reason to build it. (The target user is the friend who currently pastes his goals into ChatGPT; this brings that conversation in-house, next to the data.)
3. **Hands back the wheel.** It can propose a split or movement patterns *on request*, but the output is a **draft scaffold the user saves and owns** (straight into saved scaffolds), never a plan it assigns and tracks adherence against. Prescription-on-request, not prescription-imposed.

Helping someone who genuinely doesn't know how to lose weight is **not** a betrayal of "assumes competence." Competence was always the *default*, never a wall — the mirror corrects a wrong self-model gently. A summoned coach walking someone through a deficit is that same gentle correction, conversational.

This is the `product-overview.md` build-list "AI coach" line, made precise: summoned, grounded, prescribes on request, output user-owned. Lands in **Phase 7 (Ring 3, AI consultant)**.

---

## TDEE cold-start

Nutrition planning ("estimate bodyweight, initial TDEE, plan for goals") collides head-on with *outcome-measured, not predicted* (spine rule 1) — you cannot measure TDEE on day one because there is no trend yet.

Resolution, using fidelity applied to TDEE itself:

- **Onboarding ships a standard height/weight/activity-level calculator** → an expected expenditure. Exactly MacroFactor's cold-start.
- This number is a **transparent low-fidelity placeholder**, explicitly labeled as the weak predicted kind — the one spot the app knowingly uses a population formula.
- **Measured TDEE overwrites it** the moment the weight trend clears the noise floor. The app isn't predicting and standing by it; it's holding a placeholder the mirror replaces the instant reality speaks.

This is the "provisional scaffold that graduates as data accumulates" line made literal. The honesty is in never hiding that the day-one number is the weak kind.

---

## Archiving and lifecycle

- **Active** — frames Reflect and shows on the today cards.
- **Archived** — moved out of the active view with no ceremony and no "congratulations" moment. Data and history are preserved; the user can revisit archived benchmarks to see the arc.
- **Reactivated** — an archived benchmark can return to active. Process/cadence benchmarks are often seasonal ("I'm focused on fidelity right now") and cycle in and out.
- **Completed** — a natural end state for threshold benchmarks ("I hit 225"). Distinct from archived in that it carries the completion context. Still accessible in history.

Archiving should feel like setting something down, not closing a chapter.

---

## Cohort connection (Ring 4 — forward reference)

Cohort events and challenges target the same data dimensions personal benchmarks use, on the same mapping. Opting into a cohort event spawns an independent personal benchmark on the user's timeline; if the event ends or they leave the cohort, their benchmark survives. The event is social context, the benchmark is personal commitment — the individual's Reflect experience is always driven by their personal benchmarks. Full mechanics in `cohorts-spec.md`.

---

## Constitution alignment (quick audit)

- **Descriptive not prescriptive** — benchmarks are user-set; the app relates inputs, never assigns targets. Coach prescribes only on request, output owned by user. ✅
- **Behavior sovereign, outcome unmoralized** — the behavior face is the user's to hold and feel good about directly; the outcome face is reported as movement, never graded. The app never draws the causal arrow between them — the user sets their own path to success. ✅
- **Outcome-measured not predicted** — outcome faces read real data; TDEE placeholder is transparently provisional and overwritten by measurement. ✅
- **Reveal not invent** — streaks/cadence counts are revealed facts, never authored rewards. ✅
- **No gamification** — no streak celebration, no badges, no notifications on hit/miss. Cadence counts are factual stats (MacroFactor day-grid precedent). ✅
- **Pull not push** — every surface is summon/open-driven; scheduled splits surface on-open, never notify; the coach is summoned only. ✅
- **Goals are yours** — the user names and owns the goal; resolution governs only whether the app can mirror it, never whether the user may want it. ✅

---

## Build sequence

- **Phase 5 (Ring 1, full Reflect tab):** the architectural input. Build the Structured entry path + the deterministic keyword resolver (v1), render the three-layer hierarchy in the MacroFactor-grammar dashboard. Same relationship `training-logging-spec.md` holds to Phase 4.
- **Phase 6 (Plan / Training tab):** scheduled vs emergent plan modes, saved scaffolds (the library). Behavior faces resolve here, not as a second system (`phase-6-plan-tab-spec.md` — note: that spec still speaks v0.3's "cadence benchmark" language; reconcile when Phase 6 builds).
- **Phase 7 (Ring 3, AI consultant):** the Described resolver upgrades to a Haiku-class parser; the **summoned coach** ships, alongside the rest of the AI surface.
- **Phase 8 (Ring 4, cohorts):** cohort events/challenges connect to benchmark data dimensions; opt-in spawns personal benchmarks.

---

## Open questions (deferred, not blocking)

- **Active benchmark cap** — one focused at a time? N concurrent? Unbounded with one "primary"?
- **Per-face lifecycle** — can a face be archived/completed independently ("hit 75 kg, keeping the 4×/week"), or does lifecycle stay whole-benchmark? v1: whole-benchmark; revisit when a threshold outcome completes under a live behavior.
- **Milestone data model** — do benchmarks own milestones, or do milestones emerge from the correlation engine? Constitution risk: an app-authored sub-goal ("60% to 5.12!") is one step from a checkpoint/streak reward. Whatever ships must keep milestones user-authored or strictly revealed-from-outcome.
- **Benchmark creation timing** — onboarding? first open? lazily, once enough data exists for a hero signal to mean anything? Collides with cold-start: a benchmark with no data behind it is an empty frame on day one. (Partly resolved: cadence benchmarks are spawnable contextually from the Training tab — `phase-6-plan-tab-spec.md`.)
- **Coach door placement** — where exactly the summoned coach lives (settings may be too buried; a nav tab too central).
- **Described-resolver visibility** — how visibly the inferred dimension is shown back before the user commits, so the mapper never silently mis-maps text.
- **Reflect customization depth** — how much is reorderable/hideable (pull the MacroFactor "Dashboard Customization" article to set the bar).
