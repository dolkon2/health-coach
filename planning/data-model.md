# Data Model — Spec (v0.1)

*The schema the whole product sits on. Every UI surface, every engine, every adapter ultimately reads and writes these types. This doc is the contract.*

*Companion to `claude-md`, `product-overview.md`, `correlation-engine-spec.md`.*

---

## Design principles

The data model is shaped by the constitution, not by convenience:

1. **Everything is an Observation.** Food, weigh-ins, sessions, sleep, steps, sport activities, RPE notes, photos. One record type, one timeline. The variety lives in the `kind` discriminator and the `payload`, never in parallel schemas. This is what makes the correlation engine possible — heterogeneous inputs reconciled at the type level.  
2. **Tier and fidelity are not optional.** Every Observation carries both. There is no "default tier" or "assumed fidelity." If a value comes in without them, the adapter that ingested it is buggy.  
3. **Source provenance is permanent.** Every record knows where it came from — manual entry, HealthKit, Garmin, photo estimate, food API. This is what lets fidelity be honest and lets the AI consultant ground its responses.  
4. **Time is the user's local civil day.** Stored as UTC instant \+ IANA timezone, displayed in the user's local day. A 11:30pm snack and a 12:30am snack are on different days even if they were 60 minutes apart — that's what the user means by "yesterday."  
5. **Mutations are append-only conceptually, mutable practically.** Edits create a new version with a back-pointer; the engine reads the latest. The user can undo without the integrity of past trend computations being affected. (Implementation can collapse this later; the *type* preserves it from day one.)

---

## Core types

### Observation (the universal record)

type ObservationId \= string;  // uuid v7 (time-sortable)

type Observation \= {

  id: ObservationId;

  kind: ObservationKind;       // discriminator

  occurredAt: ISOInstant;      // UTC instant the thing happened

  loggedAt: ISOInstant;        // UTC instant the user logged it (may differ)

  tz: IANATimezone;            // user's local timezone at occurrence

  tier: 1 | 2 | 3;             // see CLAUDE.md / brand-kit

  fidelity: number;            // 0..1; capture confidence

  source: ObservationSource;   // where it came from

  payload: ObservationPayload; // kind-specific data, discriminated below

  notes?: string;              // optional free-text from user

  supersedes?: ObservationId;  // edit history (this observation replaces an earlier one)

};

type ObservationKind \=

  | 'weighIn'

  | 'session'        // a training session (lift, run, ride, climb, kayak, etc.)

  | 'foodEntry'

  | 'sleep'

  | 'steps'

  | 'subjective';    // RPE, mood, soreness, energy — user-defined

type ObservationSource \=

  | { type: 'manual' }

  | { type: 'healthkit'; rawType: string }

  | { type: 'healthconnect'; rawType: string }

  | { type: 'garmin'; activityId: string }

  | { type: 'foodapi'; provider: 'nutritionix' | 'usda' | 'openfoodfacts'; itemId: string }

  | { type: 'photoestimate'; modelVersion: string }

  | { type: 'derived'; from: ObservationId\[\]; engine: string };  // computed by an engine

The `tier` field is a hard invariant: tier-1 is something the user did or measured; tier-2 is an emergent fact from many tier-1s; tier-3 is a wearable/algorithm opinion. A weigh-in is tier-1. The smoothed weight trend the engine computes from many weigh-ins is tier-2. A Whoop "recovery score" is tier-3.

The `fidelity` field is also load-bearing. Manual scale weigh-in: \~1.0. Garmin auto-detected workout: \~0.85. Photo-estimated food entry: \~0.4. Free-text "had a burrito": \~0.5. The exact numbers are tuneable per source; the *presence* is not.

---

### Payload by kind

type ObservationPayload \=

  | WeighInPayload

  | SessionPayload

  | FoodEntryPayload

  | SleepPayload

  | StepsPayload

  | SubjectivePayload;

type WeighInPayload \= {

  kind: 'weighIn';

  weightKg: number;

  bodyFatPct?: number;       // if scale measures it; tier-2 implication

};

type SessionPayload \= {

  kind: 'session';

  modality: Modality;         // gym, run, ride, climb, kayak, swim, surf, hike, hiit, mobility, other

  durationMin: number;

  // Sport-specific blocks — only the relevant ones populated.

  lifting?: LiftingBlock;

  endurance?: EnduranceBlock;

  climbing?: ClimbingBlock;

  paddling?: PaddlingBlock;

  perceivedEffort?: number;   // 1–10 RPE, optional but encouraged

  templateId?: string;        // if launched from a saved template

  benchmarkRefs?: string\[\];   // benchmarks this session was logged toward

};

type LiftingBlock \= {

  sets: Array\<{

    exercise: string;          // e.g. 'barbell back squat'

    movementPattern: MovementPattern;  // upper-push, upper-pull, hip-hinge, quad-dom, etc.

    weightKg: number;

    reps: number;

    rir?: number;              // reps in reserve, optional

    isWarmup?: boolean;

  }\>;

};

type EnduranceBlock \= {

  distanceM?: number;

  elevationGainM?: number;

  avgHr?: number;

  energySystem: 'aerobic' | 'glycolytic' | 'mixed';

  gpsPath?: GeoPoint\[\];        // if synced from device

};

type ClimbingBlock \= {

  style: 'sport' | 'trad' | 'boulder' | 'top-rope' | 'gym';

  sends: Array\<{ grade: string; attempts: number; sent: boolean; route?: string }\>;

  totalProblems?: number;      // for high-volume sessions where individual logging is impractical

};

