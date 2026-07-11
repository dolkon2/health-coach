# GPS session recording on Expo, phone-only — research

*Rework research, 2026-07-11. Companion to `gps-mapping-spec.md` (capture ladder rung 2) and
`routes-spec.md`. Scope: what it takes to make the Map tab's Record mode real — background
continuation, permissions UX, battery, filtering, auto-pause, altitude, kill-resilience, and
honest accuracy expectations per sport.*

*Provenance: docs.expo.dev is unreachable from this environment (proxy denial), so instead of
the rendered docs this was verified against the **actual SDK 56 packages** — `expo-location@56.0.20`,
`expo-task-manager@56.0.21`, `expo-sensors@56.0.6` pulled from npm, reading the shipped
TypeScript declarations (what the docs are generated from) **and the native iOS/Android source**.
Where the source contradicts the doc comments, the source is cited — and there is one place
where it does (see § Gotchas). Battery/accuracy numbers come from vendor help docs and published
GNSS studies, labeled with confidence.*

*Note the constitution amendments this sits on: the map-nav branch's `gps-mapping-spec.md`
(2026-07-10) corrected "never runs in the background" to **background continuation of a
user-initiated recording is required, not banned** — a 4-hour flight with the phone in a pocket
must survive screen lock. Pull-only applies to *initiation*. This doc takes that as settled.*

---

## 1. Where the repo is today

- **SDK 53** (`expo ^53.0.0`, `expo-location ~18.1.6`). SDK 56 renumbers every module to match
  the SDK (`expo-location` jumps 18.x → **56.0.x**) — the AGENTS.md "Expo HAS CHANGED" warning
  is real. The recording APIs below exist in both lines, so nothing here blocks on the upgrade,
  but one new API (Motion Activity, § 6) is 56-only.
