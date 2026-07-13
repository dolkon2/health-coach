# Phase 4 · P4-4 — Gear Quiver rework, display-only (P9)

**Date:** 2026-07-13 · **Branch:** `feat/gear-quiver` (off `main`, base `3f05290`) · **Worktree:** `~/Projects/health-coach`
**Head:** `b7fbec3` · 6 commits · **⚠️ NOT pushed** (awaiting Dylan)

Builds the profile spec's §2 quiver track (P9, §6): one quiver spanning all
sports over the existing gear/kits tables, the two descriptive read models
(last-used + wear-vs-threshold), and Sky reserve repack dates as the same
threshold shape keyed by date. **Display only** — nothing here fires,
badges, or reminds; the lines exist only while the quiver is open (⚑7/R6
stays unruled and unbuilt, exactly as scoped).

## ⚑0 — NO migration was claimed (spec text is stale, not the build)

The spec calls for "Earth arms as an additive migration (017+ claimant)."
That work **already landed**: migration 014's canonical gear schema carries
`parentId` (Earth's component hierarchy), `core/gear.ts` has had the full
Earth category union (shoes/boots/bike/bike-component/skis) since the
dimension merge, and the old gear screen already created Earth gear. There
was nothing additive left for a migration to add — the gear table's
`category` is an unconstrained TEXT column, so new categories are data, not
schema. Building a no-op migration to satisfy the spec sentence would have
burned 019 for nothing, so none was built. **Next free migration is still
019.** `profile-settings.md` §2/§6 should get a one-line correction.

## What shipped (6 single-concern commits)

1. **`cf4e18f` feat(core)** — `sessionGearIds()`: one extractor over the
   payload homes dimension history left gear refs in; `deriveGearTotals`
   now counts Water/Sky-tagged sessions (before this, only top-level
   `gearIds` accrued — a wing or boat sat at 0 forever); `GearTotals` gains
   `lastUsed` off the same accrual pass, so component inheritance and the
   acquiredOn civil-day gate apply to it for free.
2. **`b028e08` feat(lib)** — `src/lib/gearWear.ts`: wires core's
   never-before-called Sky gear math (`paragliderTotalHours`,
   `retrimStatus`, `repackDueAt`) to real Observations. Per-gear airtime
   honors `SkyGearUse.segmentIds` narrowing and skyLedger's
   trackless-manual-duration convention (same USHPA caveat, now noted in
   both places). Descriptive lines only: "102 hr on the wing (100 hr
   pre-app baseline)", "2 hr since your 2026-06-01 trim, of your 30 hr
   mark", "Repacked 2026-01-10 — 183 days ago — past your 2026-07-10
   repack date". `daysBetween` joins `date.ts`.
3. **`5d22ad4` feat(gear)** — the cross-sport quiver screen: Earth/Water/
   Sky element sections over the shared table (Water and Sky rows were
   invisible on this screen before — it only knew Earth categories), each
   item rendering status line + last-used + wear/repack lines. Add form
   gains the Water/Sky arms so cross-sport gear is creatable at all
   (Water name-only; paraglider style + pre-app hours baseline; reserve
   last-repack date + interval).
4. **`e6827a1` feat(profile)** — the Gear Quiver module's last-used
   preview (§3's "Item count + last-used preview", which waited on this
   read model): newest tagging session, derived from the logbook sessions
   already loaded — no new query.
