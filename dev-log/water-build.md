# Water Dimension Build — 2026-07-05 (overnight, Fable ultra)

**Branch `dimension/water`, PUSHED. 662 jest (baseline 485), tsc 0, tree clean.**
Contract: `planning/water-build-contract.md` (v1.1). Orientation: `planning/dimension-water-session.md`.

## What got built

**Conditions freeze (the dimension's defining feature)**
- USGS OGC adapter (`core/src/conditions/usgs.ts` + `src/lib/conditions/usgsClient.ts`) — built on the NEW `api.waterdata.usgs.gov` API (legacy dies Q1 2027 ✓). Latest reading + 6h trend (rising/falling/steady) + site search by name/bbox. **Backdate-correct:** a session logged later fetches the gauge *for the session time* (bounded-interval historical path, live-verified against the real API). Manual gauge entry fallback for ungauged creeks.
- Open-Meteo wind adapter (`core/src/conditions/openMeteo.ts` + `openMeteoClient.ts`) — knots, unixtime/UTC, model-tagged source (forecast vs archive never mixed), backdate-correct incl. the 90-day cutover. Manual wind fallback. Exact-72h precip context for whitewater.
- Both freeze **immutable snapshots at save**; a failed fetch = absent, never stale, never fabricated.

**Gear / Kit / Spot (migration 010)**
- `GearItem` (thin base + per-category spec: kayak boat-only per your call; wing/kite/parawing sizeM2; board volume/length; foil area/mast). Retire-only — no hard delete, sessions keep refs.
- `Kit` = named combo ("light-wind setup"); picking one expands gearIds + records kitId provenance; hand-toggling gear drops kitId (honest).
- `Spot` = river-section (home gauge picked once per river) or launch (coords for wind fetch).

**Payload blocks** — `WhitewaterBlock` (river/section/spot, gauge snapshot, class I–VI incl. 'IV-V' free text, boat, temp, hazards private-first, swims/rolls, precip72h) and `WindBlock` (spot, **sessionStyle downwind|back-and-forth + landing spot** per your 4ce9898 commit, wind snapshot, kit/gear, note) ride alongside the endurance GPS envelope on the gps surface. `parawing` added to the registry. No migration needed (payload is JSON).

**HealthKit workout ingestion** — `readActivities` stub is real now: water types (swim/paddle/sail/surf), eager route reads, per-length pool-swim rows (stroke style, stroke counts, **yard-pool yd→m conversion**), UUID-keyed dedup (two same-day sessions fine), 7-day poll window, fidelity 0.95 (device-recorded rung). Open-water swims dropped per scope. JS-only — **no dev-client rebuild needed**; one-shot re-permission nudge for already-connected users.

**Derivations (pure, computed never stored)** — swim set clustering (15s rest gap), SWOLF, pace/100 (kickboard excluded); `findSimilarWindSessions` — the freeze+quiver join answering "what did I ride last time in these conditions?", descriptive only.

**Form wiring** — barebones sections (your redesign supersedes): spot pickers with inline creation + USGS gauge search, fetch-once-then-immutable snapshots, manual fallbacks, kit/boat pickers. Edit path round-trips every frozen field byte-identically (tested).

## Adversarial review (5 finder lenses → 3-refuter majority verification)

Confirmed and FIXED:
1. Stale wind/whitewater draft leaked onto other activities after a switch → blocks gated on activity id.
2. GPX-imported backdated sessions froze *today's* conditions → session time now derives from the route start.
3. Re-picking a spot kept the previous river's frozen gauge → draft snapshots invalidate on re-pick (saved ones stay locked).
4. Precip civil-day buckets miscounted every evening session → exact 72 hourly UTC buckets.
5. In-flight fetch could overwrite a manual reading → seq guards; the user's action always wins.
Also fixed from my triage of the interrupted findings: workout read failure no longer kills steps/sleep ingestion; measured distances no longer corrupt ~10m on every edit (endurance + swim).

**Note:** the verify stage ran out of Fable usage credits partway (80 agents deep). 5 findings were machine-verified before the cutoff; I triaged the remaining ~15 by hand — fixed the 3 real ones above, the rest are flagged below or were noise.

## ⚑ Flags for Dylan

1. **⚠️ MIGRATION COLLISION — CONFIRMED, not hypothetical.** Water claimed M010 (gear/kits/spots). The **Sky session ALSO shipped an M010 (its own gear entity), M011 (spot), and its own Open-Meteo conditions module** on `dimension/sky`. The migrations bookkeeping table is version-keyed, so whichever branch merges second gets its 010 **silently skipped** — and gear/spot/Open-Meteo now exist as TWO independent implementations. The merge-to-main session must renumber one side and unify the duplicated primitives into one gear entity, one spot entity, one Open-Meteo module. Earth/Body: **do not use 010–013 without checking both branches first.** Water also owns the `readActivities` rewrite — Earth should rebase on it for run/ride/hike ingestion, not reimplement.
2. **HK paddleSports → 'kayak' default** — can't auto-detect whitewater; you edit the activity after import.
3. **Dual-device duplicates** (Watch + Garmin recording the same session = two UUIDs = two sessions) — overlap dedup deliberately deferred; needs a design call.
4. **Deleting an ingested workout un-deletes on the next poll** (UUID no longer in DB → re-import). Needs a tombstone design call.
5. **No gear-creation UI yet** — boat/kit pickers are invisible until gear rows exist. Needs a small gear-management surface (or I seed your quiver next session).
6. **Ingested-workout fidelity 0.95** uses the existing session-fidelity mechanism, which itself predates your "fidelity is food-only" ruling — global resolution someday.
7. **Whitewater progression milestones** (first III/IV/V, days-on-water) deferred — descriptive-vs-gamification framing is your call.
8. **PaddlingBlock** in observation.ts is an unused pre-existing sketch — candidate for removal.
9. Tunables: gauge trend ±5%/6h, swim rest-gap 15s, wind-direction similarity weight 3kts.
10. Deferred: minutely-15 wind (confirmed available), AW GraphQL (JSON routes dead, correlations empty), FIT parser (v1 bets on HealthKit for Garmin swim data — verify with a real export), manual swim set-logger + lap editing + drill/kick UI, named downwind runs (two spot refs for now), similar-conditions UI placement.

## Not done / next
- Device/sim verification of the sections + HealthKit reads (JS-only changes; the installed dev client can load this branch's Metro).
- Merge to main after your smoke test + flag decisions.
