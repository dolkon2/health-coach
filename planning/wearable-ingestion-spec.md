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

---

## Addendum — 2026-06-30: program status, multi-vendor, native GPS, and the layered route model

*Research pass triggered by "I need a better Garmin connection than Apple Health." Three things changed since v0.1: the Garmin program is no longer a routine option, the product is no longer iOS-only in intent, and a native GPS tracker is now planned. Net effect — the route problem gets **smaller**, not bigger. This addendum supersedes v0.1's "GPS route strategy — the two-phase plan" section above; the rest of v0.1 still stands.*

> **Reframe (2026-06-30) — what a Garmin connection is actually for: logging ease, not the map.** The goal is that a run done on a Garmin auto-appears in the app with its stats and zero manual entry. **That is already delivered by Layer 0 (the OS health floor), gate-free.** Garmin Connect syncs workout *summaries* (type, duration, distance, pace, avg/max HR) one-way into both Apple Health and Health Connect; the adapter reads them and drops a session on the timeline. The blocked Garmin **direct** API was only ever needed for the *route* and the tier-3 modeled metrics — and the route is now being handled by native GPS capture (planned in a separate GPS-planning session, out of scope here). So for the actual goal, there is no "better connection" being withheld: the OS health layer is it. Two honest limits: it's **poll-on-open, not push** (the session appears next app-open, a deliberate rule-6 choice), and it's **summary-level** (a Garmin strength workout arrives as "strength training, N min" with no per-set detail — fine, since gym is the app's own rich surface). The route layers below (1–2) are therefore about *route enrichment*, not logging ease, and drop in priority accordingly now that native capture owns the route.

### What changed

**1. The Garmin Connect Developer Program is not currently a routine option.** Two blockers, both new since v0.1's "≈2 business days, free for evaluation":

- **Suspended for new applicants.** The access-request form has been pulled and new API-access requests are paused with no announced resumption date (multiple Garmin developer-forum threads, mid-2026). Existing accounts keep working; new ones can't be created. *(Unconfirmable from Garmin's own pages — they 403 automated fetches — but corroborated across several independent forum threads.)*
- **Legal-entity requirement.** Even when open, the program rejects personal-use applications: applicants must be a company, university, hospital, or research institution. This collides directly with the product's "built by me, for me" framing.

→ **Path B (Garmin direct Activity API) is off the table for now — blocked, not merely deprioritized.** Revisit only if the program reopens *and* a legal entity exists to apply under.

**2. Aggregators revisited — Open Wearables does NOT bypass the gate.** It's a self-hosted, MIT-licensed, zero-per-user-fee adapter over ~10 vendors (Whoop, Oura, Polar, Suunto, Strava, Samsung, Health Connect, Ultrahuman, Garmin; Fitbit/Coros/Xiaomi soon). But its own docs are explicit: **you still apply for each vendor's credentials directly** — it handles the OAuth/data layer, not access. So for Garmin specifically it is blocked by the same suspension. Its value is *breadth + self-hosting*, not a backdoor, and it still requires a backend. Note: its bundled "AI Health Assistant / automations" is a push/coaching surface that violates constitution rules 1/3/6 — if ever used, use it strictly as plumbing, never surfaced.

**3. Garmin is the outlier, not the norm — and the product isn't iOS-only.** Most other vendors are *more* open than Garmin (Fitbit public portal, Polar AccessLink self-serve, Oura/Withings individual-friendly). And the OS health floor exists on **both** platforms: HealthKit (iOS) + **Health Connect (Android)**. Health Connect has a first-class `ExerciseRoute` type and Samsung Health writes to it — so a Galaxy Watch user likely gets the route the way an Apple Watch user does (verify on a real device before promising it). Garmin omits the route on **both** platforms; Samsung's own direct Data SDK is partner-gated like Garmin's. So the open path is always the OS health layer, never the vendor's direct SDK.

**4. Native GPS tracking is now planned — this shrinks the whole problem.** v0.1 here, and `training-logging-spec.md`, said "the app is not building a GPS tracker, it ingests from one." **That decision is being reversed:** native recording + map is planned. Consequence: for any activity recorded *in the app*, the route is captured first-party, with no wearable dependency at all. Wearable/import routes become *enrichment* for activities recorded **elsewhere** (on the watch), not the primary source. The Garmin-route gap stops being a hole in the core loop and becomes an edge case (user ran with only their Garmin, app closed). ⚠️ This reverses a documented principle — record the decision in `training-logging-spec.md` before building.

### The layered route model (supersedes v0.1's two-phase plan)

| Layer | What it is | Gate | Platform |
| :---- | :---- | :---- | :---- |
| **0 — OS health floor** | HealthKit + Health Connect: workout summaries for every synced source; full routes for first-party watches (Apple Watch; likely Galaxy Watch) | none (on-device) | both |
| **1 — Native GPS capture** | The app records the activity itself; full route first-party | none | both (one code path) |
| **2 — Manual FIT/GPX/TCX import** | User imports a file exported from Garmin/Coros/etc; client-side parse attaches the route to the existing timeline session | none | both (one code path) |
| **3 — Direct vendor APIs** | Backend + per-vendor OAuth; *open* vendors first (Fitbit/Polar/Oura). Garmin + Samsung direct both gated — skip | backend + vendor approval | server-side |

Layers 0–2 need **no backend and no gate**, and together cover essentially every user on both platforms today. Layer 1 (native capture) is the new center of gravity; Layer 2 is the gate-free fallback for activities the app didn't record; Layer 3 is opportunistic enrichment when the backend exists — explicitly *not* starting with Garmin. Pull-not-push note: Layers 1–2 are user-initiated by nature (press record; import a file), which sits cleanly inside constitution rule 6.

### Build implications

- **Health Connect moves from "v0.1 stub" to a Layer-0 peer of HealthKit.** Still one adapter interface (`WearableSource`, `src/lib/wearable.ts`), two readers; engine stays platform-agnostic. The iOS-first sequencing holds, but Android is no longer "someday" — it's the second half of the floor.
- **FIT/GPX/TCX import is the one new gate-free, platform-agnostic deliverable** that fills the Garmin route gap — written once, covers both OSes, parses client-side (mature TS FIT/GPX parsers exist). Likely a small, self-contained pass. The Session schema's nullable `route` field already accepts the attachment.
- **Native GPS capture is its own build effort** (background location, battery, map render) — out of scope for the ingestion layer, but it changes the priority of everything above: the importer and wearable routes are no longer load-bearing for the core loop once native capture lands.
- **Tier discipline unchanged:** Garmin Body Battery, Whoop recovery, Oura readiness, Samsung scores — all tier-3, below the line.
