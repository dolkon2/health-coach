# Game Plan \+ Claude Code Prompts (v0.1)

*The order of operations for getting from "I have planning docs" to "I'm using the app on my phone." Includes the actual prompts to paste into Claude Code at each step.*

---

## Ring ↔ Phase ↔ Pass mapping (legend)

The three numbering schemes that show up across the planning docs all refer to the same build sequence — this legend is the Rosetta stone. Don't renumber; just consult.

- **Rings** are the architectural strata from `product-overview.md` (inside-out: engine → nutrition → recovery → AI → social).
- **Phases** are the build chunks. Phase 1 was the minimum useful loop; later phases each open a new tab or a new ring's worth of data.
- **Passes** are individual Claude Code sessions inside a phase.

| Ring | Phase | What it is | Passes | Status |
| :--- | :--- | :--- | :--- | :--- |
| Ring 1 | Phase 1 | Core engine + daily loop (Today, Reflect) | Passes 1–5 | ✅ complete |
| Ring 1 | Pass 6 | Edit/delete CRUD on logged sessions + weigh-ins | 1 pass | next |
| Ring 1 | Phase 4 | Training tab + logging surfaces (gym / GPS / swim / practice) | 5 core + 3 fast-follow | pending |
| Ring 1 | Phase 5 | Full Reflect tab + benchmarks | 3 passes | pending |
| Ring 1 | Phase 6 | Plan tab (calendar / scheduling) | 2 passes | pending |
| Ring 2 | Phase 2 | Food logging via nutrition API | 3 passes | pending |
| Ring 2.5 | Phase 3 | Sleep + steps via HealthKit / Health Connect / Garmin | 3 passes | pending |
| Ring 3 | Phase 7 | AI consultant (plateau forensics, retrospective first) | 4 passes | pending |
| Ring 4 | Phase 8 | Cohorts (events, challenges, profile) | 4 passes | pending |

Notes:
- "Phase" and "Ring" don't track linearly — Ring 1 is spread across Phase 1, Pass 6, and Phases 4–6 because the core loop keeps deepening as later rings come online.
- Pass 6 is broken out from "Phase 1" because the 5-pass plan in this doc is what shipped Ring 1 v1; CRUD is the first additive pass on top.
- Phase 4 was expanded past this legend's original 3-pass placeholder by the HALT logging deep-dive (2026-06-27). Full breakdown: `planning/phase-4-training-plan.md` — **5 core passes** (Training tab + gym/GPS/swim/practice surfaces) + **3 fast-follow** (exercise library, templates, identity tags). The original "planned workouts → Today" scheduling concept moved to **Phase 6** (Plan tab); the Training tab is history + the log entry point, not a planning surface.
- The full planning-doc home for each ring's spec: Ring 1 = `phase-1-build-spec.md` + `training-logging-spec.md` + `benchmarks-spec.md` + `correlation-engine-spec.md`; Ring 2 = (food spec TBD); Ring 2.5 = `data-model.md` (ingestion notes); Ring 3 = `ai-consultant-prompt.md`; Ring 4 = `cohorts-spec.md`.

---

## Before opening Claude Code

You need three things in place:

1. **Planning folder synced.** Move all the planning docs into a single `planning/` folder in what will be your repo. Specifically:  
     
   - `claude-md.md` (the constitution — also gets copied to `CLAUDE.md` at repo root, Claude Code reads it from there automatically)  
   - `product-overview.md`  
   - `competitive-landscape.md`  
   - `correlation-engine-spec.md`  
   - `data-model.md`  
   - `phase-1-build-spec.md`  
   - `brand-kit.md`  
   - `ai-consultant-prompt.md` (for later — Phase 7\)

   

2. **Dev environment set up.** Node 20+, the Claude Code CLI installed, your editor of choice ready. The Expo / RN tooling will be installed by the project itself.  
     
3. **Repo created (empty).** A new directory, `git init`, an empty `README.md`. Don't scaffold the Expo app yet — Claude Code will do that with full awareness of the planning docs.

