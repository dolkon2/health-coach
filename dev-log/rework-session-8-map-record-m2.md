# Rework Session 8 — Map Record M2: background GPS recording + on-map save

**Date:** 2026-07-11 (overnight) · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Commits:** 12, `a10c198..99ab79f` (9 feature + 1 prep + 2 review-fix) on top of `10ac898`
**Plan:** the approved Opus plan (Session 8 Prompt A); built at xhigh effort per Dylan.
**Flag answers baked in:** ⚑1 `killServiceOnDestroy: false` (recording survives app-swipe) · ⚑2 battery-optimization prompt = yes (one-time, contextual).

## What shipped

M2 per map-tab.md §7 — "the MVP big rock":

1. **Dev-build config** (`a10c198`): expo-location plugin gains `isIosBackgroundLocationEnabled` (UIBackgroundModes location) + `isAndroidForegroundServiceEnabled`; `expo-task-manager ~13.1.6` added; **While-Using is the only permission ever requested, both platforms** (research §3). Rationale strings (WhenInUse AND the emitted Always key) both carry the honest sentence. **A new dev build is required and was built + verified on the iPhone 17 sim.**
2. **Migration 017** (`68e478a`): `recording_sessions` (recovery marker + gate drop counters) + `recording_points` (raw gated fixes with accuracy/speed for M3). **016 left reserved for routes-spec P1 (Session 9).**
3. **recordingBuffer** (`eb90002`): start/append/getFixesAfter/getBufferedPoints/getLastFix/stop/clear over the SqlDatabase port. Single-writer; seq resumes from stored max; a surviving row of either status is the recovery marker. Whole-track reads return CLEAN GeoPoints (capture metadata never leaves the buffer).
4. **Background task** (`96e9070`): `defineTask` at module scope, registered via require() so old builds degrade honestly; handler never throws; capture sanity gate (drop+count accuracy>50 m and strict ts regressions; equal-second kept; mocked kept+counted as provenance; iOS negative sentinels omitted). Root-layout side-effect import.
5. **useBackgroundRecorder** (`455c256`, hardened `dff00fe`): useGpsTracker's surface, task-based internals, async `stop()` returning the recording's stored identity + buffer-authoritative clean points. Research §2's exact options block with the two pinned trap doors (`pausesUpdatesAutomatically:false`, `killServiceOnDestroy:false` — regression tests). Re-attach on focus (live if the task still runs, recovery banner otherwise); unmount stops only the poll.
6. **On-map save flow** (`3ad98a8`, fixed `99ab79f`): live panel (elapsed / incremental distance / gate-aware GPS quality / SVG trace), Stop → SaveRecordingSheet → element dispatch through `enduranceWithRoute` / `attachSkyTrack` / `buildSessionObservation` / `createObservation` + the same fire-and-forget HealthKit export; **silent conditions freeze** fired on sheet open, folded into `payload.conditions` only when it landed. Post-save → Map pre-start + auto-dismissing toast.
7. **Recovery banner**: orphaned row → "finish the partial session" → same stop→sheet path; sub-2-fix orphans discard honestly.
8. **Import-a-track door** (`6ae560c`): pre-start affordance → parseGpx/parseIgc → the same save sheet. **log-session's importers NOT deleted — retirement is gated on physical-device verification (never-lose-access).**
9. **Battery prompt** (`06b27f9`): Android-only, fires once when a recording passes ~20 min, links to the OS battery-optimization settings list (no extra permission).

Prep (`3d52e0b`): `stampAuto`/`detectAutoSegments` moved from log-session into flightDetector — the save sheet is the second producer; one shared mapping (the extraction Session 7 flagged).

## Code review (xhigh, 10 finder angles → verify → fix)

15 findings reported; 14 fixed in `dff00fe`/`99ab79f`, 1 refuted empirically. Highlights: start()-race/idle-clobber/stuck-error state-machine bugs; the **dead "weak" GPS chip** (the 50 m gate means stored accuracies can never exceed the chip threshold — quality now derives from the drop counter); stale conditions freeze crossing tracks; save sheet relabeling a session from a drifted arm; the one-lifetime battery ask burnable unseen; the generic Always-string; per-tick O(n) summarize + un-memoized native map. Nested Modal (picker inside sheet) verified WORKING on iOS 26.4/RN 0.79 — no change.