5. **`55ea48e` fix(core)** — `/code-review`'s biggest find: kayak sessions
   tag the boat ONLY via `whitewater.boatGearId` (session.ts writes it
   there, never into top-level gearIds) — a **fourth** ref home the build
   had missed; without the fix a kayak would show 0 sessions forever. Also:
   sky sessions' durationMin/endurance km cover the whole outing (hike +
   ground), so `gearStatusLine` was stating hike kilometres as wing wear —
   sky categories now render the session count only (airtime is
   gearWear's story); `paragliderTotalHours` takes
   `Pick<ParagliderSpec,'hoursBaseline'>` so callers stop fabricating a
   style.
6. **`b7fbec3` fix(gear)** — the rest of the review batch: repack line
   renders without the session read (it derives from the spec alone),
   states a future date plainly (never "-176 days ago"), and names an
   interval-only spec so a saved value never looks lost; an unparseable
   repack date refuses the save loudly instead of vanishing; an explicit
   0-hr baseline is a declared fact (per core's own contract); airtime
   narrowing reuses `totalAirtimeSec` (one airtime rule, not two); plus an
   efficiency pass (ref-probe before Intl day lookup, sky-only session
   subset, one grouping pass for the section render, `today` as a memo
   dep so day-keyed lines roll over at midnight).

## Review

`/code-review` at high effort: 8 finder angles (line-by-line, removed-
behavior, cross-file tracer, reuse, simplification, efficiency, altitude,
conventions), ~30 candidates deduped, 10 findings reported, 9 fixed
(commits 5–6). 1 finding-group left as documented — see flags.

## Verification

- **jest:** 129 suites / **1345 tests** pass (+21 net new: `gearWear`
  suite; whitewater/wind/sky ref, lastUsed, and sky-status-line cases in
  `core gear`; `daysBetween` in `date`).
- **tsc --noEmit:** 0 errors (run LAST, after tests).
- **Sim (iPhone 17, real dev-client, live DB):** seeded 4 gear rows
  (shoes w/ 500 km mark, kayak, paraglider w/ baseline+trim spec, reserve
  w/ repack spec) + 3 tagging sessions (top-level gearIds run,
  whitewater.boatGearId paddle, sky.gearRefs flight), relaunched,
  deep-linked `healthcoach://gear`, screenshotted:
  - Earth › Shoes: "12 km of your 500 km mark · Last used 2026-07-10 —
    2 days ago" ✓
  - Water › Kayak: "1 session · 8 km · Last used 2026-07-08 — 4 days ago"
    — **the whitewater ref-home fix proven end-to-end** ✓
  - Sky › Paraglider: "1 session · Last used 2026-07-11 — yesterday ·
    102 hr on the wing (100 hr pre-app baseline) · 2 hr since your
    2026-06-01 trim, of your 30 hr mark" ✓ (and no hike-km attribution)
  - Sky › Reserve: "0 sessions · Repacked 2026-01-10 — 183 days ago —
    past your 2026-07-10 repack date" ✓ — the date-keyed threshold shape,
    purely descriptive.
  - Profile: "4 items in your quiver · Last used: Ozone Rush 6 —
    Yesterday" ✓ (via the P4-3 temp-edit-above-the-fold trick, reverted).
  - No RN/JS errors in sim logs. Seeds deleted, temp edit reverted, sim
    left at its pre-test baseline (0 gear rows — none existed before).
- **Not interactively verified** (same computer-use/keyboard tooling gap
  as P4-3): the add-form tap-through — new category chips, the reserve
  date field, save round-trip. The save path is the same `createGear`
  jest exercises, and the invalid-date refusal is pure logic, but a hand
  tap-through of "add a reserve with a repack date" is worth 2 minutes
  next time someone's in the sim.

## ⚑ Flags

- **⚑1 — Spec staleness (doc fix, not code):** `profile-settings.md`
  §2/§6-P9 still says Earth arms need an additive migration; they landed
  at the 014 merge (see ⚑0). One-line correction owed; **next free
  migration remains 019.**
- **⚑2 — Add-form scope calls (made + flagged, sketch-level UI):**
  (a) Water gear saves name+category only — the GearSpec fields (sizeM2,
  volumeL…) exist in core but feed no read model, so the form doesn't ask;
  (b) paraglider form takes style + hours baseline only — `certClass`,
  `trimNudgeHours`, and `lastTrimDate` are unenterable, and since trim is
  a service *event*, it really wants a gear-EDIT surface, which doesn't
  exist at all yet (no gear row is editable post-create). The retrim line
  ships fully working but is only reachable for data created outside the
  form today. If a gear-edit pass is wanted, that's a product call.
- **⚑3 — Two last-used registers, deliberately:** the quiver says
  "Last used 2026-07-10 — 2 days ago" (wear register, day counts); the
  Profile preview says "Last used: Ozone Rush 6 — Yesterday" (logbook
  register, `dayNavLabel`). Flag if one voice is wanted.
- **⚑4 — Profile preview semantics (deliberate, commented):** direct refs
  + active gear only — it names what the user tagged, ignores component
  inheritance and the acquiredOn gate, and skips retired items. The
  quiver's per-item lastUsed applies all three. Divergence is documented
  in the memo comment; flag if the preview should instead mirror core.
- **⚑5 — Segment-narrowed sky refs count as whole-session uses** for
  sessions/days/lastUsed in `deriveGearTotals` (airtime honors the
  narrowing). With sky status lines now sessions-only, no contradictory
  number renders; a wing swapped in mid-session still "counts" the outing.
  Judged honest (the wing WAS used that session); flag if not.
- **⚑6 — Trim-day inclusiveness:** flights earlier on the trim day count
  toward hours-since-trim — day-granular dates can't order within a day.
  Counts high (conservative for a safety-adjacent number).
- **⚑7 — Hand log with no duration contributes nothing** to a wing's
  tracked hours (the total is a floor — skyLedger's own convention,
  matching its USHPA caveat). Fabricating hours was the alternative;
  rejected.
- **⚑8 — `daysBetween` has two private twins** in core (`trend.ts`,
  `expenditure.ts`; core can't import src/lib). Doc note added pointing at
  them; consolidation would be a small core refactor, deferred.

## Not done / deferred

- **R6/⚑7 (reminders)** — untouched by design; display only until ruled.
- Gear-edit surface (⚑2b) — doesn't exist; retrim entry waits on it.
- Kits display on the quiver screen — kits are a session-logging
  convenience (WindSection); the quiver lists items. Not specced, not
  built, flag if wanted.
- Add-form tap-through verification (tooling gap above).

## Status block

- **Pass:** P4-4 Gear Quiver display-only (P9) · branch `feat/gear-quiver`
  · head `b7fbec3` · **no migration claimed — next free is 019**
- **Tests:** 1345/1345 jest (129 suites, +21) · tsc 0 · code-review: 10
  findings, 9 fixed · sim: all four read models screenshot-verified on
  live DB, seeds cleaned
- **⚑ flags:** 8 above + ⚑0 — none blocking; ⚑1 is a one-line spec doc fix
- **Safe to leave as-is?** Yes — branch green, sim clean. Next action is
  Dylan's: push/merge this branch, or start a 🟥 flag-resolution pass
  (R1–R4, R7) — the ✅ Phase-4 track (P4-1 → P4-4) is now complete.
