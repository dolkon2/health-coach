# Dimension: Body — Session Orientation

> Body = anything where the point is the instrument, not the terrain.
> These mostly happen indoors at fixed locations. Body never competes for map space with Earth/Sky/Water.

**Worktree:** `~/Projects/health-coach-body` (branch `dimension/body`)
**Branched from:** main @ `e68e473` (2026-07-05)

## Sports in this dimension (7)

| Sport | Surface today | Build status | Capture model | Bespoke primitives needed |
|-------|--------------|-------------|---------------|--------------------------|
| Gym | Bespoke | **Live** | Set-based | Rework: prev-set ghosting, e1RM, Strong CSV, Free Exercise DB seed |
| Calisthenics | Bespoke | Partial | Set-based | Duration set type, bodyweight+load %BW, variation-chain skill ladders |
| Yoga | Shared (Practice) | Partial | Session | Style taxonomy, reflection note, bundled 48-pose reference |
| Mobility | Shared (Practice) | Partial | Session | Body-area picker (8-10 zones), tightness/pain scale, ROM benchmark check-ins |
| Dance | Shared (Practice) | Partial | Session | Context tag (class/social/practice/rehearsal/performance), style taxonomy, corrections note |
| Breathwork | Shared (Practice) | Future | Session | WHM retention-hold stopwatch, static ~8-pattern JSON, HealthKit mindfulSession |
| PT | Bespoke | Future | Session | Pain 0-10 per body area, protocol adherence, pain-vs-load correlation view |

## Canonical spec source

The **Notion "New Training Database"** is the most up-to-date spec. Each sport page contains: tagline, peak apps + pricing, Strava gap, integrations/APIs, community-sourced user wants, concrete build path, notes. Read the Notion pages fresh at session start.

## What's already built (code on main)

### Gym surface (Live)
- `LiftingBlock[]` on `SessionPayload` — sets × reps × weight × RIR. Movement-pattern tag required.
- `useExercisePatternMemory` defaults patterns from past sessions.
- Rest timer via `expo-notifications` local notifications.
- Per-set completed-at timestamps for derived duration.
- **Missing vs Notion spec:** prev-set ghosting ("225×5 last week" visible at the rack), e1RM (Epley/Brzycki) trend per lift, weekly tonnage by muscle group, PR detection, Strong CSV import, exercise library seed from Free Exercise DB.

### Practice surface (shared by Yoga/Mobility/Dance/Breathwork)
- `PracticeBlock {style?}` → modality `mobility`. Duration + optional style tag.
- Session-ids-only, no fabricated volume. No exercise-level granularity.
- Very thin — essentially just a timer + notes.

### Climbing surface (shared code, Climbing is Earth but the set logger is Body-adjacent)
- Session-level only. No grades, no sends, no per-climb data.

### Activity registry
- `src/lib/activity.ts` — activities mapped: gym/strength/calisthenics/crossfit → gym surface, yoga/pilates/mobility/meditation/martial-arts/dance → practice surface.

### NOT built
- **Duration set type** — hold-time logging for isometrics (planche, front lever, L-sit). The gym logger only does reps×weight.
- **Bodyweight+load type** — storing added kg as a delta from bodyweight, %BW-aware.
- **Variation-chain model** — exercises linked into ordered ladders so progress renders as ONE trend across progressions with leverage weighting.
- **Body-area picker** — 8-10 zones for mobility/PT coverage tracking.
- **ROM self-test benchmarks** — user-defined tests (sit-and-reach cm, wall ankle cm) at retest cadence. Fits the benchmark system cleanly (zero new machinery).
- **WHM retention capture** — per-round hold times (tap-to-stop or manual) with best/avg trend.
- **Pain scale** — 0-10 per body area on any session + standalone flare-up entries.
- **Protocol adherence** — user-defined exercise checklist with target frequency → adherence %.
- **Static pattern library** — ~8 breathwork patterns as bundled JSON, no API needed.
- **Yoga 48-pose reference** — alexcumplido/yoga-api (MIT), self-hosted/bundled JSON + SVG illustrations.
- **Free Exercise DB** — 873 exercises, public domain (Unlicense), JSON + images. Bundle offline for gym seed.
- **Strong CSV import** — trivial parser, huge switcher-acquisition lever.
- **HealthKit writes** — `.yoga`, `.functionalStrengthTraining`, `mindfulSession` for breathwork.

## Per-sport detail

### Gym (Live — needs rework per Notion spec)
- **Prev-set ghosting** — show last session's weight×reps inline at the rack. Speed is everything.
- **e1RM trend** — Epley/Brzycki per lift, the analytics surface to beat (Alpha Progression praised for this).
- **Weekly tonnage by muscle group** — via exercise→muscle tags from Free Exercise DB.
- **PR detection** — flag new 1RM/volume PRs.
- **Strong CSV import** — parser for the biggest competitor's export format.
- **Free Exercise DB seed** — bundle offline, 873 exercises w/ muscle/equipment tags.
- **HealthKit** `.traditionalStrengthTraining` (energy/duration only; sets live in our store).