## Verification

- `npx jest`: **123 suites / 1286 tests** green (was 120/1259). `npx tsc --noEmit`: clean, run LAST.
- **Sim smoke (iPhone 17, iOS 26.4, new dev client, real taps):** pre-start renders (MapTiler Gorge tiles, arm control, GPS READY, Record, Import door) → Record Whitewater → live panel ticking (0:39, 0.1 km, GPS good, live trace) with a simctl simulated route → Stop → save sheet (1:04 / 0.16 km / 21 points) → **Change → nested picker presents** → Kayak → Save → "Session saved." → Profile logbook shows the session with its route thumbnail → edit view: "21 points · elevation: GPS", RouteMap rendering the trace. Buffer cleared (no recovery banner).
- **NOT verifiable on sim** (→ device checklist): background continuation with screen locked, app-swipe survival, force-kill recovery, the battery prompt, real GPS noise through the gate.

## Physical-device checklist (Dylan — M2 is truly proven only here)

1. New dev build installs; the single "Allow While Using" prompt shows the honest rationale.
2. Record a walk with the **screen locked** → point count keeps growing on return.
3. Record, **swipe the app away** → iOS: recording ends; relaunch offers "finish the partial session" with everything up to the kill. (Android, when a build exists: notification persists, recording continues.)
4. Force-kill mid-recording → relaunch recovery banner hydrates the partial track.
5. (Android) recording >20 min → battery prompt fires once, never again.
6. Save outdoors → session carries a frozen weather snapshot (`payload.conditions`).
7. **Only after 1–6 pass:** retire log-session's GPX/IGC importers (the gated follow-up).

## ⚑ Flags (judgment calls made; flag-don't-reinterpret)

- **⚑ Migration numbering:** 017 claimed; **016 deliberately left free for routes (Session 9)**. 017 was edited once pre-ship (redundant index dropped) — it had only ever run on this machine's sim.
- **⚑ recordsOnMap = surface gps|sky** (⚑6 partially resolved by construction: routing follows the logging surface; indoor climb/pool swim keep the log-session door; Body → Training). Consider moving the capability into the activity registry later.
- **⚑ Sky conditions:** the silent freeze folds into gps-surface payloads only — the sky builder has no `conditions` slot today (parity with log-session). Wire it when Sky wants it.
- **⚑ Import format pairing:** GPX→Earth/Water, IGC→Sky only (the form types can't represent the cross pairings); mismatches named plainly.
- **⚑ Straggler batches:** a deferred batch delivered between clear(A) and start(B) would be attributed to B (task payloads carry no recording id). Window is tiny (stop tears the task down first); accepted, documented.
- **⚑ Recovery detection runs on Map mount/focus,** not app launch — an orphan surfaces only when Map is visited. Candidate for a root-level probe later.
- **⚑ Battery threshold ~20 min** is a tunable guess. **⚑ Untimed imports** get an ask-for-duration field in the sheet (never fabricated).
- **⚑ Reuse debt flagged, not churned:** formatDurationSec copies in log-session/GpsRecorderPanel; lazy expo-location loader ×3; file-pick pipeline ×3; Stat row styles. Fold into the standing cross-file cleanup list.
- **⚑ Play Store:** foreground-service-location **declaration** (form + demo video) is a release-time task.
- **⚑ Parallel edits observed:** during this overnight run, `planning/rework/tabs/social-tab.md` was modified and `planning/rework/research/social-expansion-{brief,plan}.md` appeared — not this session's work; left untouched and uncommitted.

## Status / handoff

- **main @ `99ab79f`**, 12 commits ahead of Session 7's close-out, NOT pushed (standing pattern). Working tree clean apart from the parallel planning-doc edits above + standing untracked files.
- Sim left on Map pre-start (Kayak armed); Metro (Session 7's, pid on 8081) still serving; simulated location cleared.
- **status-sync + Notion/Linear NOT run** (skills unavailable from this session's context) — run `status-sync` at the top of Session 9, and refresh the `project_app.md` memory pointer.
- **Ready for Session 9 (Routes entity + shelf + follow)** — routes-spec P1 claims migration 016; check the registry ends at 015+017 before numbering. M4 route-follow can now build on a real background recorder.
