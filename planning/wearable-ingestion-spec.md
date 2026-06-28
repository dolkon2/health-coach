# Wearable Ingestion — Spec Notes (v0.1)

*Phase 3 / Ring 2.5. Companion to `product-overview.md`, `correlation-engine-spec.md`, and `CLAUDE.md`. Locks the wearable ingestion data contract and the GPS route strategy before the build pass.*

---

## What this phase covers

Three data types ingested from the OS health layer (HealthKit / Health Connect), emitted as Observations into the existing timeline:

1. **Daily step totals** — tier-1 facts, mostly NEAT.  
2. **Sleep duration** — tier-1 facts (hours); staged sleep scores are tier-3.  
3. **Activity summaries** — completed workouts (runs, rides, hikes, swims, etc.) logged on a wearable, read as `HKWorkout` records. These become Sessions on the timeline with type, duration, distance, pace, and high/low HR.

The GPS route for activities is **not available through this phase** — that requires the Garmin direct API and a backend, addressed separately below.

---

## The three open questions, resolved

**1\. Garmin partner program — OFF the critical path for Phase 3, ON the roadmap for Phase backend.** Garmin Connect writes steps, sleep, heart rate, and workout summaries one-way into Apple Health (iOS) and Health Connect (Android) via a user-toggled setting in the Garmin app. All three Phase 3 data types arrive through the OS health layer with no gatekeeper. The Garmin Connect Developer Program is needed for two things only: GPS route data (FIT files) and proprietary modeled metrics (Body Battery, Training Load, VO2max). The modeled metrics are tier-3 and deprioritized. The GPS route is a must-have — but it requires a backend to receive webhooks, so it ships when the backend ships (see GPS Route Strategy below).

**2\. HealthKit native build — required, but a workflow cost, not a wall.** HealthKit and Health Connect both need a **custom dev client** (they do not run in Expo Go). Both have mature Expo config plugins and build cleanly on EAS — no ejecting, no manual Xcode work. The only real cost is the one-time migration off Expo Go (see Workflow Change below).

**3\. Aggregator APIs (Terra, Spike, Vital/Junction) — explicitly rejected.** Evaluated and killed for three reasons:

- **Price.** Terra starts at $399/month ($4,800/year). Vital/Junction has a $300/month floor ($3,600/year). Spike is sales-call-only, same range. All are enterprise-priced for hundreds/thousands of users. For a personal app serving a handful of Garmin users, the cost is indefensible.  
- **Privacy.** All aggregators route user health data through their servers in transit. Direct friction with the privacy constitution and the local-first architecture.  
- **Dependency.** A third-party intermediary whose terms, pricing, and reliability can change — Strava's two API crackdowns in 18 months ahead of their IPO filing are the case study. The product's structural moat is not depending on things that can be pulled out from under it.

The only aggregator worth noting is **Open Wearables** (MIT-licensed, self-hosted), which avoids the price and privacy problems but still requires backend infrastructure. Same gate as Garmin direct — deferred to the same milestone.

**Net:** auto-import of steps, sleep, and activity summaries is viable now through the OS health layer. GPS routes come later through the Garmin direct API when the backend exists.

---

## GPS route strategy — the two-phase plan

The map is a must-have for runs, rides, and hikes. Here's exactly what's available and when.

### What HealthKit gives you (Phase 3\)

- **Workout summary:** activity type, duration, distance, pace/speed, calories, high/low HR. Enough for a real session on the timeline with real stats.  
- **Apple Watch routes:** if the activity was recorded on an Apple Watch, the GPS route *does* come through HealthKit natively as `HKWorkoutRoute`. So Apple Watch users get the map in Phase 3 for free.  
- **Garmin routes:** Garmin does **not** write GPS data to Apple Health. The HealthKit pipe gives you the workout summary but strips the route. This is the specific gap.

### What closes the Garmin gap (Phase backend)

The **Garmin Connect Activity API** pushes completed activity files (FIT/GPX/TCX format) with full GPS, beat-to-beat HR, cadence, elevation, and sport-specific metrics to your webhook endpoint. Requirements:

- Developer Program approval (≈2 business days, free for evaluation).  
- OAuth 2.0 flow for user consent.  
- A backend with a webhook handler to receive the FIT file push.  
- 1–4 weeks typical integration time.

