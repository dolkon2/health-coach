# Plan Tab — Spec (v0.1) · the Training tab as a planning surface

> **⚠️ SUPERSEDED IN PART — 2026-07-10 Training-tab planning session (Notion authority).**
> The tab-by-tab nav planning session materially revised this spec. The **authority
> is now the Notion "Training" page** (Pages and Features → Pages) until this doc is
> rewritten. What changed:
> - **The week grid is dead.** There is no rendered week/agenda view. Recurrence is a
>   per-template property ("repeats M/W/F") that surfaces *only on Home* as today's due
>   stack — never as a planner. "The week is the anchor" and the whole placed/cadence/open
>   three-shapes-on-a-week model below are retired as a *layout*; the underlying idea
>   (placed workouts vs. cadence benchmarks vs. open activities) survives, just not as a grid.
> - **The library split into two modes.** The Training tab is a top swap between
>   **Templates** (structured saved shapes, any dimension — blank-slate, numbers roll
>   forward from history) and **Routes & Sections** (saved geometry — its own future session).
>   Not one unified "week + library" surface.
> - **History left the tab.** The unified "intent becoming record" view is retired.
>   Training is forward-facing only; the logbook (chronological + calendar) becomes
>   overflow with a deferred tab-home (Profile is the parking candidate).
> - **Cadence goals** are still benchmarks (that call holds), and now compose into
>   **benchmark groups** — pausable, many-to-many bundles (see `benchmarks-spec.md`).
> - **Templates carry no numeric targets.** Progressive overload = last-performance
>   prefill with zero app suggestion; explicit targets are a benchmark concept.
>
> The constitutional spine (empty library, neutral empty days, count-not-streak,
> pull-not-push, planned-vs-actual-is-a-mirror) is unchanged and still governs.

