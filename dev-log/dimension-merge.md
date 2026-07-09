# Dimension merge — Body + Earth + Water + Sky → main (2026-07-09, overnight)

Fable session, hands-off overnight run. Objective: merge all four dimension
branches into main, resolve the migration-number collision cleanly, regroup
the Training tab by element (Body → Earth → Water → Sky), and stage the
not-in-Training-Database activity prune for Dylan's morning confirmation.

## What landed

Merge order Body → Earth → Water → Sky on `merge/dimensions` off main
(`d07a4fd`), full jest+tsc gate at every step. Final: **1184 jest, tsc clean.**

### The migration collision — how it was resolved

- **Versions 010–013 are burned forever.** Each branch shipped different
  content under those numbers; the runner tracks applied migrations by
  version only. The registry now jumps 009 → 014 with a long comment
  explaining why. The branch migration files stay on disk as historical
  record (`010_gear.ts` = Earth's, `010_gear_kits_spots.ts` = Water's,
  `010_gear_sky.ts` = Sky's renamed copy, `011_*`, `012_*`, `013_*`) but are
  never registered again.
- **`014_dimension_unify`** is a *code* migration (the runner gained an
  optional `run(db)` alongside `sql` — new app code, no shipped SQL touched).
  It introspects the device's actual tables via `PRAGMA table_info` and
  converges every possible starting state — fresh/Body, Water's snake_case
  gear+kits+spots, Earth's camelCase gear(+parentId), Sky's gear(+updatedAt)
  + spots(kind/meta) + conditions_snapshots, and **pre-rename variants**
  (`acquiredAt`/`retiredAt`, for devices that upgraded before Earth's 011 /
  Sky's 013 shipped) — onto one canonical schema, carrying data over.
  Covered by `src/storage/__tests__/dimensionUnify.test.ts` (7 device-shape
  tests incl. idempotence).

### Canonical schema (all camelCase — Water's snake_case was the outlier)

- `gear` — superset: `parentId` (Earth components), `updatedAt` (Sky,
  nullable), `acquiredOn`/`retiredOn`, `spec` JSON, indexes on category +
  retiredOn.
- `kits` — Water's, camelCased (`gearIds`). Water's Kit stays canonical.
- `spots` — **the Spot-shape call (made per Dylan's "make a call" mandate):
  Water's typed columns (`riverName`/`sectionName`/`gaugeSiteId`) PLUS Sky's
  `kind` (free string) + `meta` JSON bag, lat/lng nullable** (pre-geocode
  Water rows exist). Water's deeply-wired SpotPicker/WhitewaterSection kept
  working untouched; Sky's flying-site facts live on in `meta`.
- `conditions_snapshots` — Sky's 012 verbatim.

### Name-collision decisions (both sides kept, one renamed)

- `GearItem`/`GearSpec`: **Water kept the plain names** (more consumers);
  Sky's became `SkyGearItem`/`SkyGearSpec` (`core/src/gear.ts`), Sky's
  storage module became `src/storage/skyGear.ts` (Sky has no gear UI yet —
  only tests consumed it).
- `ConditionsSnapshot`: **Earth kept the plain name** (it's embedded in the
  Observation payload type); Sky's became `SkyConditionsSnapshot` in
  `core/src/skyConditions.ts`, its fetch wrapper `lib/conditions/skyOpenMeteo.ts`.
- `listGear`: Earth's signature is the shared one (returns `GearRecord[]`);
  Water's list view is `listGearItems` (newest-first, `GearItem[]`).
- `updateSpot`: overloaded — `updateSpot(spot)` (Water) and
  `updateSpot(id, patch, db?, nowIso?)` (Sky) in one implementation.
- Two CSV parsers existed (`Body`'s general RFC-4180 + delimiter sniffing vs
  Earth's comma-only): Body's kept `src/lib/csv.ts`; Earth's moved to
  `src/lib/climbImport/csv.ts` next to its only consumers. ⚑ Consolidation
  candidate later.
- `GearCategory` is one union of three per-dimension arm sets
  (`EarthGearCategory | WaterGearCategory | SkyGearCategory`).

### Training tab (replaces the old headline/"More" outdoor grouping)

`elementSections()` in `src/lib/activity.ts` renders four fixed-order
sections: **Body → Earth → Water → Sky** (mapping in `ELEMENT_OF`).

### Prune — staged, NOT deleted (morning confirmation owed)

`REVIEW_PENDING_IDS` = **strength, crossfit, pilates, meditation, paddle,
surf, sup, canoe, row, skate** — in the registry but not in the Notion
Training Database and untouched by any dimension build. They render in a
collapsed "Review — pending removal" section on the Training tab and are
hidden from the quick-log picker. **Kept (dimension-built despite not all
being DB rows):** walk/ruck/snowboard/ski-touring/xc-ski/snowshoe (Earth
gearCategories), sail/windsurf/kitesurf/wingfoil/parawing (Water
WIND_ACTIVITIES), kayak/whitewater (Water WHITEWATER_ACTIVITIES).
**Confirmed deletes should become `deprecated: true`, not row removal**, for
anything that may have logged sessions.

## ⚑ Flags for Dylan

1. **⚑ Review-section list** (above) — confirm which of the 10 actually die.
2. **⚑ `updateSpot(spot)` semantics changed** (review finding, deliberate):
   Water's original overwrote the whole row (absent optional field → NULLed);
   the merged version merges with the stored row, so *clearing* a field via
   the Water call shape is no longer possible. No current caller clears
   fields; the future spot-editor UI will need a decision here.
3. **⚑ Two CSV parsers** (Body general vs Earth climbing) — consolidate later.
4. **⚑ Burned 010–013** — any docs/specs referencing "migration 010" by
   number are stale; the canonical tables are 014's.
5. **⚑ `sessionWaterFlow` device smoke** — Water/Sky flows re-tested only at
   the jest level; the usual on-device smoke test is owed in the morning
   (log a whitewater session, a flight, check gear chips + settings cards).

## Review

10-file targeted review of all hand-authored merge code (migration 014,
runner dispatch, unified gear/spots storage, serialize mappers, session
builder chain, log-session form resets) — 1 confirmed bug found and fixed
(pre-rename gear shapes crashing 014, see fix commit), 1 semantic flag (#2
above). Everything else traced clean.