The backend is already required for Cohorts (Ring 4\) and likely for the AI consultant (Ring 3). The Garmin Activity API rides that infrastructure for free — it's not a cost paid *for* the map. Once it's live, routes attach to sessions that already exist on the timeline from the HealthKit adapter. The map appears as an enrichment, not a new feature.

### What this means for the user (your family on Garmins)

- **Phase 3:** they open the app, their run/hike/ride is there with duration, distance, pace, HR — automatically, no meddling. Fluent.  
- **Phase backend:** same thing, but now with the route on a map.

### Rejected: Strava API as a route source

Strava can provide routes, but two problems make it wrong for this product specifically:

- **AI compliance risk.** Strava prohibits using API data for AI/ML, and a May 2026 forum question about whether single-inference workflows violate the agreement got no public resolution. The entire product thesis is AI reasoning over the timeline — putting Strava-sourced activities on that timeline is exactly the gray zone they're warning about.  
- **Dependency risk.** Two API crackdowns in 18 months, a confirmed IPO filing, and new subscription requirements for developers. Building on Strava for core data is a structural bet against the product's independence.

---

## Where this sits in the build plans

- Ring 2.5, Phase 3, 4 passes (expanded from 3 to include activity reads).  
- Independent of food logging at the *ingestion* layer — adapters emit Observations into the existing timeline with no dependency on the nutrition work.  
- **But** the steps→expenditure *reveal* (NEAT isolation) depends on the expenditure engine, which is fed by food (Phase 2). Build ingestion whenever; the correlation that makes steps *mean* something waits for food to land.  
- The activity→stimulus *classification* (a run \= aerobic energy system, a hike with elevation \= aerobic \+ quad-dominant) is Phase 4 / Training tab work. Phase 3 ingests the raw session; Phase 4 classifies it into the stimulus ledger.  
- Forces the long-deferred **iOS-vs-cross-platform decision** — addressed below.

---

## The decision this forces: iOS-first vs. cross-platform now

The ingestion layer is the first place the platform split becomes concrete (HealthKit ≠ Health Connect APIs).

- The **adapter pattern absorbs most of the cost**: one normalization layer that emits Observations, two thin platform readers behind a shared interface. The engine core stays platform-agnostic TypeScript regardless.  
- Decision: **build the iOS (HealthKit) adapter first, stub the interface for Health Connect.** You're the primary user, you're on iOS, dogfooding is iOS. Your family is on iPhones with Garmins — the HealthKit path covers them. Writing the shared interface now (not the Android impl) keeps the cross-platform door open at near-zero cost. This is the "two entry states, not two products" instinct applied to platforms.

---

## Architecture: ingestion adapters that emit Observations

Nothing new in the core. The adapter is a **source**, identical in shape to a manual log — it just originates from the OS health store instead of a tap. It produces the same `Observation` records and hands them to the timeline. The engine cannot tell (and must not care) whether a step count came from a watch or a keyboard.

HealthKit / Health Connect

        ↓  (platform reader)

   raw samples \+ HKWorkout records

        ↓  (adapter / normalizer)

   Observation\[\] / Session\[\]  ← tier \+ fidelity \+ source stamped here

        ↓

   timeline (existing)

        ↓

   engines (existing)

### Tier \+ fidelity mapping

| Signal | Tier | Fidelity | Notes |
| :---- | :---- | :---- | :---- |
| Daily step total | 1 | \~0.9 | A counted fact. Mostly NEAT. |
| Sleep duration (hours) | 1 | \~0.85 | Trust the hours. |
| Staged sleep (deep/REM/light) | 3 | n/a | Modeled composite. Lives below the line. Ingest if free, never gate anything. |
| Activity summary (duration, distance, pace, HR) | 1 | \~0.9 | A logged fact from the device. Sovereign. |
| Activity GPS route (Apple Watch only in Phase 3\) | 1 | \~0.95 | GPS coordinate stream. High fidelity recorded fact. |
| Garmin Body Battery / Training Load / Recovery | 3 | n/a | Not available via HealthKit. Deferred until/unless earned. |

A tier-3 value may sit *beside* a tier-1 value; it may never overwrite or contradict it.

---

## The data contract to lock before building

### What the adapter emits