- `src/hooks/useGpsTracker.ts` is **foreground-only** `watchPositionAsync` +
  `expo-keep-awake`. It works, but it holds the screen on — which is *the* single biggest
  battery drain (per Gaia's own battery guide) — and any lock/background kills fixes. The
  routes-spec ⚑#5 already names this ceiling.
- `app.json` has the `expo-location` plugin with `locationWhenInUsePermission` only. No
  background modes, no foreground service. All the config below is plugin-level → **requires a
  new dev build** (already the project's workflow; none of this ever worked in Expo Go anyway).

## 2. The background recording stack (exact SDK 56 API)

Two-layer pattern, unchanged for years and stable in 56:

```ts
// module scope — NOT inside a component. TaskManager.defineTask "must be called in the
// global scope of your JavaScript bundle … when the application is launched in the
// background, we need to spin up your JavaScript app, run your task and then shut down".
TaskManager.defineTask<{ locations: LocationObject[] }>(RECORDING_TASK, async ({ data, error }) => {
  if (error) return;               // log it; never throw
  await appendFixesToDb(data.locations);   // § 8 — persist immediately, not in React state
});

// user taps Record (foreground, pull-only):
await Location.startLocationUpdatesAsync(RECORDING_TASK, {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 5,                    // meters; both platforms
  timeInterval: 2000,                     // ms; ANDROID ONLY — iOS ignores it (typings say so)
  deferredUpdatesInterval: 5000,          // batch delivery to JS every ~5 s in background
  deferredUpdatesDistance: 25,
  pausesUpdatesAutomatically: false,      // MUST be explicit — see § Gotchas
  activityType: Location.ActivityType.Fitness,  // or .Airborne for Sky (iOS falls back to Other if unsupported)
  showsBackgroundLocationIndicator: true, // iOS status pill; honesty-friendly
  foregroundService: {                    // Android: this is what makes it survive lock/background
    notificationTitle: 'Recording session',
    notificationBody: 'GPS is on until you stop the session.',
    killServiceOnDestroy: false,          // ⚑ see § 8
  },
});
// stop: Location.stopLocationUpdatesAsync(RECORDING_TASK)
// resume check on cold start: Location.hasStartedLocationUpdatesAsync(RECORDING_TASK)
```

`LocationObjectCoords` carries everything filtering needs: `accuracy` (uncertainty radius, m),
`altitude` (m above WGS 84 ellipsoid), `altitudeAccuracy` (m), `speed` (m/s), `heading` (deg),
plus `mocked` on Android. Keep `accuracy`/`speed` at capture even though `GeoPoint` doesn't
store them — the filter (§ 5) wants them; decide there whether to widen `GeoPoint` or filter
before mapping.

**Accuracy enum** (exact values): `Lowest`(~3 km) / `Low`(~1 km) / `Balanced`(~100 m) /
`High`(~10 m) / `Highest` / `BestForNavigation` ("uses additional sensor data to facilitate
navigation apps"). For recording, anything below `High` is useless; the GPS chip cost of
`BestForNavigation` over `High` is small once the radio is on. **Decision (obvious call):**
`BestForNavigation` while recording, exactly as `useGpsTracker` already does.

## 3. Permissions — the big finding: "While Using" is enough on both platforms

Read straight from the SDK 56 native source, this is the most consequential fact for UX:

- **Android** (`LocationModule.kt:315-333`): `startLocationUpdatesAsync` with a
  `foregroundService` option checks **only foreground (while-in-use) permission**. The comment
  in the source: *"As a user-initiated foreground service with notification, this does NOT
  require the background location permission."* `ACCESS_BACKGROUND_LOCATION` — with its
  "Allow all the time" settings-page detour on Android 11+ and the heavyweight Play Store
  background-location review — is **never needed** for our use case. What is needed:
  `isAndroidForegroundServiceEnabled: true` in the plugin (adds `FOREGROUND_SERVICE` +
  `FOREGROUND_SERVICE_LOCATION`), and the service can only be *started* while the app is
  foregrounded (`ForegroundServiceStartNotAllowedException` otherwise) — which is exactly our
  pull-only model: the user is looking at the Record button when it starts.
- **iOS** (`LocationModule.swift:227-239`): same story — only foreground permission is checked,
  plus `UIBackgroundModes: location` must be present (`isIosBackgroundLocationEnabled: true` in
  the plugin). The task consumer sets `allowsBackgroundLocationUpdates = YES` unconditionally
  (`EXLocationTaskConsumer.m:52`). A When-In-Use app that starts updates in the foreground keeps
  receiving them in the background; iOS shows the blue pill/indicator while it does.

So the permission UX is one prompt, once: "Allow While Using the App." No "Always" upgrade
prompt, no settings-page trip, no scary "this app can always see your location" state. This is
both the easiest and the most constitution-aligned outcome — the app *cannot* see location
except during a session the user started. Put that sentence in the permission rationale string.

Remaining store friction, honestly: Google Play requires a **declaration** (not the full
background review) for foreground-service-location use; budget a day for the form + a demo
video at submission time. *(Confidence: high on the API facts — read from source; medium on
current Play form details, which shift yearly.)*

**Config to add** (plugin props verified in `plugin/build/withLocation.d.ts`):
`locationWhenInUsePermission` (have it), `isIosBackgroundLocationEnabled: true`,
`isAndroidForegroundServiceEnabled: true`, optional `androidForegroundServiceIcon` (96×96 white
PNG — brand-kit-gorge asset, token-migration mechanics only, don't finalize the visual now).

## 4. Gotchas found in the source (would have cost us days)

1. **`pausesUpdatesAutomatically` docs say default `false`; the iOS native default is `true`**
   (`EXLocationTaskConsumer.m:73`: `defaultValue:true`). Apple's automatic pause powers down
   GPS when it thinks you've stopped and *does not resume until significant movement* — the
   classic "stopped for lunch, lost the rest of the hike" bug. **Always pass
   `pausesUpdatesAutomatically: false` explicitly.** (Worth an upstream issue, too.)
2. **"Deferred updates" are Expo's own batching, not the OS's.** Apple deprecated native
   deferral in iOS 13; expo-location implements it itself — fixes are buffered natively and
   delivered to the JS task only when *both* `deferredUpdatesInterval` and
   `deferredUpdatesDistance` are exceeded (`EXLocationTaskConsumer.m:145-161`; same logic on
   Android). Consequence: **it saves JS wakeups/CPU, not GPS chip power.** The chip samples at
   full rate regardless. Still worth setting (~5 s / 25 m) — waking the JS VM every second for
   hours is real battery — but don't expect watch-class endurance from it.
3. **`timeInterval` is Android-only** (typings: `@platform android`). On iOS at
   `BestForNavigation` you get roughly 1 Hz at CLLocationManager's discretion; pacing is done
   with `distanceInterval`.
4. **Android service restart semantics:** `onStartCommand` returns `START_REDELIVER_INTENT`
   and `onTaskRemoved` only stops the service when `killServiceOnDestroy` is set — i.e. by
   default the notification + recording **survive the user swiping the app away**, and the OS
   redelivers the intent if it kills the service under pressure. The task then runs headless
   (that's why `defineTask` must be at module scope). Historic Expo issues (#15604 etc.) about
   the service dying with the app were fixed by exactly this path; treat OEM battery killers as
   the remaining risk (§ 8).

## 5. Accuracy filtering — store raw, derive clean

Constitution fit first: the recorded fixes are the tier-1 fact; cleaning is a derivation.
**Decision (obvious call): persist every fix that passes a minimal sanity gate; run display/
stats filtering at read time, documented, not by silently discarding data at capture.** Storage
is a non-issue: ~60-80 bytes/point → a 4 h session at 1 Hz is ~14k points ≈ 1 MB JSON.

Recommended pipeline (all thresholds tunable constants with the error band in a comment, per
CLAUDE.md conventions):

1. **Sanity gate at capture** (drop, but count): `accuracy > 50 m` (cold-start garbage, urban
   canyon multipath), `timestamp` regressions, and on Android `mocked === true` → tag the
   session, don't silently accept. *(Error band: a 50 m gate keeps ≥95% of legitimate fixes in
   open terrain; in deep forest it can drop 10-30% of fixes — acceptable, the survivors are the
   trustworthy ones.)*
2. **Speed-spike gate at derivation:** reject implied point-to-point speeds above a per-sport
   ceiling (hike 3 m/s, run 7 m/s, ride 25 m/s, paraglide 30 m/s ground speed, kayak 8 m/s).
   This kills the "teleport" fixes that inflate distance.
3. **Optional light smoothing:** a simple 1-D Kalman per axis (process noise scaled by reported
   `accuracy`, the well-known single-state variant) or even a 3-5 point median filter. This is
   polish, not MVP — Strava does most of its cleaning server-side after upload, which validates
   the store-raw-derive-clean order.

**Distance honesty:** GPS noise on slow, twisty movement systematically *inflates* distance
(zigzag around the true line), while sparse sampling on switchbacks *cuts corners*. Net error
on a forest hike: **±2-10% distance** is normal; on an open-sky run **±1-3%**. Show distance
without pretending to more precision than that. *(Confidence: medium-high; consistent with
published smartphone-GNSS studies and every vendor's support forum.)*

## 6. Auto-pause — recommend post-hoc, not live

Strava's split: rides auto-pause on GPS speed, runs on the accelerometer; and when auto-pause
is off they compute moving-time **server-side from the track after upload**. That second path
is the right one here:

**Decision (obvious call): no live auto-pause at MVP. Record everything; derive
`movingTimeSec` vs `elapsedTimeSec` from the stored track (speed below threshold for >N s =
paused) and show both.** Reasons: (a) it's the mirror — record what happened, derive the
reading, never destroy data on a mid-run guess; (b) live auto-pause is the #1 support-ticket
generator in every tracking app (Strava has two help pages on it misfiring); (c) it's strictly
less engineering. A live pause indicator can come later if the derived numbers prove reliable.

SDK 56 note: expo-location 56 adds a **Motion Activity API** (`getMotionActivityAsync` /
`watchMotionActivityAsync`, mapping to `CMMotionActivity` / Play Services activity recognition,
with `stationary`/`walking`/`running`/`cycling`/`automotive` + confidence). Tempting for pause
detection, but the typings state **foreground-only** ("updates pause when the app is
backgrounded"), which disqualifies it for the pocket-phone case. Useful later for a foreground
"looks like you stopped" hint, and it needs its own permission (`ACTIVITY_RECOGNITION` /
`NSMotionUsageDescription`) — don't spend permission-prompt budget on it at MVP.

## 7. Altitude — the phone barometer is real; use it

`gps-mapping-spec.md` assumes phone capture has "no barometric altimeter." That's wrong for a
large share of devices: iPhone 6-onward and most mid/upper Androids carry one, and
`expo-sensors` exposes it (`Barometer.isAvailableAsync()`, `addListener` →
`{ pressure /* hPa */, relativeAltitude /* m, iOS only */, timestamp }`).

- **GPS altitude is bad:** vertical error is typically 1.5-3× horizontal — **±10-20 m** even
  in open sky, worse under canopy. Summing raw GPS elevation deltas produces garbage gain
  numbers (hundreds of phantom meters per hour of noise).
- **Barometer is precise but drifts:** relative precision ~±1 m short-term; weather drift is
  ~8.5 m per hPa near sea level, so a moving front can walk absolute altitude by tens of meters
  over hours. Classic fix (what varios and Garmin do): **baro for shape, GPS (or a known start
  elevation / DEM) for anchor** — slow-correct the baro baseline toward smoothed GPS altitude.
- **Recommendation:** MVP records GPS `altitude` + `altitudeAccuracy` per point (already the
  `eleM`/`eleSource: 'gps'` shape in `useGpsTracker`), and computes **elevation gain only after
  smoothing with a hysteresis threshold (ignore reversals < ~3 m)** — label the band. Baro
  fusion is a fast-follow: sample at ~1 Hz while recording, store as a parallel series with
  `eleSource: 'baro'`; it keeps flowing in background because the location background mode keeps
  the app alive, but that interaction is **unverified — test it in the first spike** before
  promising baro profiles. DEM lookup (open question #3 in gps-mapping-spec) stays the answer
  for *plotted* routes; it's not needed for live capture when a baro or GPS trace exists.
  *(Error bands: smoothed-GPS gain ±10-25% on rolling terrain; baro-fused gain ±3-5%. Label
  whichever path produced the number.)*

## 8. Resilience across kills — design for it, admit the iOS limit

The task handler must treat **SQLite as the recording, React state as a cache**: append each
batch to a `recording_points` table (or misc-store rows) keyed by a recording id, with a
`recording_active` marker. Then:

- **Backgrounded / screen locked:** covered by § 2-3. This is the normal case and must be
  bulletproof.
- **OS kills the app under memory pressure:** Android — service holds the process via
  `START_REDELIVER_INTENT` + headless JS; iOS — background location keeps the app scheduled;
  in both cases batches keep landing in SQLite. On next UI launch, if
  `hasStartedLocationUpdatesAsync(RECORDING_TASK)` and `recording_active` → rehydrate the live
  panel from the table. Data loss: at most one undelivered deferred batch (~5 s / 25 m).
- **User swipe-kills the app mid-recording:** Android with `killServiceOnDestroy: false`, the
  notification and recording **keep running** (the notification is the honest tell, and tapping
  Stop in the reopened app ends it). iOS: **the recording dies, full stop** — a user-terminated
  app is not relaunched for standard location updates (only significant-change/geofence
  triggers relaunch apps, and expo-location doesn't wire a resurrection path). Mitigation:
  everything up to the kill is already in SQLite, so the app offers "finish the partial
  session" on next launch. That's the honest floor — say it in the UI, don't pretend.
  ⚑ **killServiceOnDestroy is genuinely contestable:** `false` protects a 3-hour flight from a
  habitual app-swipe (with a visible notification as consent surface); `true` treats swipe-kill
  as "stop everything." Strava/Gaia behave like `false`. Recommend `false`, but this is a
  user-values call about what a swipe means — Dylan should confirm.
- **Device reboot / battery death:** recording does not resume on either platform (expo-location
  has no boot-restart path). Partial session recovery from SQLite applies.
- **OEM battery killers** (Samsung/Xiaomi/OnePlus aggressive "optimization" — the
  dontkillmyapp.com problem): the foreground service mostly protects us, but long recordings on
  those devices can still get starved (Expo issue #14076's "stops after 5-10 min" reports are
  this class). Mitigation: request battery-optimization exemption **contextually, once, when the
  user starts their first long recording** — that's data-said-something timing, not engagement
  theater. Can't be fully solved in-app; document it.

## 9. Battery strategy + realistic per-sport accuracy

**Battery reality:** Gaia's own docs put tracking at **~2-5%/hour** with the screen off;
phone-recorded Strava sessions land in the same band (~4-8%/h, anecdotal). Screen-on is the
dominant cost — meaning the current keep-awake foreground recorder is the *worst* battery
configuration; **background continuation is itself the battery fix.** Ladder of wins, in order:
screen off (background mode) → deferred batching (§ 4.2) → don't render the live map while
backgrounded (trivially true) → user-facing tip: airplane mode works, GPS is receive-only
(worth a line in the Record UI help). Adaptive sampling (dropping to `Balanced` at low speed)
saves little once the chip is hot and risks the § Gotchas pause bug class — skip it at MVP.
*(Error band on all battery numbers: ±half of themselves; device, sky view, and OS version
dominate.)*

| Sport | Horizontal accuracy (typical) | The honest caveats |
| :--- | :--- | :--- |
| **Hike (Earth)** | Open trail **2-5 m** median; forest/canyon **5-30 m**, 2-6× degradation per canopy studies | Distance ±2-10% (§ 5); elevation gain needs smoothing or it's fiction; switchback corner-cutting at sparse sampling |
| **Paraglide (Sky)** | **3-5 m** — open sky is GNSS heaven; speeds no problem at 1 Hz | Vertical is the story: GPS ±10-20 m makes climb rate garbage — baro (§ 7) or accept altitude-shape-only; this is a *logger*, not a flight instrument — the vario/XCTrack stays the in-flight tool, IGC import (outdoor-integrations.md) stays the high-fidelity path |
| **Kayak (Water)** | Open water **3-5 m**; gorge walls degrade like urban canyons (10-20 m) | Phone in a dry bag/case: negligible GNSS attenuation, but touch UX is gone — recording must need zero mid-session interaction; low speeds + drift make moving-time thresholds sport-specific (§ 6) |

*(Confidence: horizontal figures high — multiple published smartphone-GNSS studies, median
open-sky 0.9-3.4 m on recent flagships, the classic 4.9 m open-sky figure as the conservative
quote; vertical and per-sport caveats medium — practitioner consensus more than papers.)*

## 10. What Strava and Gaia do on-phone (pattern check)

Both: user-initiated foreground-service/background-mode recording at ~1 s granularity;
While-Using-grade permission; visible persistent notification (Android); survive lock and
app-switch; do **not** survive iOS swipe-kill (both warn about it in support docs). Strava
filters + computes moving time largely server-side; Gaia exposes power-saving toggles and a
~2-5%/h tracking cost. Nothing in this doc invents beyond what those two already normalize —
the only divergences are constitution-driven: no live auto-pause verdicts, no mid-run coaching,
raw-first storage.

## 11. Recommendations (build-ready summary)

1. **Adopt the two-layer stack** (§ 2) with the exact options block shown — especially
   `pausesUpdatesAutomatically: false`. Keep `useGpsTracker`'s API surface; swap its internals
   to task-based recording so `GpsRecorderPanel` barely changes.
2. **Permissions:** While-Using only, forever, on both platforms (§ 3). Plugin config: add
   `isIosBackgroundLocationEnabled` + `isAndroidForegroundServiceEnabled`; new dev build.
3. **Persist in the task handler to SQLite; derive everything else** (§ 5, § 8). Raw fixes are
   tier-1; filtered distance/gain/moving-time are derivations with documented bands.
4. **No live auto-pause; derive moving vs elapsed post-hoc** (§ 6).
5. **Elevation:** smoothed GPS + hysteresis at MVP, honest band; baro fusion fast-follow after
   a background-delivery spike (§ 7). Correct gps-mapping-spec's "no barometric altimeter" line.
6. **Kill-resilience:** resume-from-SQLite on relaunch; Android survives swipe-kill
   (⚑ `killServiceOnDestroy` below); iOS swipe-kill honestly ends the recording with partial
   recovery.

**Flags for Dylan:**
- ⚑ **`killServiceOnDestroy: false` vs `true`** (§ 8) — does swiping the app away mean "stop
  recording"? Recommend `false` (industry norm, notification stays visible), but it's a values
  call.
- ⚑ **Battery-optimization exemption prompt** (§ 8) — contextual one-time ask on first long
  recording is the proposed shape; confirm it clears the pull-not-push bar (it fires because
  the user started a long recording, not because "it's been a while" — I read it as compliant,
  but it is a prompt the user didn't explicitly summon).
- ⚑ **Doc correction wanted:** gps-mapping-spec § Map display layer says phone capture has "no
  barometric altimeter" — should be amended to "GPS-only elevation unless the device has a
  barometer (most do); DEM remains the source for plotted routes."
