# Calisthenics skill-ladder dataset — estimation notes

Companion to `ladders.json`. This file documents, per chain: the source of the step
ordering, the basis for each leverageFactor estimate, and where I diverged from the
task sketch (and why). Global conventions and the load/trend-math spec are at the end.

## Global conventions

- **Anchor**: `leverageFactor = 1.0` is the chain's canonical full expression (the
  movement the chain is named for), NOT necessarily the last step. Steps beyond the
  anchor (weighted, ring, one-arm, V-sit, freestanding HSPU) have factors > 1.0.
  This keeps the factor meaningful ("fraction of the named skill") and lets chains
  grow harder steps later without re-normalizing history.
- **Rep chains** follow the r/bodyweightfitness Recommended Routine (RR) scheme:
  work in 3×5–8; the advancement threshold is **3×8 with good form**, then re-enter
  the next step at 3×5. `advancement` stores the 3×8 threshold (the top of the
  band). Descriptive-by-default: these thresholds are data for opt-in prompts only.
- **Negatives** (dip, pull-up): RR treats them as rep work inside the 3×5–8 band with
  a slow (3–10 s) descent; threshold kept at 3×8. One-arm negatives and HSPU
  negatives use 3×5 — community programming for those uses low-rep slow eccentrics.
- **Static/lever chains**: threshold 3×10 s per step. Published guidance ranges from
  "3 sets of 10–15 s" to "one 15–30 s hold" before moving up; 3×10 s is the
  common-denominator community standard and the most conservative honest gate.
- **L-sit**: Antranik's rule is "accumulate 60 s per session; move up when you can
  hold ~60 s" — encoded as 3×20 s (= 60 s accumulated). V-sit gate 3×10 s.
- **leverageFactor is a difficulty multiplier, not a strict %BW** except where noted.
  For lever/planche steps it tracks published load-fraction estimates; for balance
  steps (handstand line) it is a pure difficulty heuristic — see caveat there.

## Deviation from the task sketch (flagged)

The task listed 12 chain topics with "handstand (wall → freestanding → HSPU line)"
as one chain. I split it into **handstand-line** (balance holds, duration) and
**handstand-pushup-line** (vertical pressing, reps), giving **13 chains**. Reason:
a single ladder would assert that a freestanding handstand hold is easier than a
wall HSPU (or vice versa) — false in both directions for many trainees (balance
skill and pressing strength progress independently; plenty of people have wall
HSPUs years before a 60 s freestanding handstand). One chain would not be
"community-defensible" as a monotone difficulty ordering; two chains are.

Second judgment call: the task floated "RTO support?" inside the core chain. I left
ring-turned-out support out of anti-extension — RTO support is a dip-chain/ring
support element, not an anti-extension movement. The anti-extension chain follows
the RR core triplet's anti-extension column (plank → rollouts).

Third: `loadable: true` appears on exactly two steps (weighted dip, weighted
pull-up). It is one field beyond the specified schema; consumers that ignore
unknown keys are unaffected. See load model below for its semantics.

## Per-chain basis

### pushup-line (reps; anchor = full push-up)
Ordering: RR push-up progression verbatim (wall → incline → full → diamond →
pseudo planche). Factors anchored to measured ground-reaction forces at the hands
(Ebben et al. 2011, J Strength Cond Res, PMID 21873902): regular push-up ≈ 64% BW,
hands elevated 61 cm ≈ 41% BW, 30.5 cm ≈ 55% BW. Relative to full: incline ≈
41–55/64 → **0.65** (RR incline is roughly hip-height); wall extrapolates the
incline curve to ~0.3. Diamond carries identical external load but a narrower,
triceps-dominant base → **1.15** (ordering per RR; magnitude is a judgment call).
Pseudo planche push-up shifts load forward onto the hands with straight-arm
demand → **1.5** (community places it well past diamond; consistent with planche-lean
loading being tunable from ~1.2 upward with lean angle).

