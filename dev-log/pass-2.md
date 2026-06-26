# Pass 2 — Storage layer

**Goal:** SQLite tables for Observations and Benchmarks, typed CRUD, migration
tooling, a smoke test. No UI — plumbing. (game-plan-and-prompts.md)

## What shipped

- `src/storage/db.ts` — `SqlDatabase` port + `runMigrations()` (versioned, applies
  pending in order) + `getDb()` singleton (expo-sqlite, dynamically imported).
- `src/storage/migrations/001_initial.ts` — observations + benchmarks + migrations
  tables, with indexes on `(kind, occurredAt)` and `(occurredAt)`.
- `src/storage/serialize.ts` — pure row ↔ typed-object hydration (JSON columns).
- `src/storage/observations.ts` — `createObservation`, `listObservations({from,to,kinds})`,
  `getObservationById`, `supersedeObservation`.
- `src/storage/benchmarks.ts` — `create`, `list({status})`, `getById`, `update`.
- `src/lib/id.ts` — `uuidv7()` (time-sortable IDs, expo-crypto randomness).
- `src/storage/__tests__/` — smoke test (insert/read-back, supersede, date window),
  backed by an in-memory better-sqlite3 adapter. Jest via jest-expo.

## Decisions

1. **One generic `observations` table**, JSON `source`/`payload` columns — per the
   constitution ("everything is an Observation") and the game plan's explicit
   "NOT separate tables per kind". This overrides a stray line in data-model.md
   that suggested per-kind tables.
2. **`SqlDatabase` port.** Storage depends on a tiny interface, not on expo-sqlite
   directly. App backs it with expo-sqlite; tests back it with in-memory
   better-sqlite3 → the smoke test runs *real* SQL in Node, not a mock. Keeps the
   engine fully decoupled from the database.
3. **expo-sqlite is dynamically imported** inside `getDb()`, so importing the
   storage layer in a Node test never loads the native module.
4. **Append-only edits.** `supersedeObservation` inserts a new version with a
   back-pointer; `listObservations` excludes superseded rows so trend history
   stays intact (data-model principle 5). Benchmarks are mutable → `update()`.
5. **Migrations as `.ts`** exporting SQL strings (Metro can't import `.sql`).
6. **CRUD takes an optional `db`** param for test injection; defaults to the
   singleton in the app.

## Verified

`npx tsc --noEmit` clean. `npx jest` → 3/3 pass (real in-memory SQLite round-trip).

## Open / deferred

- expo-sqlite on **web** needs a wasm asset + metro tweak; only matters once a
  screen calls `getDb()` (Pass 3). Device / Expo Go is the Phase-1 target.
- JSON export button (Settings) — wire when Settings gets built out.

## Next — Pass 3: Today screen + weigh-in

First real end-to-end slice: log a weight, see it persist on Today, show the
trend delta from `core/trend.ts` (which gets its real implementation this pass).