*The Phase-6 spec session `backlog.md` gates ("Planning system needs its own spec
session before any build… Do not build ahead of this planning session"). Companion
to `training-logging-spec.md` (the logging surfaces this plans *into*) and
`benchmarks-spec.md` (the goal model cadence plans *are*). This is the vision and the
locked decisions — not a pass-by-pass build plan; that comes after this is blessed.*

*Constitutional root: spine rule 5 (no gamification), rule 6 (pull, not push), rule 7
(goals are yours, not ours). This spec is the mechanism, not a re-argument of them.*

*Decisions captured 2026-06-28 from the design session.*

---

## Name reconciliation (read first)

The shipped **Training tab** (Pass 1: log entry point + session history) and the
backlog's future **"Plan tab"** are the **same surface**. This spec evolves the
Training tab *into* the planning surface. There is no fourth tab. The information
architecture stays three tabs, each with one job:

- **Today** — log a thing *in the moment*. The quick path; no plan required.
- **Training** — *your training, planned or not*: a week view + a library of saved
  shapes. This is the surface this spec defines.
- **Reflect** — the mirror: history organized by activity, benchmark-keyed
  (`benchmarks-spec.md`).

---

## The reframe: Training = your training, planned or not

The Training tab is not a list of features. It is **your training life in one view**,
and it works the same whether or not you plan:

- If you **never plan**, the week fills in as you log. The tab is a living record.
- If you plan a **rigid split**, your whole week is laid out and you tap to log
  against it.
- Most people are **hybrid** — a gym split they place on days, runs they do "twice a
  week whenever," a paddle when the weather's right.

Planning is **opt-in, never required, never pressured**. The same screen serves the
meticulous programmer and the person who just logs what happened. The app does not
care which you are, and shows no preference for the planner.

---

## The week is the anchor

The primary view is **this week** — its days, in order. Each day holds zero or more
items, in one of three states:

- **Planned** — you placed a library item on this day. It sits there waiting. You tap
  it to *do* it (→ live session → logged). Until then it is intent, not a record.
- **Logged** — you did something. It appears once logged, planned or not.
- **Empty** — nothing planned, nothing logged. **Neutral. No judgment, no nag, no
  "you missed a day."** An empty Tuesday is just a Tuesday.

A **planned** item and a **logged** item are visually distinct (one is intent, one is
truth), but they live in the same day, in one timeline. The week is not a separate
"planner" bolted next to a separate "history" — it is one continuous view of intent
becoming record.

---

## The library: saved shapes, any surface

The **library** is your saved, reusable training shapes. This is the
`SessionTemplate` from `training-logging-spec.md § "Session templates"`, generalized
beyond the gym to **every surface**:

- **"Push Day"** — a gym template: exercises, target sets/reps/weight, order.
- **"Tuesday kayak"** — a saved paddle: flatwater, a target distance. Minimal
  structure is fine; a template can be as light as "flatwater, 8 km."
- **"Park run 5k"** — a saved run / route.
- **"Vinyasa flow"** — a saved practice: just duration + style.

A library item is **a plan without a timestamp**. Structure is *as much as the shape
warrants* — a gym template is dense (it's the point); a kayak template can be one
line. The library is the bridge that makes "saved gym split" and "saved kayak runs and
run routes" (the user's words) **one entity, not three features**.

### The library is user-authored only — the constitutional line

The app ships with an **empty library**. There is no "Beginner Push Pull Legs," no
"Couch to 5k," no app-provided program of any kind. *You* build your Push Day; *you*
save your kayak route. This is the hard line that keeps the planning surface a
**mirror, not a coach** (spine rule 6 — templates are strictly pull-based, the system
never pushes "recommended for you" content; spine rule 7 — the goals and plans are
yours). The moment the app authors a program, it stops reflecting you and starts
prescribing. It never does.

(One carve-out, set on purpose: the **summoned coach** in `benchmarks-spec.md` can
*draft* a scaffold when you ask for one — but only on request, and the draft lands as a
library item you save and own. The app still never pushes a program at you.
Prescription-on-request, never prescription-imposed; pull-not-push is the line that holds.)

---

## Two paths, one landing (the connected flow)

Planning and logging are **one flow**, not two features. Both paths produce the same
`Observation` and both land in Reflect identically.

- **Planned path** — a library item sits on Wednesday → you tap it → it becomes a
  **live session** you tick through (the gym surface's live-set + rest-timer machinery
  already shipped in Phase 4 Pass 3) → **Finish** → logged. The session carries its
  `templateId`, enabling **planned-vs-actual** (template said 5×5 @ 225, you did 5, 5,
  4, 3, 3 — that drift is honest, valuable longitudinal data, never a grade).
- **Unplanned path** — it's Friday, you went climbing → tap the day (or log from
  Today) → pick a library item *or* log fresh → done.

The "if it's planned, it's already there and you click to log it" intuition from the
session **is** this: a planned item is a pre-filled session waiting for you to press
start. The plan is the draft; the logged sets are the truth.

---

## Three flavors of plan (the hard part, made tractable)

The thing that makes this tricky — "someone's goals come in many forms" — dissolves
once you see that a week holds **three different shapes** of plan, and they coexist
without fighting because they're *placed* differently:

1. **Placed workouts** — specific sessions on specific days. The 5-day PPL split, the
   "full body every other day." These get **placed** on the week grid. (Library items
   + a day.)
2. **Cadence goals** — "run 3×/week," "kayak 4×/week." Not a session and not a fixed
   day — a **count over a window**. These get **counted**, not placed: they show as a
   progress fact ("2 of 3 this week"), and any of your logged runs satisfies one.
   **These are benchmarks** (see below) — not a new system.
3. **Open activities** — no target at all. A paddle when the weather's good, a pickup
   game. No plan, no quota; they simply **appear when logged**.

The classic hybrid week — *full-body split every other day + run twice on the off
days + yoga once* — is **two placed workouts + one cadence goal (run 2×) + one cadence
goal (yoga 1×)**, all in one week view. Placed items occupy days; cadence items ride
along as counters; open items fill in as they happen. Three shapes, one week, no
duct-tape.

---

## Cadence goals ARE benchmarks (don't build a second system)

A cadence goal ("run 3×/week") is exactly a **cadence-family benchmark** already
specified in `benchmarks-spec.md`:

- It **resolves to a tracked dimension** ("consistent" / "3×/week" → session
  frequency), entered structured or described. No goal-type enum, no category picker.
- Its progress is a **consistency counter**, and the count-not-streak line is already
  drawn (`benchmarks-spec.md § "Consistency counters"`): "3 of 3 this week," "4 weeks
  in a row at your frequency" is a **factual count** — it resets without drama, no
  celebration, no loss-aversion, no shareable card. The friend who knows "I've run 10
  miles a week for six years" is reading a **count**, and that stat being quietly
  rewarding is the mirror working — *not* a streak flame.

The division of labor between the tabs:

- **Training** is where a cadence benchmark is **set and felt this week** — the live
  "2 of 3" as you move through the days.
- **Reflect** is where it's **mirrored back over time** — "you've held this for 6
  years," benchmark-keyed (it promotes session frequency to the hero, per
  `benchmarks-spec.md`).

