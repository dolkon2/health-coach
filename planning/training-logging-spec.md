# Logging Architecture Spec (v0.1)

*Companion to the product overview and correlation engine spec. Covers session logging across all activity types — the primary input surface of the entire product.*

---

## The three-layer model

Logging architecture separates into three decoupled layers. Each serves a different audience and can change independently of the others.

**Identity layer (what the user sees).** Activity labels: Run, Climb, Gym, Swim, etc. These are the words on the picker, the icons in the history, the thing that makes a climber feel like the app was built for climbers. Cheap to add, user-customizable, no engine implications.

**Logging surface layer (what fields appear).** A small number of structurally distinct UIs — gym (sets/reps/weight), GPS (route/distance/elevation), climbing (grade/style/sends or session-level), swimming-pool (laps/stroke/intervals), and practice (duration/effort/style). Many activities share a logging surface. Run, Ride, Hike, Paddle, and a dozen others all resolve to the GPS surface.

**Engine layer (what powers correlation).** Movement patterns (upper push, upper pull, hip hinge, quad dominant, etc.) and energy systems (aerobic, glycolytic, ATP-CP). The stimulus ledger reads this layer, not the identity or logging layers. A climbing session and a lat pulldown both register as upper-pull volume because the engine maps them by movement pattern, regardless of what session kind or activity label they carry.

These three layers are the reason the app can welcome new activity communities without building new logging UIs or touching the engine. Adding wingfoil is an identity label, a pointer to the GPS logging surface, and an energy-system tag. Five minutes of work, zero new code.

---

## Activity picker

### Headline row (customizable)

The logger opens with a row of headline activities — the user's primary sports, always one tap away. Ships with a sensible default: **Run, Ride, Hike, Climb, Swim, Gym, Practice.** The user reorders, adds, or removes activities to match their life, the same way Garmin lets you customize your watch's activity list.

A climber who surfs pushes Climb and Surf to the front. A triathlete puts Run, Ride, Swim. Someone who only lifts and runs has a two-item row. A wingfoiler can pull wingfoil into the headline tier so it's never buried.

The headline config is a user preference: an ordered list of activity IDs. No engine or data model implications.

### Long tail ("More")

One tap below the headline row. Kayak, paddle, wingfoil, ski, snowboard, skate, surf, whitewater kayak, mountain bike (if not headlined), and anything else. All resolve to the appropriate logging surface (almost always GPS). Trivially extensible.

### Onboarding connection

During setup, a "what do you do?" activity picker sets the initial headline row. Not a goal picker. Not prescriptive. Just: "which activities do you care about, so I put them where you can reach them." The first session feels like the app already knows you.

---

## Session kinds (logging surfaces)

### Gym

For: strength training, calisthenics, functional training, CrossFit, climbing training (hangboard, campus board, system board — see Climbing section for why these live under Climbing in identity terms).

**Session-level fields:**

- Title (freeform, user-written): "Upper," "Push 1," "Heavy Lower," "Light Pull \+ Arms," "Full Body A." The user's mental model of the session. Engine doesn't need it; the user needs it to scan history.  
- Template reference (optional): links to the SessionTemplate this session was based on, enabling planned-vs-actual comparison over time.  
- Start time: auto-captured when the first set is logged.  
- End time: auto-captured when the last set is completed.  
- Duration: derived from start/end. Never manually declared.  
- Perceived effort (RPE 1–10): session-level rating logged at the end.  
- Note (optional): freeform text.  
- Identity tags: "calisthenics," "strength," "functional," etc. Inherited from exercises and/or set by user. Filterable in history.

**Exercise-level fields:**

- Exercise reference: stable ID from the exercise library or a custom exercise.  
- Order within session: preserved, because sequencing is meaningful (compound-first, pre-fatigue, etc.).  
- On selecting an exercise, the user sees recent history with that movement — last few sessions, weight/reps/performance. Minimum context to decide today's load. (The Strong pattern.)