That's it. Now you can open Claude Code in the repo root and start.

---

## The path

You're going to do this in five passes. Each pass is a session in Claude Code. The prompts get progressively more focused as the repo accumulates structure.

| Pass | Goal | Output | Time estimate |
| :---- | :---- | :---- | :---- |
| 1 | Repo scaffold \+ core engine port | Expo app skeleton, `core/` package wired, brand kit as theme | 1 session, \~1–2 hours |
| 2 | Storage layer | SQLite schema, Observation CRUD, migration tooling | 1 session, \~1 hour |
| 3 | Today screen \+ weigh-in flow | First end-to-end vertical slice — you can log a weight | 1–2 sessions |
| 4 | Session logging | Sessions write to the stimulus engine; logged sessions appear on Today | 1–2 sessions |
| 5 | Reflect screen | Trend chart \+ stimulus ledger reading from the engines | 1–2 sessions |

After pass 5 the acceptance criteria in `phase-1-build-spec.md` should be met.

---

## Pass 1 — Repo scaffold \+ brand kit

**Goal:** Working Expo app shell that launches, with the brand kit wired as a theme, the planning docs visible, and the existing `core/` package importable.

**Prompt to paste into Claude Code:**

Read CLAUDE.md and the planning/ folder in full before doing anything.

Pay particular attention to claude-md.md (the constitution),