This **resolves an open question** in `benchmarks-spec.md § "Open questions"`
("Benchmark creation timing — dedicated flow only, or spawnable contextually?"):
**yes, spawnable contextually** — a cadence benchmark can be created right from the
Training tab ("I want to run 3× a week"), not only from a dedicated Reflect flow.

A **strength** benchmark ("deadlift 180") *pulls placed workouts behind it* (the plan
is the how). A **cadence** benchmark ("run 3×") *is its own plan* (the doing is the
goal). Some aims need a plan; some are one.

---

## What stays honest (constitution checkpoints for the build)

Every one of these is a place the planning surface could quietly become a coach. The
build must hold all of them:

- **Library is user-authored only.** Ships empty. No app programs, ever. (Rule 6/7.)
- **Empty days are neutral.** No nag, no "you skipped leg day," no red. (Rule 5/6.)
- **Cadence is a count, not a streak.** "2 of 3 this week." No flame, no milestone
  animation, no loss-aversion on a miss. (Rule 5; `benchmarks-spec.md`.)
- **Pull, not push.** Planning surfaces nothing unprompted. No "you haven't run this
  week" notification. You see your counts *when you open the app*, never as a ping.
  (Rule 6.)
- **Planned-vs-actual is a mirror, not a grade.** The drift between plan and reality
  is shown as fact, not scored, judged, or "completion-rate"-d into a percentage to
  chase. (Rule 5.)

---

## Relationship to what's shipped & what this depends on

- **Builds on** Pass 1 (Training tab shell + session-history feed — shipped) and the
  Phase-4 live-session machinery (timestamped sets, rest timer — shipped).
- **Needs** the `SessionTemplate` entity (Phase 4 **Pass 7** deferred — the library
  *is* this entity, generalized to all surfaces) and, for rich gym templates, the
  exercise library (Pass 4 deferred). Light templates (kayak/run/practice) need
  neither.
- **Ties into** the benchmark system (Phase 5 / `benchmarks-spec.md`) for the cadence
  flavor and the Reflect mirror.
- **This spec gates the Phase-6 build.** The pass-by-pass build plan is a separate doc
  authored *after* this vision is blessed (mirroring how `phase-4-training-plan.md`
  followed `training-logging-spec.md`).

---

## Open questions (for the build-plan session, not yet decided)

- **Week-view shape.** A 7-day strip? A vertical agenda list? A scrollable multi-week
  view? This is the central UI-feel decision and unresolved.
- **Recurrence.** A split *repeats* ("Push every Monday"). How is recurrence expressed
  without the app owning a rigid multi-week "program"? Options range from "copy last
  week" to a saved weekly template. The constitutional risk: a recurrence engine that
  starts feeling like the app prescribing structure.
- **Placement granularity.** Day-only, or day + time? (Time enables "morning run vs
  evening lift" but adds weight.)
- **Routes as a sub-shape.** Does a saved GPS route (kayak/run path) live inside
  `SessionTemplate`, or is it a sibling entity a template *references*? Affects the
  data model.
- **Planned-vs-actual surfacing.** Where the drift shows (in the week? in Reflect? in
  the session detail?) and how, without becoming a completion score.
- **Cadence cap & overlap.** How many cadence benchmarks at once (inherits the
  `benchmarks-spec.md` "active benchmark cap" open question), and how a placed workout
  that *is* a run double-counts toward a "run 3×" cadence — once, presumably, but the
  bookkeeping needs stating.
- **Hybrid density.** How a rigid placed split and flexible cadence counters share one
  week visually without the week feeling cluttered or the cadence goals feeling buried.
