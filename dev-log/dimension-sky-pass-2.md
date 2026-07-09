# Dimension Sky — Pass 2 (detector + schema + ingest + USHPA ledger)

**Date:** 2026-07-08 · **Branch:** `dimension/sky` · **Worktree:** `~/Projects/health-coach-sky`
**Verification:** 627 jest tests passing, `tsc --noEmit` clean (run last). UI verified live in a browser preview (all four sky activities, conditional fields, honest fallback states, Settings/ledger navigation); full click-to-persisted-row verification was not possible in this environment — see ⚑ below.

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

- **Web-preview SQLite is broken in this worktree** (`Unable to resolve "./wa-sqlite/wa-sqlite.wasm"` from `expo-sqlite/web/worker.ts` at bundle time) — confirmed pre-existing and unrelated to this pass (the same hang reproduces on the untouched "Log weigh-in" flow). Blocks full click-to-persisted-row verification via the browser preview; storage-layer correctness is instead covered by the jest suite (`src/storage/__tests__/observations.test.ts` runs against a real SQLite backend). All prior Sky verification in this project's history has been via iOS simulator, not web — this is consistent with that.
- **Gear-picker / spot-picker / conditions-freeze UI: none exist anywhere in the app yet** (checked — zero screens use `listGear`/`listSpots`/`saveSnapshot`/etc.). `SkyBlock.gearRefs`, `spotId`, and `conditionsSnapshotId` are fully typed and wired into the ledger/build path, but nothing in the log-session UI lets a user attach gear, pick a spot, or freeze conditions yet — building those would mean inventing 2-3 new CRUD screens, well beyond "detector → schema → ingest → ledger." Deferred, not forgotten; flagging rather than reinterpreting scope.
- **Retrim nudge (`retrimStatus` in `core/src/gear.ts`) has no display surface** for the same reason — it's pure, tested logic with nothing to attach it to (a gear item's `lastTrimDate`) since gear has no edit UI.
- **The detector runs on already-thinned track points**, not the full-resolution fixes IGC/GPS capture (both `parseIgc` and `gpsTrack.summarizeTrack` only expose the post-`thinTrack` (≤4000-point) array publicly). For a flight long enough to hit that cap, the 10s-window smoothing effectively runs on sparser data than intended. Doesn't corrupt anything, just loses some boundary precision on very long flights (multi-hour XC, hours of speed-soaring). Fixing it means changing the public shape of two pre-existing, already-shipped modules (`igcImport.ts`, `gpsTrack.ts`) used by the non-Sky GPS surface too — flagged rather than risked under this pass's time budget.
- **Segment editing is v1-basic**: kind toggle (air/ground) per segment + a bulk "confirm all" action. No boundary-drag, no manual split/merge of segments. Reasonable given no prior UI pattern in this app does time-range editing; flagged as a likely next refinement once there's a real flight to look at.
- **Snow run-grouping** (`runGroupId`) was deliberately NOT built, not even as a placeholder field — per Dylan's resolved decision (research §5, flag 7).
- **WeGlide read integration** — still deferred, skipped per this pass's instructions (low priority).

## Next
Human tap-through on a real device (or a working web-SQLite setup) to confirm the full IGC-import → segment-review → save → ledger-update loop end to end — the piece this environment couldn't verify. Then: gear/spot/conditions UI (cross-dimension, not Sky-specific) unlocks the three deferred items above.