phase-1-build-spec.md (what we're building first), and brand-kit.md

(visual direction). Then scaffold the project.

Constraints:

\- Expo \+ React Native \+ TypeScript. Use expo-router for navigation.

\- Two tabs in Phase 1: Today and Reflect. Settings is a top-right gear

  icon, not a tab.

\- The existing core/ engine modules (observation.ts, timeline.ts,

  trend.ts, expenditure.ts, stimulus.ts) live in a separate package

  that the app imports. I'll add those files to core/src/ — set up the

  workspace so app/ imports from core/ cleanly.

\- Translate brand-kit.md into a TypeScript theme module

  (app/theme/tokens.ts). All colors, typography, spacing, radius,

  motion. Use the dark-mode palette as the default. A ThemeProvider

  exposes the tokens via React context.

\- Pre-load the three font families (Barlow Condensed, Inter, JetBrains

  Mono) via expo-font.

\- The two tabs and the Settings icon should render as empty placeholder

  screens that read the theme tokens correctly. Today shows the date in

  the display font, uppercase, in \--color-text. Reflect shows the word

  "Reflect" in the same style. The bottom tab bar uses \--color-sandstone

  for active and \--color-text-muted for inactive.

\- Do NOT add a splash screen, onboarding, auth, or any feature that

  isn't in phase-1-build-spec.md. We are deliberately not building

  those.

Before you start, list the files you plan to create and the package

choices you intend to make (charting lib excluded — we'll decide that

in pass 5). Wait for me to confirm before writing.

**What to look for in the response:**

- It should list files before creating them.  
- The structure should match the architecture diagram in `phase-1-build-spec.md`.  
- It should ask about anything ambiguous (e.g. monorepo tool choice for `core/` ↔ `app/`).

**Red flags to push back on:**

- It adds a login screen or onboarding "to be safe."  
- It uses bright colors anywhere — the brand kit is muted earth tones, full stop.  
- It uses a UI kit (NativeBase, Tamagui, etc.) without asking. Phase 1 is custom-styled per the brand kit; UI kits will fight that.

---

## Pass 2 — Storage layer

**Goal:** SQLite tables for Observations and Benchmarks, CRUD functions, migration tooling. No UI yet — this is plumbing.

**Prompt:**

Read planning/data-model.md in full. This is the schema we're

implementing.

Build the storage layer in app/storage/:

\- db.ts: SQLite initialization via expo-sqlite. Set up a migrations

  table and a runMigrations() function that applies pending

  migrations in order.

\- migrations/001\_initial.sql: tables for observations and benchmarks

  matching the types in data-model.md. Tier, fidelity, source (as

  JSON), payload (as JSON) are columns on observations. Add indexes

  on (kind, occurredAt) and (occurredAt) for the timeline queries

  the engine will run.

\- observations.ts: typed CRUD — create(obs), list({ from, to, kinds }),

  byId(id), supersede(oldId, newObs). All functions return Promises.

\- benchmarks.ts: same shape for the Benchmark type.

The core/ engine modules expect to receive arrays of Observation

objects. The storage layer's job is to read from SQLite, hydrate

them into the typed shape, and hand them to the engine. The engine

never touches SQLite directly.

Write a tiny smoke test in app/storage/\_\_tests\_\_/observations.test.ts

that inserts a fake weigh-in and reads it back. Use Jest, configured

for the Expo project.

Before writing, sketch the migration SQL and the function signatures.

Wait for me to confirm.

**What to look for:**

- The Observation table is generic — `kind`, `payload` as JSON. NOT separate tables per kind.  
- Migrations are versioned and runnable. Not a one-shot DDL.  
- It doesn't try to use TypeORM or Prisma — overkill for this.

---

## Pass 3 — Today screen \+ weigh-in

**Goal:** First end-to-end vertical slice. Open the app, tap a button, enter your weight, see it on Today.

**Prompt:**

Read planning/phase-1-build-spec.md sections on Today and Log Weigh-In.

Read planning/brand-kit.md for visual rules — especially the rules on

display font, data font, fidelity indicator, and tier visualization.

Build:

1\. The Today screen (app/screens/Today.tsx).

   \- Date header at top, display font, uppercase, \--color-text-muted.

   \- Weigh-in card. Two states:

     \- Not logged today: a single tap target ("LOG WEIGH-IN") that opens

       the LogWeighIn modal.

     \- Logged today: shows today's weight in \--text-data-lg, in

       \--color-text. Underneath it: the trend delta from the trend

       engine (e.g. "trend: 153.2 kg, ↓ 0.4 over 14 days") in

       \--text-body-sm, \--color-text-secondary.

   \- Below the weigh-in card: an empty SessionsTodayList placeholder

     component (just renders "no sessions" — we'll fill it in pass 4).

2\. The Log Weigh-In modal (app/screens/LogWeighIn.tsx).

   \- Big number input (--text-data-lg).

   \- Unit suffix (kg or lb based on settings — default kg for now,

     read from a stub useSettings hook).

   \- Optional body-fat % field.

   \- Save button using \--color-sandstone background.

   \- On save: writes an Observation with kind='weighIn', tier=1,

     fidelity=1.0, source={ type: 'manual' }, payload populated.

   \- Dismisses back to Today, which re-fetches and renders the new

     weigh-in.

3\. A useTodayObservations() hook that queries the storage layer for

   today's observations in the user's local timezone.

4\. A useWeightTrend() hook that calls the core/trend engine with

   the last 90 days of weigh-ins and returns the trend points.

The trend delta line on the weigh-in card consumes useWeightTrend().

If there's not enough data for a meaningful trend (define this in

the engine if it isn't already), the delta line just doesn't render.

Don't fake a number.

Before writing, show me the component tree and the data flow for

the trend delta computation. Wait for confirmation.

**What to look for:**

- It separates the screen (rendering) from the hooks (data) cleanly.  
- It correctly distinguishes display font (header) from data font (the number).  
- It handles the "not enough data" case without faking output.

---

## Pass 4 — Session logging

**Goal:** Log a workout, see it on Today, watch the stimulus engine pick it up.

**Prompt:**

Read planning/phase-1-build-spec.md sections on Log Session, and

planning/data-model.md for the SessionPayload shape (LiftingBlock,

movement patterns, etc.).

Build:

1\. The Log Session modal (app/screens/LogSession.tsx).

   \- Step 1: modality picker (gym / run / ride / climb / paddle /

     hike / other). Big tap targets, \--color-surface tiles.

   \- Step 2 (modality-dependent): set logger if gym, lighter form

     for others.

   \- Gym set logger:

     \- "Add exercise" → opens an inline input for the exercise name

       (free-text for Phase 1, picker comes later) plus a movement

       pattern select (required — upper-push, upper-pull, hip-hinge,

       quad-dom, core, carry, rotation, unilateral-leg, isolation,

       other).

     \- For each exercise, a set table: weight (number), reps (number),

       RIR (optional number), warmup checkbox.

   \- Endurance modalities (run, ride, paddle): duration, distance,

     avg HR (all optional), energy system select.

   \- Climb: style, list of sends (grade \+ attempts \+ sent boolean).

   \- All modalities: notes field at the bottom, perceived effort 1-10.

   \- Save button.

   \- On save: writes an Observation with kind='session', tier=1,

     fidelity=0.95 (manual logging is high fidelity but not perfect —

     you might mis-enter), source={ type: 'manual' }, payload built

     from the form state.

2\. Update Today's SessionsTodayList to:

   \- Query today's session observations.

   \- For each: render a SessionCard component showing modality,

     duration, RPE.

   \- Below each card: a one-line "what this contributed" string drawn

     from the stimulus engine's reveal() function on that session.

3\. A useTodayStimulusContributions() hook that runs each of today's

   session observations through stimulus.ts and returns the

   per-session contribution text.

Note: the movement pattern tagging is the one bit of friction that

matters — the engine needs it to do its job. Make this feel like a

fact about the exercise, not a tax on logging. Consider: free-text

exercise name \+ pattern picker that remembers your past tags

(local-only autocomplete from prior sessions). When you've logged

"barbell back squat" once with pattern=quad-dom, it should default

to that next time.

Before writing, show me the form state shape for the gym set logger

and how it maps to a LiftingBlock when saving.

**What to look for:**

- Movement pattern is treated as required, not optional. (Engine depends on it.)  
- The autocomplete-from-history pattern for exercise name \+ pattern.  
- The session card pulls its description from `stimulus.reveal()`, not from inline UI text.

---

## Pass 5 — Reflect screen

**Goal:** A real trend chart and a real stimulus ledger. This is where Phase 1 starts feeling like a product.

**Prompt:**

Read planning/brand-kit.md sections on Chart & data visualization,

Fidelity visualization rules, and Tier visualization rules. Read

planning/phase-1-build-spec.md section on Reflect.

This screen has two main components. Build both.

1\. WeightTrendChart (app/components/WeightTrendChart.tsx).

   \- Pulls data from useWeightTrend() over the last 90 days.

   \- Renders:

     \- The smoothed trend line in \--color-trend-line, 2px,

       no border-radius on the container.

     \- Raw weigh-in dots at fidelity-appropriate styling: solid filled

       for high (always, since manual is 1.0), but the \*infrastructure\*

       for hollow/dotted at lower fidelity must be in place — we'll

       have low-fidelity weigh-ins eventually (e.g. estimated from a

       photo of a scale, hypothetically).

     \- A confidence band — narrower when there are lots of recent

       weigh-ins, wider when sparse.

     \- X-axis: dates, \--text-data-sm, \--color-text-muted.

     \- Y-axis: weight, same styling.

   \- Horizontal swipe to scroll back in time.

   \- Tap a dot to see that day's weigh-in modal in summary.

2\. StimulusLedger (app/components/StimulusLedger.tsx).

   \- Pulls the current week \+ 7 prior weeks from

     useWeeklyStimulus() — a new hook that calls the stimulus engine

     and groups by movement pattern.

   \- Renders as a stacked bar chart, one bar per week, segments by

     movement pattern.

   \- Color: use the chart-series palette from brand-kit.md. Don't

     assign green/red — assign sage / sandstone / clay / slate.

   \- Tap a week → drills into a list of sessions that contributed.

3\. The Reflect screen (app/screens/Reflect.tsx) renders both vertically,

   trend on top.

4\. Inferred TDEE — DO NOT render in Phase 1\. We don't have intake data

   yet. If the expenditure engine would produce a value, it would be

   meaningless. The screen can show a single muted line at the bottom:

   "Expenditure available once food logging is in (Phase 2)." Or just

   omit. Don't fake a number.

Charting: I'd like to roll a custom thin SVG-based chart rather than

use a library. The brand-kit fidelity rules (dashed strokes, opacity

by fidelity, narrow vs wide confidence bands) are too specific for

most charting libraries to do well, and we want this to be visually

distinctive. react-native-svg gives us the primitives. Before writing,

sketch the rendering approach (path computation, scale functions,

gesture handling) and confirm.

**What to look for:**

- It actually does the custom SVG path and doesn't fall back to a library halfway through.  
- It honors the brand-kit visual rules — sage/sandstone, not green/red. Hard edges on chart containers.  
- It explicitly does NOT render a fake TDEE number.

---

## ⛔ HALT — Exercise logging deep dive (before Phase 2)

**Do this before moving past Phase 1.** Pass 4's session logging is functional but intentionally minimal. Before building anything else, do a dedicated planning session to design the full logging experience. These decisions all interconnect and need to be resolved together:

- **Garmin + Apple Health API integration** — these will be the primary data source for most session metrics (pace, elevation, HR zones, splits). Manual forms become a fallback. The API shape drives what the forms need to capture vs what comes for free.
- **Training tab (planned workouts → Today)** — a new tab where users plan workouts. A planned workout lands on Today as a to-do that becomes a logged session. This changes Today's model from "what happened" to "what's planned + what happened."
- **Reopen/edit a logged session** — currently immutable Observations. The `supersede` pattern exists from weigh-ins.
- **Delete a session** — related to edit. No delete affordance on Today's session cards yet.
- **Duration: required vs optional** — quirk #8. APIs would supply duration automatically.
- **Hike: elevation gain, pace** — not captured yet. Likely comes from API import.
- **Activity log formatting/presentation** — how sessions look on Today and in history.

Don't build detailed logging improvements piecemeal. Plan them together, then build.

---

## After Phase 1

Stop. Use the app for two weeks. Notice what feels right and what feels broken. *Don't add features.*

The honest assessment after two weeks:

- If you're opening it daily without prompting yourself → the loop is real. Move to Phase 2 (food via API).  
- If you're forgetting it → the loop isn't right. Don't paper over that by adding food. Figure out why first. The fix might be smaller than you think — a friction in weigh-in entry, a chart that doesn't show what you actually want to see.

The danger after Phase 1 is feature-tunneling. Resist. The whole product hinges on the daily loop. Phase 2 doesn't fix a broken loop; it adds to a working one.

---

## General Claude Code working notes

A few patterns that pay off across all five passes:

- **Plan before writing.** Every prompt above ends with "show me X before writing." Don't drop that. It catches expensive mistakes cheaply.  
- **Keep the constitution in front.** Claude Code reads `CLAUDE.md` at every session start. When you push back on something — "this violates principle 7" — it should know what you mean. If it doesn't, the constitution isn't strong enough; fix the doc.  
- **Watch for "helpful" additions.** Claude will sometimes add an onboarding flow, a stub login screen, a "welcome modal" — things that feel like polish but aren't in scope. Cut them. The bar in Phase 1 is "minimum useful loop," not "looks like a real app."  
- **Commit per pass.** Git commit at the end of each successful pass. If a pass goes sideways, `git reset --hard` and re-prompt. Cheap.  
- **Save the chat transcripts.** Each pass produces decisions worth referring back to. Drop the transcript into a `dev-log/` folder in the repo. Later phases will benefit from knowing what was considered and rejected.

---

## What you'll have at the end of Phase 1

- An Expo app on your iPhone you can install via TestFlight or Expo Go.  
- Local SQLite storage of every weigh-in and session you log.  
- A real smoothed weight trend and a real weekly stimulus ledger, both rendering against the engine you already wrote.  
- The visual language of the product established. Future phases plug in without re-skinning.  
- Most importantly: **a daily loop with no AI, no notifications, no streaks, and no fluff.** If that loop works for you, the product thesis is proven. Everything after is amplification.