### dip-line (reps; anchor = parallel bar dip)
Ordering: RR dip progression (support hold → negative dips → dips → ring dips),
with weighted dips inserted directly after bar dips (the standard barbell-gym
continuation and the task sketch's ordering). Support hold is a duration gate at
the RR's published 3×60 s (confirmed in the Boostcamp RR replica: "3 × 60 sec").
Factors: support hold **0.4** (full BW borne but zero ROM), negatives **0.7**
(eccentric-only ≈ 70–80% of full-movement difficulty — standard eccentric-first
pedagogy), weighted **1.0 + load** (see load model), ring dip **1.2**
(instability premium; RR's rings path — a rings user can skip the weighted step,
a bar user can stop before rings; both orderings are community-current).

**Loadable-step convention (applies to weighted dip and weighted pull-up):** a
loadable step's base factor deliberately EQUALS its unweighted anchor, so at
+0 kg it is the same movement — the trend line is continuous and the step only
outranks its neighbors through `effectiveLeverage` as load is added. Ladder
position for loadable steps should therefore be derived from effective leverage,
not from raw step index.

### pullup-line (reps; anchor = pull-up)
Ordering: RR pull-up progression (scapular pulls → arch hangs → negatives →
pull-ups → weighted) extended with the standard one-arm road (archer → OAP
negatives → OAP). Factors: scap pulls **0.3** / arch hangs **0.4** (partial-ROM
scapular work under full hang load), negatives **0.7** (eccentric rule), weighted
**1.0 + load**. Archer **1.4**: dominant arm takes most of BW with assisting arm
straight. One-arm: community gate for OAP attempts is a two-arm pull-up at
roughly +50% BW added; +50% BW over two arms equals ~2× BW-per-arm-equivalent →
OAP **2.0**, OAP negatives **1.8** (eccentric discount off 2.0 is small because
the eccentric IS the training movement at this level).

### row-line (reps; anchor = horizontal row)
Ordering: RR row progression (vertical → incline → horizontal → wide → archer)
plus one-arm row as the community continuation. Factors mirror the push-up
incline logic in reverse (body angle sets the load fraction): vertical **0.3**,
incline **0.6**, horizontal **1.0**. Wide **1.1** (mechanically weaker pulling
position, same load), archer **1.35**, one-arm **1.7** (near-all of the working
load on one arm, but rows tolerate more body-English than pull-ups, so < 2.0).

### squat-line (reps; anchor = bodyweight squat)
Ordering: RR squat progression verbatim (assisted → squat → split → Bulgarian
split → beginner/intermediate/advanced shrimp). Factors: assisted **0.6**
(hands take a variable fraction; midpoint estimate). Single-leg steps scale by
load-per-working-leg: split squat still shares load between legs (**1.3**),
Bulgarian puts most of BW on the front leg (**1.6**), shrimp variants are true
single-leg squats with progressively worse leverage and ROM — **1.9 / 2.2 /
2.5**. The ~2× region for full single-leg work follows from one leg carrying
what two did, with the balance/mobility premium pushing advanced shrimp past 2.
Task sketch said "pistol progressions"; the RR's shrimp line is used because it
is the community-canonical ladder (pistols need more ankle mobility and are
explicitly not in the RR). A pistol slots in at ≈ shrimp-beginner level (~1.9)
if the app ever adds it as an alias step.

### hinge-line (reps; anchor = nordic curl)
Ordering: RR hinge progression verbatim (Romanian deadlift → single-leg deadlift
→ banded nordic → nordic curl). Caveat (documented, honest): this chain mixes a
hip-hinge pattern with knee-flexion posterior-chain work — the RR groups them as
one "hinge" slot, so the ladder is community-standard, but the leverage factors
are cross-movement difficulty judgments, not load fractions: BW RDL **0.25**
(mobility/patterning step), SL RDL **0.4**, banded nordic **0.7** (band assist ≈
20–40% of torque), nordic **1.0**. If the user loads RDLs with external weight,
that is better logged as a barbell lift than as this chain's step.

### lsit-line (duration; anchor = full L-sit)
Ordering: Antranik's floor L-sit tutorial (the RR's linked resource): foot-supported
→ one-foot-supported → tuck → one-leg-extended → full, extended with V-sit per his
advanced L/V/manna page. Factors track compression + support demand: **0.3 / 0.45
/ 0.6 / 0.8 / 1.0 / 1.4**. The 0.8 for one-leg-extended reflects Antranik calling
it "the final stepping stone" with most of full difficulty. Advancement 3×20 s
encodes his accumulate-60-seconds rule; he explicitly allows any set breakdown
(6×10, 4×15, 3×20, 2×30) — the app should treat 60 s accumulated at threshold
sets as equivalent.

### front-lever-line (duration; anchor = full front lever)
Ordering: universal static-hold sequence (tuck → advanced tuck → single-leg →
straddle → full) per Antranik's statics page and every OG-style source. Factors
anchored to published load-fraction estimates: tuck ≈ **0.4** (task's own example
agrees), advanced tuck ≈ **0.65** (published "65–70% of body weight" for the
extended-knee lever arm), single-leg ≈ **0.75**, straddle ≈ **0.85**, full
**1.0**. Sources also warn the tuck→advanced-tuck→straddle jumps are big;
factors deliberately preserve those gaps rather than smoothing them.