type PaddlingBlock \= {

  discipline: 'whitewater' | 'flatwater' | 'sea' | 'sup' | 'surf-ski';

  distanceM?: number;

  gpsPath?: GeoPoint\[\];

  segmentTimes?: Array\<{ name: string; durationSec: number }\>;  // race section splits

};

type FoodEntryPayload \= {

  kind: 'foodEntry';

  description: string;         // user-visible label

  servings: number;

  kcal: number;

  proteinG: number;

  carbsG: number;

  fatG: number;

  fiberG?: number;

  alcoholG?: number;

  // Items can be expanded if it's a meal — initially we keep this flat.

};

type SleepPayload \= {

  kind: 'sleep';

  durationMin: number;

  // We trust duration. Stage breakdowns are tier-3 if present.

  stages?: { deepMin: number; remMin: number; lightMin: number; awakeMin: number };

};

type StepsPayload \= {

  kind: 'steps';

  count: number;

  // The day's total. Inserted once per civil day.

};

type SubjectivePayload \= {

  kind: 'subjective';

  metric: 'mood' | 'soreness' | 'energy' | 'stress' | 'custom';

  customLabel?: string;

  value: number;               // 1–10 by convention

};

---

### Supporting types

type ISOInstant \= string;          // ISO 8601 UTC, e.g. '2026-06-25T14:32:00Z'

type IANATimezone \= string;        // e.g. 'America/Los\_Angeles'

type GeoPoint \= { lat: number; lng: number; tsSec: number; eleM?: number };

type Modality \=

  | 'gym'            // lift-focused

  | 'run' | 'ride' | 'swim'

  | 'climb' | 'paddle' | 'surf'

  | 'hike' | 'hiit' | 'mobility'

  | 'other';

type MovementPattern \=

  | 'upper-push' | 'upper-pull'

  | 'hip-hinge' | 'quad-dom'

  | 'core' | 'carry' | 'rotation'

  | 'unilateral-leg' | 'isolation'

  | 'other';

---

## Derived types (engine outputs)

The engines (`trend`, `expenditure`, `stimulus`) produce derived facts. These are *also* Observations — kind `derived`, tier 2 — but they're surfaced through dedicated read models for the UI:

type WeightTrendPoint \= {

  date: LocalDate;             // user's local day

  trendKg: number;             // EWMA-smoothed

  rawWeighInIds: ObservationId\[\]; // provenance

  confidence: number;          // 0..1, climbs with more data

};

type ExpenditureEstimate \= {

  windowStart: LocalDate;

  windowEnd: LocalDate;

  meanIntakeKcal: number;

  trendDeltaKg: number;

  inferredTdeeKcal: number;    // residual computation

  confidence: number;

  errorBandKcal: { low: number; high: number };

};

type StimulusLedgerWeek \= {

  weekStart: LocalDate;

  byPattern: Record\<MovementPattern, { sets: number; volumeLoadKg: number }\>;

  byEnergySystem: Record\<'aerobic' | 'glycolytic' | 'mixed', { minutes: number }\>;

  sessionIds: ObservationId\[\];

};

The UI never derives these on the fly. The engine writes them; the UI reads.

---

## Benchmarks (the user's stated intent)

Benchmarks are first-class records but they're not Observations — they're user-authored goals:

type Benchmark \= {

  id: string;

  createdAt: ISOInstant;

  resolvedAt?: ISOInstant;     // when the user marked it done/abandoned/changed

  status: 'active' | 'achieved' | 'abandoned' | 'paused';

  title: string;               // user's own words, no category picker

  description?: string;

  targetDate?: LocalDate;      // optional — for race-style deadlines

  relatedModalities?: Modality\[\]; // hint to the engine; user-set

};

Active benchmarks are what Today foregrounds and what Reflect organizes around. Past benchmarks become the archive — the user's history with intent attached.

---

## Storage

For Phase 1, a local-first store on device is sufficient. The schema is small and the read patterns are simple (time-ordered queries, filters by kind, recent windows).

**Recommended:**

- **SQLite via Expo SQLite or WatermelonDB.** Schema mirrors the types above with one table per kind plus an Observations index table.  
- **Sync deferred.** Don't build cloud sync in Phase 1\. The first version is local; cloud comes when there's a second device or a friend who needs to see your hub.  
- **Migrations matter from day one.** Even a personal product accumulates 18 months of data fast. Use a real migration tool — don't hand-edit.

---

## Open questions

- **Composite meals.** Should `FoodEntryPayload` support `items: FoodEntryPayload[]` for meals built from multiple ingredients? Probably yes by Phase 2, but Phase 1 can keep it flat.  
- **Photo storage.** Where do progress photos live? Their metadata could be a `kind: 'progressPhoto'` Observation, with the image itself on the device's filesystem (path stored in payload). Decision deferred — they're a Settings feature, not phase 1\.  
- **Encryption at rest.** Personal training data is sensitive. SQLCipher or platform-native encryption (iOS Data Protection class) by default. Decide in the implementation.  
- **The Garmin/HealthKit deduplication problem.** If both are connected, a single run might come in twice. The adapter layer needs a deduplication key (source \+ provider-side ID) and a deterministic preference order. Phase 3 problem, but the type system already accommodates it via `ObservationSource`.

---

## Versioning

This document is the data contract. Changes are not casual. Bump the version, write a migration, write a changelog entry.

Schema changes propagate through: engines that consume the types → adapters that produce them → UI that reads them → storage migrations. Plan the full path before changing the shape of an Observation.  