- **Steps:** one Observation per day \= daily total. `{ type: 'steps', value: <int>, date, tier: 1, fidelity: ~0.9, source }`.  
- **Sleep:** one Observation per sleep window \= total duration in hours. `{ type: 'sleep_hours', value: <float>, date, tier: 1, fidelity: ~0.85, source }`. Date-attribution rule: attribute to the **wake day** (the day the sleep ended). Document this visibly — the rule must be legible, not hidden.  
- **Activity:** one Session per completed workout. `{ type: 'activity', activityType: <string>, duration: <seconds>, distance?: <meters>, pace?: <sec/km>, hrHigh?: <int>, hrLow?: <int>, startDate, endDate, tier: 1, fidelity: ~0.9, source, route?: <coordinate[]> }`. The `route` field is populated only for Apple Watch activities in Phase 3; it's `null` for Garmin-via-HealthKit activities until the direct API ships.  
- **Staged sleep (optional):** if available and free to read, store as tier-3 alongside the tier-1 duration. `{ type: 'sleep_stages', value: { deep, light, rem, awake }, date, tier: 3, source }`. Never surfaces above the tier-1 hours in any UI or engine output.

### Source precedence / dedup

Apple Health commonly has **multiple sources writing the same metric** (iPhone pedometer \+ Apple Watch \+ Garmin Connect all writing steps). Reading naively double-counts.

- Garmin's sync to Apple Health is one-way; Apple Health prioritizes by a user-set source order, and mismatches happen when the wrong source ranks higher.  
- If Garmin device data exists for a day, it takes precedence over other sources for that same day.

**Decision:** the adapter picks a single authoritative source per metric (prefer wearable over phone — Garmin or Apple Watch over iPhone pedometer) rather than summing across sources. Use `HKStatisticsQuery` with source-grouping to enumerate and pick. Bake source-precedence into the adapter, not the engine — the engine receives one clean number per day.

For activities, dedup is simpler: `HKWorkout` records are distinct per activity. The risk is the same workout appearing from both Garmin (via Apple Health sync) and Apple Watch if both were worn simultaneously. Handle by dedup on overlapping time windows \+ activity type.

### Backfill vs. live

- **Backfill:** on first permission grant, read the trailing N months (suggest 3–6) so the cold-start baseline isn't empty. The z-score detection threshold needs enough boring history to know what boring looks like — backfill is how steps/sleep get a baseline on day one instead of day ninety.  
- **Live:** poll-on-open is sufficient for a pull-not-push product. Background delivery (`HKObserverQuery` / Health Connect background reads) is explicitly out of scope. Don't build background sync to manufacture freshness — that's the notification machine sneaking in through the data layer.

---

## Library choices

- **iOS — `@kingstinct/react-native-healthkit`.** Modern, Nitro Modules–based, TypeScript-first, Expo config-plugin install, works with EAS Build, no AppDelegate edits. Supports `HKWorkout` reads, `HKWorkoutRoute` for Apple Watch GPS, step/sleep queries, and source enumeration. Preferred over the older `react-native-health` (agencyenterprise). Note: requesting data for a permission you haven't authorized will crash — request authorization before any read hook fires.  
- **Android — `react-native-health-connect` \+ `expo-health-connect` config plugin.** Needs `expo-build-properties` with `minSdkVersion: 26`, `targetSdkVersion: 35`. Deferred until the iOS adapter is proven.

---

## Permissions / entitlements (one-time setup)

- **iOS:** enable the HealthKit capability on the bundle ID in Apple Developer Console (EAS Build auto-syncs the entitlement from the local config). Add `NSHealthShareUsageDescription`. Read permissions needed: `HKQuantityTypeIdentifierStepCount`, `HKCategoryTypeIdentifierSleepAnalysis`, `HKWorkoutType`, `HKSeriesType.workoutRoute()`. Read-only — we ingest, we don't write back.  
- **Android:** declare Health Connect read permissions (`READ_STEPS`, `READ_SLEEP`, `READ_EXERCISE`) in the manifest via the plugin. Deferred.  
- Privacy policy must disclose what's read and why (store requirement; also just the honest thing).

---

## Workflow change: Expo Go → custom dev client

The one real cost of this phase.

- Build a **dev client** with EAS (`eas build --profile development`), install on device once. After that the JS-reload loop is identical to Expo Go — the dev server still runs in its persistent tmux/screen session, remote Claude Code over tmux is unaffected.  
- The native layer only changes when you add/upgrade a native module (i.e. this phase, then rarely). Day-to-day passes stay pure-JS.  
- Practical sequencing: **do the dev-client migration as Pass 1 of this phase, before writing any adapter code.** Migrating and ingesting in the same pass muddies the git history — keep them single-concern.