### Calisthenics (the market gap — biggest differentiator in Body)
- **Duration set type** — sets × SECONDS for isometric holds (planche, front lever, L-sit). Extends the gym set logger.
- **Bodyweight+load type** — bodyweight + added kg, ideally %BW-aware (pull from trend weight).
- **Variation-chain model** — exercises linked into ordered ladders (tuck → straddle → full). Progress renders as ONE continuous trend across variations with leverage weighting.
- **Advancement prompts** from hold-time thresholds ("3×20s advanced tuck → try straddle"). Maps perfectly onto benchmarks.
- **Free Exercise DB** filtered to equipment="body only" for the seed.
- **HealthKit** `.functionalStrengthTraining`.
- Shares the Gym surface; the ladder model is the only genuinely new schema work.

### Yoga
- **Style taxonomy** — Vinyasa, Hatha, Yin, Restorative, Ashtanga, Power, Iyengar, Kundalini, Hot, Mobility.
- **Gentle consistency view** — practice-days rhythm + style variety (matches our descriptive philosophy EXACTLY).
- **One-line reflection note** — journaling is the celebrated format in yoga culture.
- **Bundled 48-pose reference** — alexcumplido/yoga-api MIT, SVG art. Self-host the JSON, no network dependency.
- **HealthKit** `.yoga` + optional `mindfulSession` for yin/restorative.
- No-gamification = the FEATURE here. The community explicitly rejects streak pressure.

### Mobility (highest correlation payoff in Practice)
- **Body-area picker** — 8-10 zones (neck, shoulders, t-spine, lower back, hips, hamstrings, quads/hip flexors, calves/ankles), multi-select → coverage heatmap over time.
- **Tightness/pain 1-5 per area** (optional).
- **ROM self-tests as benchmark check-ins** — 3-5 user-defined tests (sit-and-reach cm, wall ankle test cm) at 4-8-week retest cadence. Zero new benchmark machinery needed.
- **HealthKit** `.flexibility` / `.cooldown` / `.preparationAndRecovery`.
- Cleanest reuse win in the DB: hip mobility this week vs flare-ups on ski/climb/run days.

### Dance (cheapest bespoke build in Practice)
- **Context tag** — class / social / practice / rehearsal / performance. Maps to HealthKit `.cardioDance` / `.socialDance`.
- **Two-level style taxonomy** — street/latin/ballroom/ballet-contemporary/fitness → salsa, bachata, hip-hop, etc.
- **Free-text corrections note** — mirrors the yoga reflection note; same UX slot.
- **Lightweight moves checklist** with learned→mastered states (optional).
- **Hours-per-style rollups** via existing benchmark engine.
- Avoid deprecated `.danceInspiredTraining`.

