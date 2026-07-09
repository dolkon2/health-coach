# Dimension Sky — Pass 3 (XC-segmentation redesign)

**Date:** 2026-07-08/09 · **Branch:** `dimension/sky` · **Worktree:** `~/Projects/health-coach-sky`
**Verification:** 640 jest tests passing, `tsc --noEmit` clean (run last). Exercised live in a browser preview via a temporary test hook exposing the real form-mutation functions (`attachSkyTrack`, `checkForLanding`, `confirmSkySegments`, `pickActivity`) — not just unit tests — then removed before committing.

## Resolved: the open XC-segmentation flag from Pass 2

Pass 2 shipped with one open flag: Dylan's real XC paraglide flight (2141–3373 m) segmented into 4 air segments (11:00 / 1:36:34 / 23:42 / 30:07) instead of the single continuous flight he flew. **Dylan confirmed (2026-07-08) it was genuinely one flight** — the detector over-split it. His read: this isn't a threshold-tuning problem. Ground-contact/hysteresis segmentation is the wrong *model* for XC/thermal, speedfly, and parakite tracks, where a long calm glide or a low save can look like "on the ground" without the pilot ever landing. It's a good fit only for Hike & Fly, which has a genuine hike-then-fly mode switch to detect.

## What changed

- **`flightDetector.ts`**: new `autoSegmentsRunFor(activity)` — a `Record<SkyDetectorActivity, boolean>` capability table (true only for `hikeAndFly`), matching the existing `MERGE_GROUND_GAP_SEC_BY_ACTIVITY` pattern so a 5th sky activity can't be added without an explicit decision. `autoSegmentsForActivity(points, activity, opts)` gates on it: Hike & Fly still runs the real hysteresis detector; paragliding/speedflying/parakiting default to `singleContinuousSegment` — one `kind: 'air'` segment spanning the whole track, no auto-splitting.
- **`log-session.tsx`**: `detectAutoSegments` (the shared helper both track-attach and activity-switch call) now routes through `autoSegmentsForActivity`. A new **"Check for a landing"** button in the Segments header is the manual escape hatch for the three gated activities — it runs the real `detectFlightSegments` on demand, for the rare session with an actual top-landing or relaunch. The app proposes, never silently asserts: nothing auto-splits unless the pilot asks.

## Two regressions found and fixed during `/code-review high` (before commit)

A 6-angle parallel review (line-by-line, removed-behavior, cross-file trace, language/wrapper, reuse/simplification/efficiency, altitude/conventions) plus 2 targeted verifier passes surfaced two real bugs in the first draft, both independently confirmed by 2–3 agents each:

1. **`pickActivity` silently discarded reviewed segments.** It unconditionally re-ran `detectAutoSegments` on every activity tile tap — including re-tapping the *currently-selected* activity (reachable via "Change activity", which shows all tiles including the current one). A pilot who ran "Check for a landing", reviewed, and confirmed a real 3-segment split, then re-tapped the same activity by mistake, would silently lose that work back to the single-segment default. **Fixed**: the sky-segment recompute is now guarded on `a.id !== f.activity` — a genuine activity change still re-derives (matching the pre-existing, understood behavior: a different activity's merge window really does mean different segmentation), but a same-activity re-pick is now a no-op. Verified live: re-picking the same activity after confirming a 3-segment split now leaves it untouched; switching to a genuinely different activity still re-derives fresh defaults, as intended.
2. **"Check for a landing" had no way to protect its own output.** The button stayed visible and clickable after the user confirmed or edited segments, and pressing it again would silently overwrite `userConfirmed`/`userEdited` work with a fresh detector run — violating `SkySegment.provenance`'s own documented invariant ("never silently re-overwritten by a later re-run of the detector," `core/src/observation.ts`). **Fixed**: the button's visibility now also requires every segment still be `provenance: 'auto'` (mirroring the sibling "Confirm all" button's existing provenance-based visibility pattern) — it disappears the moment there's real review work on the form to protect. Verified live: after "Confirm all", the button is gone.

Also extracted a shared `stampAuto()` mapper so `detectAutoSegments` and `checkForLanding` can't drift on how a raw detection becomes a `SkySegment[]` (there were two hand-rolled copies before).

## ⚑ Flag — USHPA ledger airtime may include ground time by default (not fixed, by design)

For paragliding/speedflying/parakiting, the single-continuous default means the *entire* track — including any ground time captured before takeoff or after landing (taxiing to launch, packing up) — counts as "air" time until the pilot reviews via "Check for a landing" or edits a segment. `totalAirtimeSec` (`skySegmentStats.ts`) sums only `kind: 'air'` segments, and paragliding (`'xc'`) is one of only two `DEFAULT_COUNTED_STYLES` toward the official USHPA cumulative-hours total (`core/src/ushpaLedger.ts`). Nothing trims a track to its actual liftoff/landing bounds today (`GpsRecorderPanel`/`igcImport` capture raw start-to-stop). Verified this is real, not hypothetical.

**Deliberately not code-fixed.** Any automatic trim would need to re-introduce some form of ground-contact detection — exactly the model Dylan just rejected for these activities, and re-litigating it here would be reinterpreting his decision rather than implementing it. The honest floor is what shipped: the single segment is visibly labeled "· proposed" (an unconfirmed proposal, not asserted fact) and "Check for a landing" is right there to get a real answer. Flagging so the ledger's precision limits are known, not silently reinterpreted into a heavier fix.

## Also updated
- `core/src/observation.ts`'s `SkyBlock` doc comment (parakiting no longer *defaults* to holding many segments — it still *can*, via a manual check, but that's no longer the out-of-the-box shape).
- `pickActivity`'s inline comment (was describing "re-run the detector" as universal; now notes the gate).

## Next
The manual-check escape hatch is basic (kind toggle + confirm, no boundary-drag/split) — same as flagged in Pass 2, still true, still reasonable to defer. Otherwise: the cosmetic RoutePreview/RouteMap double-render (Pass 2 flag) and gear/spot/conditions UI remain the open items.