### back-lever-line (duration; anchor = full back lever)
Same universal sequence with the German hang as entry/prep step (community
standard; also the bail-out position). Factors mirror the front-lever spacing
(**0.4 / 0.6 / 0.75 / 0.85 / 1.0**) — identical lever-arm physics, slightly
easier absolute skill (back lever is commonly reached long before front lever;
that is cross-chain information and does not affect within-chain factors).
German hang **0.2** with a 3×20 s gate (it is a loaded stretch, not a lever).

### planche-line (duration; anchor = full planche)
Ordering: lean → tuck → advanced tuck → straddle → full (GMB, Fitloop, Berg,
task sketch). Factors: tuck **0.45**, advanced tuck **0.6** ("simply the
flattening of the back" but a real lever-arm jump), straddle **0.8**, full
**1.0**. Planche lean **0.3 with a caveat**: lean difficulty is continuously
tunable by lean angle, so 0.3 represents a modest working lean; the app should
treat lean-hold seconds as the noisiest data in this dataset. Sources agree the
advanced-tuck→straddle gap is the biggest in calisthenics; the 0.2 jump encodes
that. Straddle < full because the spread legs shorten the effective lever.

### handstand-line (duration; anchor = freestanding handstand)
Ordering: back-to-wall → chest-to-wall → wall weight shifts → freestanding
(GMB handstand guide + RR skill-day practice). **Caveat: this is a balance-skill
chain — factors are difficulty heuristics, not load fractions** (every step bears
~100% of the same load; what changes is balance demand). Factors **0.5 / 0.6 /
0.75 / 1.0**. Gates: 3×30 s back-to-wall, 3×60 s chest-to-wall (the community
"2-minute wall hold before serious freestanding work" norm, split into sets),
3×30 s of controlled weight-shift work, then the chain's terminal descriptive
milestone of a 60 s freestanding hold.

### handstand-pushup-line (reps; anchor = wall HSPU, full ROM)
Ordering: pike push-up → elevated pike → wall negatives → wall HSPU → deficit
wall HSPU → freestanding HSPU (startbodyweight HSPU progression + caliskills +
Movement Athlete). Anchor choice: **wall HSPU = 1.0**, because "handstand
push-up" as a strength expression is standardly performed against a wall; the
freestanding version (**1.4**) adds the balance skill and is gated on the
handstand-line anyway. Factors: pike **0.45** (roughly push-up-like load at a
steeper angle), elevated pike **0.65**, negatives **0.85** (eccentric rule),
deficit **1.15** (added ROM ≈ added difficulty, common +10–20% estimate).

### anti-extension-line (reps; anchor = standing ab-wheel rollout)
Ordering: RR core-triplet anti-extension column: plank → rollouts, with the ring
rollout's continuous difficulty (walk feet back / lower incline) split into
kneeling → incline → standing. Plank is a duration gate at the RR's 3×30 s
(confirmed in the Boostcamp replica); rollouts use the RR core band 8–12 →
threshold 3×12. Factors: plank **0.25**, kneeling rollout **0.55**, incline ring
rollout **0.75**, standing rollout **1.0**. Standing ab-wheel is a genuinely
advanced movement; the plank→rollout jump is the RR's own, not mine.

## External load model (weighted steps)

For `loadable: true` steps the app computes a continuous effective leverage from
trend bodyweight:

```
effectiveLeverage = step.leverageFactor × (trendBW_kg + addedLoad_kg) / trendBW_kg
```

- At `addedLoad = 0` this equals the step factor exactly, so the weighted step is
  continuous with its unweighted predecessor (weighted pull-up at +0 kg == pull-up
  at 1.0). No seam in the trend.
- A +20 kg pull-up for an 80 kg user → 1.0 × 100/80 = **1.25**; the same +20 kg
  after cutting to 75 kg → **1.267**. This is the honest payoff of knowing trend
  bodyweight: the trend automatically credits (or debits) bodyweight change —
  descriptive, no judgment attached.
- Use **trend** bodyweight (the app's EWMA), never a single scale reading, or the
  leverage series inherits scale noise.
- Assisted work (band-assisted pull-ups/dips) is the mirror image:
  `leverageFactor × (trendBW − assist) / trendBW`; assistance in kg must be
  user-estimated, so mark such sets as approximate.
- Squat-line loading (vest/goblet) can use the same ratio as an approximation, but
  note leg exercises don't bear 100% BW to begin with, so the ratio slightly
  overstates the increment. Good enough for a descriptive trend; do not present it
  as %1RM.
- One-arm steps do NOT use the load model; their fixed factors already encode the
  per-limb doubling (OAP 2.0 ≈ two-arm at +100% BW-per-arm equivalence).

## Trend math: reps chains vs duration chains

- **Reps chains**: per-set score = `effectiveLeverage × reps`; session trend point =
  best set (or leverage-weighted volume `Σ lf × reps` for a volume view). Caveat:
  rep→difficulty is nonlinear (8 reps ≠ 8× one rep), so a leverage-weighted rep
  score is a descriptive ordinal trend, not work in joules. Do not convert to
  "estimated 1RM" — prescriptive-flavored and out of constitution.
- **Duration chains**: per-set score = `leverageFactor × holdSeconds`; session trend
  point = best single hold (community-standard comparison and monotone), with
  accumulated `Σ lf × seconds` as the volume view. Seconds also scale nonlinearly
  (a 20 s lever is much more than 2× a 10 s lever) — same ordinal-trend caveat.
- **Cross-metric seams** (dip: support hold → negatives; anti-extension: plank →
  rollouts; L-sit chain is pure duration so no seam): `lf × seconds` and
  `lf × reps` are not commensurable. Recommended universal scale that works across
  every chain including mixed ones: **ladder position** =
  `stepIndex + min(1, achievedThisSession / advancementThreshold)` where
  "achieved" is best-set reps or seconds against the step's own threshold. This is
  unit-free, monotone, honest about what it is (position on a community-standard
  ladder), and gives one continuous line per chain. Show raw reps/seconds on tap;
  never show the two metrics on one axis.
- Advancement thresholds are **data for opt-in prompts only** (constitution:
  descriptive by default). The RR's own re-entry rule (drop to 3×5 on the new
  step) is worth surfacing in the same opt-in prompt so users expect the dip in
  raw numbers while ladder position rises.

## Sources

- RR full text (gist mirror of the official routine): https://gist.github.com/sgup/f10f1d57e54b7876495f4bafb6d697eb
- RR canonical wiki (blocked to fetchers; cited as the routine of record): https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine
- Antranik (BWF moderator) RR page: https://antranik.org/rr/
- Boostcamp RR replica (confirms 3×60 s support hold, 3×30 s plank, 3×5–8 reps): https://www.boostcamp.app/coaches/r-bodyweightfitness/r-bodyweight-recommended-routine
- Antranik floor L-sit tutorial (steps + accumulate-60 s rule): https://antranik.org/l-sit-tutorial/
- Antranik advanced L/V-sit/manna progressions: https://antranik.org/advanced-l-v-manna-progressions/
- Antranik, progression exercises for static holds (universal tuck→adv-tuck→straddle→full sequence for FL/BL/planche): https://antranik.org/progression-exercises-for-static-holds/
- Push-up %BW loading: Ebben WP et al., "Kinetic Analysis of Several Variations of Push-Ups", J Strength Cond Res 25(10), 2011 — https://pubmed.ncbi.nlm.nih.gov/21873902/
- Front lever progression + advanced-tuck ≈65–70% load: https://cliffculture.com/training/front-lever/ and https://chunkitup.com/exercises/straddle-front-lever
- Front lever gap warnings / one-leg bridging steps: https://www.bergmovement.com/calisthenics-blog/front-lever-progressions
- Planche progression + stage difficulty: https://gmb.io/planche/ , https://fitloop.app/skills/planche , https://www.bergmovement.com/calisthenics-blog/the-lost-planche-progressions-a-different-approach-to-the-planche
- Advanced tuck planche description: https://dieringe.com/exercises/advanced-tuck-planche
- Handstand progression (wall → freestanding, hold standards): https://gmb.io/handstand/ , https://breakingmuscle.com/advancing-bodyweight-skills-proper-handstand-progressions/
- HSPU ladder (pike → elevated pike → wall negatives → wall → freestanding): http://www.startbodyweight.com/p/handstand-push-up-progression.html , https://caliskills.fit/learn/handstand-push-up-progression/ , https://themovementathlete.com/handstand-pushup-negatives-wall/
- L-sit hold standards (secondary): https://gmb.io/l-sit/

Overcoming Gravity (Steven Low) leverage orderings were used as background
community knowledge for step sequencing only — step names and orderings, no
copyrighted text reproduced.
