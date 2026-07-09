# Dimension Sky — Pass 2 (detector + schema + ingest + USHPA ledger)

**Date:** 2026-07-08 · **Branch:** `dimension/sky` · **Worktree:** `~/Projects/health-coach-sky`
**Verification:** 628 jest tests passing, `tsc --noEmit` clean (run last). UI verified live in a browser preview (all four sky activities, conditional fields, honest fallback states, Settings/ledger navigation).

**Update (same day, after web-preview SQLite fix):** the browser preview's SQLite backend was actually broken — a one-line Metro config fix (`.wasm` wasn't in Metro's default web asset extensions, so `expo-sqlite`'s web worker couldn't load) resolved it. With persistence actually working, ran a real smoke test: hand-logged a parakiting session (95 min) and a paragliding session (62 min) through the real log-session screen → both saved and appeared on Today with correct `reveal()` text → opened `/sky-ledger` and confirmed it shows exactly 1 flight / 1 hour / 1 flying day (parakiting correctly excluded from the USHPA count, the "no site" honesty note renders, the P3 comparison math is correct). This is the first real end-to-end proof of the whole pipeline (form → build → save → display → ledger), not just unit tests.
Also corrected a wrong assumption from the first verification pass: IGC/GPX file *picking* is NOT blocked by a native OS dialog — dispatching a `change` event on the underlying `<input type=file>` works fine and the picker resolves normally. The actual wall is that `expo-file-system`'s `readAsStringAsync` throws "not available on web" — confirmed this is a pre-existing gap shared with the already-shipped GPX import (reproduces identically on the Run activity's "Import GPX file"), not a Sky-specific defect. So on web, the import button, file picker, and detector wiring are all provably reachable; only the actual file-content read needs a real device build to test.

**Confirmed before starting:** the gear/spot/conditions migration-reconciliation session had already run and landed on `dimension/sky` as commit `fa53922` (category flatten + wing→paraglider rename). Migration-number renumbering across dimensions was deliberately deferred to actual merge time (per that session's own notes) — Sky's migrations continue at 013 (already used for the date-field rename), so nothing in this pass needed a new SQL migration at all: the whole SkySession schema lives in the existing generic `observations.payload` JSON column, the same way EnduranceBlock/ClimbingBlock/etc. already do.

## What landed

| Area | Files |
|---|---|
| Detector | `src/lib/flightDetector.ts` + tests — hysteresis state machine per research §3b, activity-dependent merge window |
| Schema | `core/src/observation.ts` (SkySegment/SkyGearUse/SkyBlock + `sky?` on SessionPayload), `core/src/gear.ts` (retrim fields + `retrimStatus`), `src/lib/activity.ts` (new `sky` surface + 4 activities) |
| Ingest | `src/lib/session.ts` (SessionForm.sky, build/rebuild), `app/log-session.tsx` (IGC import, live GPS via GpsRecorderPanel, segment list UI), `src/components/SessionCard.tsx` |
| Ledger | `src/lib/skyLedger.ts`, `app/sky-ledger.tsx`, `src/lib/skySegmentStats.ts`, Settings "Sky pilot" card (`ushpaNumber`/`ushpaRating`, descriptive-only) |

Three review passes (one per numbered item) surfaced and fixed real bugs before this landed:
- A boundary-overlap bug in the detector's post-roll padding (could corrupt segment indices across a quick relaunch inside the padding window) — fixed by fast-forwarding the scan past the padded region, plus a regression test.
- The altitude-departure OR-path compared two raw single GPS fixes (noise-prone); switched to the same windowed elevation average the vario calc already uses.
- Activity-switch staleness: changing activity mid-form left a stale track segmentation (detected under the old activity's merge window) and could leak a speedflying-only `ascentMode` onto a different activity's session — fixed by re-running the detector on activity switch and gating `ascentMode` at build time, not just in the UI.
- A silently-dropped bad IGC file (parses but yields <2 points) now surfaces an error instead of doing nothing.
- Settings' free-text USHPA fields were rewritten from per-keystroke persistence to local-draft-plus-Save (matching `body-profile.tsx`'s existing pattern), and the sky-activity-id list was deduplicated into one source of truth in `skyLedger.ts`.

## ⚑ Flags for review

- ~~Web-preview SQLite is broken~~ **FIXED** — added `metro.config.js` (`config.resolver.assetExts.push('wasm')`); pre-existing, unrelated to this pass, but worth fixing since it unblocks real web-preview verification for every dimension going forward, not just Sky.
- **IGC/GPX file-content reading doesn't work on web** (`expo-file-system.readAsStringAsync` throws "not available on web") — a real device build is still needed to exercise that one step; confirmed pre-existing (shared with GPX), not fixed here (would need a File-reading shim scoped beyond this pass).
- **Gear-picker / spot-picker / conditions-freeze UI: none exist anywhere in the app yet** (checked — zero screens use `listGear`/`listSpots`/`saveSnapshot`/etc.). `SkyBlock.gearRefs`, `spotId`, and `conditionsSnapshotId` are fully typed and wired into the ledger/build path, but nothing in the log-session UI lets a user attach gear, pick a spot, or freeze conditions yet — building those would mean inventing 2-3 new CRUD screens, well beyond "detector → schema → ingest → ledger." Deferred, not forgotten; flagging rather than reinterpreting scope.
- **Retrim nudge (`retrimStatus` in `core/src/gear.ts`) has no display surface** for the same reason — it's pure, tested logic with nothing to attach it to (a gear item's `lastTrimDate`) since gear has no edit UI.
- **The detector runs on already-thinned track points**, not the full-resolution fixes IGC/GPS capture (both `parseIgc` and `gpsTrack.summarizeTrack` only expose the post-`thinTrack` (≤4000-point) array publicly). For a flight long enough to hit that cap, the 10s-window smoothing effectively runs on sparser data than intended. Doesn't corrupt anything, just loses some boundary precision on very long flights (multi-hour XC, hours of speed-soaring). Fixing it means changing the public shape of two pre-existing, already-shipped modules (`igcImport.ts`, `gpsTrack.ts`) used by the non-Sky GPS surface too — flagged rather than risked under this pass's time budget.
- **Segment editing is v1-basic**: kind toggle (air/ground) per segment + a bulk "confirm all" action. No boundary-drag, no manual split/merge of segments. Reasonable given no prior UI pattern in this app does time-range editing; flagged as a likely next refinement once there's a real flight to look at.
- **Snow run-grouping** (`runGroupId`) was deliberately NOT built, not even as a placeholder field — per Dylan's resolved decision (research §5, flag 7).
- **WeGlide read integration** — still deferred, skipped per this pass's instructions (low priority).

## Next
Everything except the actual IGC/GPX file-read step is now proven live (hand-logged save → Today display → USHPA ledger, all confirmed on real data in the browser preview). A real device build would confirm the file-import step specifically. Otherwise: gear/spot/conditions UI (cross-dimension, not Sky-specific) unlocks the three deferred items above (gearRefs, spotId, retrim nudge).