**Set-level fields (the atomic unit):**

- Weight: in the user's preferred unit (lbs/kg, with per-set override for the person who benches in lbs and does cables in kg).  
- Reps: count completed.  
- RIR (reps in reserve): 0–5+ scale. This is the gym's fidelity equivalent — it tells the engine how much to weight the set when calculating stimulus load. A session of RIR-4 sets and a session of RIR-1 sets at the same weight and reps are very different stimuli.  
- RPE (optional): for users who prefer that scale over RIR. One or the other, not both forced.  
- Set type: working, warmup, drop set, failure set. Warmup sets shouldn't count the same as working sets in volume calculations.  
- Rest duration: auto-captured from the rest timer (starts when set is completed, stops when next set begins), or manually entered.  
- Completed as planned: flag for whether the set matched the template target or was modified (enables planned-vs-actual drift tracking).  
- For bodyweight movements: weight is zero/null or the added weight if weighted.

**Rest timer:**

- User sets their default rest duration (e.g. 90 seconds).  
- On completing a set, timer starts automatically.  
- Timer fires notification when rest is up.  
- Tapping next set stops the timer; actual rest duration is recorded on the completed set.

**Deliberately excluded from v1:** tempo (eccentric/concentric timing), range of motion notation, video-based form analysis. All real, none necessary for the logging loop to work.

**Fidelity in the gym context:** Unlike food logging, gym fidelity isn't primarily about measurement confidence — you know what's on the bar. Gym fidelity is about *effort fidelity*, captured through RIR. The secondary fidelity signal (was this logged in real-time or reconstructed from memory?) can be derived from the timestamp of data entry relative to the session, without requiring user self-report.

### Climbing

For: bouldering (indoor), route climbing (indoor), outdoor climbing, and climbing-specific training.

Climbing training (hangboard, campus board, system board) lives under the Climbing umbrella by identity, even though its logging shape is set-based (duration, weight, reps, rest — same atoms as gym). A climber shouldn't have to file their hangboard session under "Gym." The stimulus ledger maps it correctly regardless because it reads movement patterns, not session kind.

**Sub-types:**

- Bouldering (indoor): session-level logging. Duration, perceived effort, hardest grade attempted, hardest grade sent, notable sends (with optional photo/note). Logging every attempt would be hostile UX.  
- Route climbing (indoor): individual routes. Grade, style (onsight/flash/redpoint/hang), note.  
- Outdoor climbing: individual routes with richer detail. Grade, style, route name, location, pitch count for multipitch, photos.  
- Training: set-based logging (hangboard protocols, campus board, system board). Same fields as gym sets — duration/weight/reps/rest — but housed under climbing.

**Open item:** Deep dive into climbing apps (Kaya, Crux, Toplogger, Mountain Project) before finalizing the climbing logging surface. Mountain Project is worth checking for API/data import of outdoor climbing history. Indoor vs. outdoor logging needs are meaningfully different and deserve dedicated research.

### Outdoor / GPS

For: Run, Ride (road \+ mountain), Hike, Paddle, Kayak, Surf, Wingfoil, Ski, Snowboard, and the full long tail of outdoor movement.

The logging surface is thin by design because the rich data comes from wearable import.

**From wearable (high fidelity):**

- GPS trace / route  
- Distance  
- Elevation gain/loss  
- Heart rate (average, max, zones)  
- Splits / pace  
- Duration

**Manual fallback (no wearable — lower fidelity, and the system encodes that honestly):**

- Duration  
- Distance (estimated)  
- Perceived effort

**All GPS activities:**

- Perceived effort (RPE 1–10)  
- Note (optional)  
- Sub-type tag (road bike vs. mountain bike, kayak vs. whitewater, etc.)  
- Identity tag for filtering