---

## Pass breakdown (4 passes)

1. **Dev-client migration \+ plugin install.** EAS dev build, HealthKit config plugin \+ capability/entitlements, dev client on device, app boots and requests HealthKit authorization for steps, sleep, workouts, and workout routes. No reads yet. Commit: native foundation only.  
     
2. **HealthKit adapter — steps \+ sleep.** Shared `WearableSource` interface (`requestPermissions()`, `readSteps(range)`, `readSleep(range)`, `readActivities(range)`). HealthKit reader for steps and sleep. Normalizer that emits `steps` and `sleep_hours` Observations with tier/fidelity/source. Source-precedence dedup. Backfill of trailing history. Observations land on the timeline and render as tier-1 facts. Tests against the existing observation/timeline contract.  
     
3. **HealthKit adapter — activities.** Read `HKWorkout` records. Emit Session records with type, duration, distance, pace, HR. For Apple Watch–sourced workouts, also read `HKWorkoutRoute` and populate the route coordinate array. Garmin-via-HealthKit workouts get the summary but `route: null`. Dedup overlapping-window activities. Sessions land on the timeline beside manual sessions.  
     
4. **Wiring \+ display.** Steps, sleep, and wearable-sourced activities appear on the unified timeline beside manually logged sessions and weigh-ins. Slate styling for any tier-3 staged-sleep value per brand-kit. Route renders as a map for activities that have one (Apple Watch). Activities without a route show stats only — no empty map, no placeholder. Confirm the expenditure engine *can* consume daily steps when food data exists (forward-reference, not the reveal itself). Health Connect interface stub left in place, unimplemented.

---

## Forward references (so deferred decisions have landing places)

- **GPS routes for Garmin activities** → lands when the backend ships (pre-Ring 3 or Ring 4). Gate: apply for Garmin Connect Developer Program, implement OAuth \+ webhook handler, receive FIT files, attach route to existing timeline sessions. The Phase 3 Session schema must already have a nullable `route` field so the attachment is an enrichment, not a schema change.  
- **Activity → stimulus classification** → Phase 4 / Training tab. A run becomes "aerobic energy system"; a hike with elevation becomes "aerobic \+ quad-dominant." Phase 3 just ingests the raw activity type from HealthKit; Phase 4 maps it into the stimulus ledger.  
- **NEAT / steps→expenditure reveal** → lands in the expenditure engine after Phase 2 (food). The Observation schema this phase emits must already carry what that correlation will need (daily step total, clean source). It does.  
- **Garmin tier-3 metrics (Body Battery, Training Load, etc.)** → not available via HealthKit, not needed. Revisit only if a specific modeled signal earns its way in after dogfooding.  
- **Background sync** → explicitly out of scope; poll-on-open only. A future pass *if* the loop demands it, which it shouldn't.  
- **Health Connect / Android adapter** → interface stubbed this phase, implemented when/if cross-platform ships.  
- **Open Wearables (MIT, self-hosted)** → worth evaluating when the backend ships as an alternative to building Garmin OAuth from scratch. Same infrastructure gate, potentially less custom code.

---

## Standing risks (carry forward)

- **Background sync is the engagement knob in disguise.** "Fresh data waiting for you" is a push trigger wearing a data-layer costume. Poll-on-open keeps the product pull-only. Hold the line here the same way you hold it on notifications.  
- **Double-counting steps reads as a data-integrity bug to the one user who'll notice — you.** Source precedence isn't optional polish; get it right in Pass 2 or the mirror lies.  
- **Don't let the platform split fork the product.** One adapter interface, two readers — not two codebases. Same discipline as "fidelity flexes instead of forks."  
- **The routeless Garmin session must feel complete, not broken.** A run with stats but no map should read as "here's what happened" — not "something is missing." The map is an enrichment that arrives later, not a hole. UI design must not leave an empty map container or a "route unavailable" badge. Stats-only is the default; map is the upgrade.  
- **Strava is not a fallback.** The AI-compliance and dependency risks are structural, not temporary. If someone asks "why not just use Strava," the answer is that the product's core thesis (AI reasoning over the timeline) is exactly what Strava's terms are designed to prevent third parties from doing.