### Breathwork (retention time IS the metric)
- **WHM retention capture** — per-round hold times (tap-to-stop or manual) with best/avg trend. The single most-demanded feature (App Store reviews prove it).
- **Static ~8-pattern library** — box 4-4-4-4, 4-7-8, coherent 5-5, physiological sigh, WHM. One bundled JSON file, no API.
- **HealthKit** `mindfulSession` write (fills Apple Mindful Minutes ring — cheap, high perceived value) + read `heartRateVariabilitySDNN` + respiratory rate.
- **HRV caveat:** paced breathing artificially INFLATES HRV during-session. Label before/after context cautiously.
- **Retention trend** is a natural benchmark ("avg retention 90s → 2min"). Pairs with sleep/stress in Reflect.
- Skip: full animated pacer with haptics/audio (Breathwrk's moat), guided audio. A minimal scaling-circle pacer is a reasonable fast-follow, not v1.

### PT (rehab, not training — pain is the axis)
- **Pain 0-10 per body area** on any session + standalone flare-up entries.
- **User-defined protocol** = named exercise checklist with target frequency → adherence %.
- **Pain trend overlaid on training load** — the correlation view nobody consumer-side does well.
- **FDA wellness guardrail** (updated 1/2026): stay unregulated — outputs informational, non-diagnostic, no treatment claims. User records their own plan; app NEVER prescribes. This IS our constitution.
- **HealthKit** `.preparationAndRecovery` + symptom types.
- No open clinical-protocol dataset exists. Physitrack API is enterprise-gated.

## Cross-cutting primitives (shared across Body)
1. **Duration set type** — extends the gym set logger for isometric holds. Used by Calisthenics + potentially Mobility/PT.
2. **Body-area picker** — 8-10 zones. Used by Mobility + PT + potentially Dance (injury tracking).
3. **Reflection note** — free-text per-session. Used by Yoga + Dance + Breathwork.
4. **ROM/retention benchmarks** — user-defined measurement tests at retest cadence. Mobility ROM + Breathwork retention.
5. **Exercise library seed** — Free Exercise DB (public domain, 873 exercises). Used by Gym + Calisthenics.
6. **HealthKit writes** — per-sport type mapping (yoga, functionalStrength, mindfulSession, flexibility, preparationAndRecovery, cardioDance, socialDance).

## Direction from Dylan (2026-07-05)
- **Focus on tech integrations and API connections**, not visual UI. Dylan is mid-redesign with a new brand kit. Mockups are ahead of code.
- **Even Gym needs reworking.** It's Live but missing the analytics surface (e1RM, PRs, tonnage) and the exercise library seed.
- **New nav:** 5 bottom tabs — Home, Training, Map, Nutrition, Groups. Reflect/Settings/Benchmarks/Templates are tap-in.
- **Fidelity is food-specific.** Don't apply the nutrition fidelity system to training sessions.
- **Body dimension stays off the map** for privacy. Body-shared sports don't get map surfaces.
- **Constitution:** descriptive by default, prescriptive only on request. No gamification. Flag-once-then-override.

## Session isolation (2026-07-05, second check-in)
- Earth, Water, and Sky dimensions are being worked in parallel in their own worktrees/sessions. **This session only touches `~/Projects/health-coach-body` on `dimension/body`.** Do not touch main, other dimension worktrees, or their branches.

## Refinements from Dylan's second check-in (2026-07-05)
- **Gym rework is the priority build.** UI reference point is Strong (clean, exercise dropdown, ghost numbers from prior session) — Hevy is a secondary reference. **Correction (3rd check-in):** Gym and Calisthenics do NOT need one identical shared dropdown component — their datasets differ (Gym: Free Exercise DB weighted lifts, ghost = weight×reps; Calisthenics: bodyweight movements w/ variation-chain awareness, ghost = hold-time or bodyweight+load%). What IS shared is only the underlying **prev-value ghosting resolver mechanism** ("given an exercise id, look up what was logged last time") — build that once as a reusable primitive in Phase 0, but each sport keeps its own picker dataset/UI on top of it.
- **Climbing's session logger is out of scope for Body** — it's Earth-owned, bespoke, and Body should not extend or reuse it. Body is moving away from thin shared "session" frameworks toward sport-native surfaces over time (per [[project-training-database]]: "Dylan wants eventually ALL bespoke"), though this round stays scoped to the schema/integration work in this doc, not a full rewrite of the Practice surface.
- **Calisthenics has no existing skill-ladder API** (confirmed by Notion research — "No skill-ladder API exists"). Dylan gave explicit permission to research and hand-build this natively (likely transcribing r/bodyweightfitness Recommended Routine ladders per the Notion Key-integrations note) since nothing off-the-shelf covers variation-chain progressions.
- **Martial arts: dropped entirely.** Not one of the 7 Body sports — remove/deprecate its activity-registry mapping rather than fixing its modality routing.
- **Dance modality question, resolved (3rd check-in):** `Modality` (`core/src/observation.ts:37-48`) is a closed enum with no `dance` value; Dance sits in `other` alongside Wingfoil/Ski/Sail/Windsurf/Kitesurf/Snowboard/XC-ski/Skate/Paraglide. Checked downstream impact: `stimulus.ts` already labels by the specific `activity` over the coarse `modality` (display is unaffected), and `benchmark.ts`'s `sessionCount` dimension can filter by `activity?: string` directly, so a "dance sessions" benchmark doesn't need its own modality bucket. **Decision: leave Dance on `other` this round** — no build-list item needs a dedicated value, and adding one touches the core enum everywhere it's exhaustively switched on. Revisit only if Dylan wants coarse cardio/recovery-practice rollups in Reflect later (Dance is physiologically cardio, unlike the rest of the `other` grab-bag).
- **PT scope narrowed for this round:** professional-program integration (a PT gives you a program, you import it into your routine/mobility plan) is explicitly **future**, not this round. This round is native-selection only (body-area picker, pain scale, protocol adherence entered manually) — matches the Notion finding that Physitrack's API is enterprise-gated and no open protocol dataset exists.
- **Mobility + PT shared body-area picker:** confirmed correct, no changes.
- **Yoga / Dance / Breathwork:** Dylan deferred to the existing research/plan here (taxonomy + bundled JSON assets + retention capture) — no changes requested, execute as scoped above.

## Updated Phase 0 shared-primitives list (supersedes the plain 6-item cross-cutting list above)
1. HealthKit **write** capability (generic writer + per-sport type mapping)
2. Free Exercise DB seed (873 exercises, muscle/equipment tags), filtered per sport
3. Duration set type (seconds-based holds, extends `LiftingBlock.sets`)
4. Body-area picker (8-10 zones) — shared Mobility + PT
5. Reflection note (free-text) — shared Yoga + Dance + Breathwork
6. Generic CSV import utility (parse + validate) — needed for Strong import
7. Benchmark engine hookup for new dimension types (ROM, retention, tonnage, e1RM, adherence)
8. **Exercise-picker/autocomplete + prev-set ghosting resolver** (NEW — shared Gym + Calisthenics, added per this check-in)

Phase 1 stays a 4-track parallel fan-out (Gym / Calisthenics / Mobility+PT / Yoga+Dance+Breathwork), per the sequencing already presented — Gym and Calisthenics remain independent of each other aside from both touching `LiftingBlock` in `core/src/observation.ts` (one shared-file risk to manage, e.g. one agent owns that schema edit).