**Key principle (rewritten 2026-07-02 — direction change blessed):** The app records its own routes. Native GPS capture (`gps-mapping-spec.md`, rung 2) is the primary route source: an activity recorded in the app gets a first-party trace — pull-based, started and stopped only by the user, descriptive. Wearable import is *enrichment* for activities recorded elsewhere; if the user has a watch, prefer its recording and never re-record on the phone (the dedup logic is already specced). Strava remains the right reference for how *display* of GPS data should feel, not for how logging works. The manual no-GPS fallback stays sparse but honest.

> Blessed by Dylan 2026-07-02, reversing v0.1's "the app is not building a GPS tracker, it's ingesting from one." Driver: the Garmin direct API is blocked (program suspended + legal-entity requirement) and Garmin omits the route via both Apple Health and Health Connect, so ingestion alone can't guarantee a route. Own-run recording stays descriptive + pull-based, so the north star holds. History: `wearable-ingestion-spec.md` § Addendum, Layer 1. Placement decided the same day: Phase 3 fast-follow.

### Swimming

Splits into two sub-types with different logging surfaces:

**Pool (laps / structured):**

- Distance (by lap count × pool length, or total)  
- Stroke type  
- Intervals / sets (for structured swim workouts)  
- Duration  
- Perceived effort

**Open water (GPS-shaped):**

- Same as outdoor/GPS surface: route, distance, duration, conditions  
- Perceived effort

### Practice

For: Yoga, Pilates, mobility work, stretching, meditation, breathwork.

**Fields:**

- Duration  
- Perceived effort  
- Style tag (vinyasa, yin, reformer, mat, etc.)  
- Note (optional)

No individual pose or exercise logging — the granularity isn't useful for correlation and would be hostile UX. The value to the engine is "you did 60 minutes of mobility work on Tuesday," not "you held pigeon pose for 90 seconds."

---

## Exercise library

### Pre-populated database

A searchable, pre-populated exercise library ships with the app (sourced from an API like wger, ExerciseDB, or a curated static dataset). Each exercise entry includes:

- Name  
- Muscle groups targeted (primary and secondary): lats, chest, front delts, glutes, quads, etc.  
- Movement pattern(s): upper push, upper pull, hip hinge, quad dominant, etc. (for the stimulus ledger)  
- Energy system (where applicable)  
- Category / identity tags: strength, calisthenics, functional, etc. An exercise can carry multiple tags.  
- Demo / description (stretch goal)

The user searches by name or by muscle group. Searching "lats" surfaces lat pulldown, pull-up, barbell row, cable row, etc. The movement pattern is attached but not the primary search axis — users think in muscle groups when programming.

### Custom exercises

Users can add exercises not in the library. On creation, the user tags muscle groups manually. The engine can infer movement pattern from the muscle group combination (lats \+ biceps \+ rear delts → upper pull), or the user can optionally set it directly. Custom exercises are first-class — they appear alongside library exercises in search, carry history, and map to the stimulus ledger identically.

### Movement pattern → muscle group bridge

