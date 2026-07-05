# Native GPS capture — Pass 1 (foreground live tracking)

*Branch `claude/native-gps-capture` (worktree `~/Projects/health-coach-gps`), based off the outdoor branch. Phase-3 fast-follow, blessed 2026-07-02 (gps-mapping-spec.md rung 2 / wearable-ingestion Layer 1). Built 2026-07-02.*

## What this pass ships

The GPS logging surface can now **record a route live** with the phone, not just import one from a file. On an outdoor session (Run / Ride / Hike / … — any `surface: 'gps'` activity), a **Record route** control sits beside **Import GPX file**. Tapping it asks for location permission, then live-tracks: a ticking timer, running distance, and a live route trace. **Stop & use route** attaches the recorded geometry to the session; **Discard** throws it away.

A recorded route flows through the *exact same* path a GPX import does — same `GeoPoint[]` on `endurance.gpsPath`, same `RoutePreview`, same builder — so the two converge on one "Route attached" state.

## Files

- **`src/lib/geo.ts`** (new) — pure geo primitives (`haversineM`, `elevationGainM` hysteresis, `thinTrack`) extracted so file-import and live-capture share ONE source of truth for distance / elevation / thinning and can't drift.
- **`src/lib/gpxImport.ts`** (refactor) — now draws its geo math from `geo.ts`; public API unchanged (its tests prove it).
- **`src/lib/gpsTrack.ts`** (new) — `summarizeTrack(points)` → distance / duration / elevation / start-time / thinned geometry; the capture counterpart of `parseGpx`.
- **`src/hooks/useGpsTracker.ts`** (new) — wraps `expo-location.watchPositionAsync` into start/stop/reset + status. **Lazy-loads expo-location** (like the GPX picker) so a dev build made before this pass degrades to "needs an updated build" instead of crashing. Keeps the screen awake while recording (best-effort).
- **`src/components/GpsRecorderPanel.tsx`** (new) — the record/stop UI + live stats + honest permission-denied / unavailable states.
- **`app/log-session.tsx`** — renders the panel; `applyCapturedRoute` prefills distance/duration + attaches geometry & capture provenance.
- **`src/lib/session.ts`** — the builder learns a `captureMeta` (parallel to `importMeta`): a recorded route keeps `source: manual`, earns **fidelity 0.7**, and is dated to the recording's start. The inverse restores it so edits round-trip.
- **`app.json`** — `expo-location` plugin + when-in-use permission string.

## Decisions / ⚑ flags for review

1. **Source stays `manual` (no new source type).** gps-mapping-spec § rung 2 says a live capture is a `manual` session (neither a file nor a wearable). Provenance is still recoverable: `manual` + a present `gpsPath` = a live recording (typed-only sessions have no path; imports carry `fileimport`). No core `ObservationSource` change needed. ⚑ If we later want capture *distinct* from typed-manual in queries, that's a core-type touch to bless.
2. **Fidelity 0.7.** A phone trace is measured (above a typed guess, 0.5) but drifts / drops indoors (below a file import, 0.9, and a live watch, ~0.95). Spec-aligned.
3. **Foreground-only (Pass 1).** iOS suspends JS when the app is backgrounded or the screen locks, so recording pauses if you leave the app. Mitigated by keep-awake. True **background tracking is Pass 2** (needs a background-location entitlement + battery care).
4. **Single continuous span, no pause.** Distance sums every consecutive fix. **Pause/resume** (which would split segments like a GPX `<trkseg>` and not bridge the gap) is Pass 2. Standing-still GPS drift can add a little phantom distance — acceptable at Pass-1 fidelity, refined with pause + a min-move filter later.
5. **Honest floor kept.** No permission / old build / < 2 fixes → the session just logs routeless and complete; nothing fabricated, nothing blocked.

## Verification

- **288 jest passing** (new: `geo.test.ts`, `gpsTrack.test.ts`, a session capture round-trip; the untouched-behavior `gpxImport.test.ts` + `sessionGpxImport.test.ts` prove the geo refactor is safe).
- **tsc 0 errors.**
- **Not yet run on a device.** `expo-location` is a new native module → needs a fresh dev build (same as the camera permission). On-device tap-test owed: record a short walk, confirm the trace + distance, Stop & use, save, reopen; plus the permission-denied path (deny → honest message → still log by hand).