This is the "AI in the plumbing" principle applied to the exercise library. The user thinks and searches in muscle groups (intuitive, familiar). The engine thinks in movement patterns (where the correlation value lives — it's what lets a climbing session substitute for a gym pull day). The bridge between them is the exercise database tagging, invisible to the user during logging but visible if they explore the stimulus ledger or exercise detail view.

---

## Session templates (pre-programming)

A SessionTemplate is a workout plan without a timestamp — browsable by title, stimulus intent, or identity tag. It defines exercises, target sets/reps/weight, and order.

When the user opens a template to train, it becomes a real Session. The template provides the plan; the logged sets are the truth. The planned-vs-actual comparison (template said 5×5 at 225, you did 5, 5, 4, 3, 3\) is where the honesty lives and is valuable longitudinal data.

Templates are strictly pull-based. The user browses and selects them on their own initiative. The system never pushes "recommended for you" content. (Spine rule 6.)

---

## Identity tags

Identity tags serve the belonging function — making the user feel seen without forking the logging UI.

- Carried on exercises (an exercise can have multiple: a weighted pull-up is both "calisthenics" and "strength").  
- Carried on sessions (inherited from exercises and/or set directly by the user).  
- Filterable in history: "show me all my calisthenics sessions."  
- Searchable in the exercise library: "show me calisthenics exercises."  
- Used in the Reflect tab for context (later phases).

Tags are the answer to "I'm a calisthenics athlete and this app doesn't have a place for me." The place is everywhere — your exercises are tagged, your sessions are tagged, your history filters by it. The gym logging surface handles your movements natively because handstand push-ups and barbell bench use the same set/rep/weight fields. The tag is what makes it *yours.*

---

## Data model summary (key entities)

Session

├── kind: gym | climbing | outdoor\_gps | swimming | practice

├── activity: run | ride | hike | climb | swim | gym | yoga | ...

├── sub\_type: bouldering | route | open\_water | pool | training | ...

├── title: string (freeform)

├── identity\_tags: string\[\]

├── template\_ref: SessionTemplate ID (optional)

├── start\_time: auto-captured

├── end\_time: auto-captured

├── perceived\_effort: 1-10

├── note: string (optional)

│

├── exercises: ExerciseEntry\[\] (gym, climbing-training)

│   ├── exercise\_ref: Exercise ID

│   ├── order: number

│   └── sets: Set\[\]

│       ├── weight: number (nullable for bodyweight)

│       ├── weight\_unit: lbs | kg

│       ├── reps: number

│       ├── rir: number (optional)

│       ├── rpe: number (optional)

│       ├── set\_type: working | warmup | drop | failure

│       ├── rest\_duration\_seconds: number

│       └── completed\_as\_planned: boolean

│

├── gps\_data: GPSData (outdoor\_gps, open\_water swim)

│   ├── source: garmin | apple\_health | manual

│   ├── gpsPath: GeoPoint\[\] (optional) — `{ lat, lng, tsSec, eleM? }`, the canonical geometry (matches `data-model.md` and `core/src/observation.ts`). GeoJSON is a render-boundary projection only, never the stored shape — a `LineString` throws away the per-point timestamps that make splits and the elevation profile derivable.

│   ├── distance: number

│   ├── elevation\_gain: number

│   ├── elevation\_loss: number

│   ├── heart\_rate: { avg, max, zones }

│   └── splits: Split\[\]

│

├── climbing\_data: ClimbingData (bouldering, route)

│   ├── hardest\_attempted: grade

│   ├── hardest\_sent: grade

│   ├── sends: Send\[\] (optional)

│   │   ├── grade: string

│   │   ├── style: onsight | flash | redpoint | hang

│   │   ├── name: string (optional, outdoor)

│   │   └── photo: ref (optional)

│   └── location: string (optional, outdoor)

│

└── practice\_data: PracticeData (yoga, pilates, etc.)

    └── style: string

---

## What this spec does NOT cover (deferred)

- **Nutrition logging** — Ring 2, separate spec. Different enough to deserve its own document.  
- **Wearable import mechanics** — Garmin Connect / HealthKit / Health Connect API integration. Shapes the GPS and sleep/steps data but is an ingestion layer, not a logging surface question.  
- **Stimulus ledger mapping rules** — How specific exercises map to movement patterns and energy systems. Already exists in `core/stimulus.ts`; the exercise library tags need to align with that taxonomy.  
- **Reflect tab integration** — How logged sessions surface in the Reflect view. Phase 5\.  
- **Climbing app research** — Kaya, Crux, Toplogger, Mountain Project deep dive. Needed before finalizing climbing logging detail.  
- **Exercise library API selection** — wger vs. ExerciseDB vs. curated static dataset. Implementation decision for the build phase.  
- **Outdoor-sport integrations** — paragliding (IGC), whitewater (water levels), wing foiling (live wind gauges), MTB/GPS. Feasibility researched in `outdoor-integrations.md`. Outdoor is an identity grouping (logbook-first), not a new engine.

