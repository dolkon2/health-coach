/**
 * observations.ts — typed CRUD for the Observation table.
 *
 * Returns hydrated Observation objects ready to hand to the engine. Edits are
 * append-only: supersede() inserts a new version pointing back at the old one,
 * and list() returns only the latest (non-superseded) versions, so trend
 * computations over history stay intact (data-model.md principle 5).
 *
 * Every function accepts an optional `db` to allow injecting a test database;
 * in the app it defaults to the expo-sqlite singleton.
 */
import type {
  Observation,
  ObservationId,
  ObservationKind,
  ObservationOf,
  FoodItem,
  ISOInstant,
} from '@core/observation';
import { getDb, type SqlDatabase, type SqlParam } from './db';
import { observationToRow, rowToObservation, type ObservationRow } from './serialize';

const COLUMNS =
  'id, kind, occurredAt, loggedAt, tz, tier, fidelity, source, payload, notes, supersedes';

export async function createObservation(
  obs: Observation,
  db?: SqlDatabase
): Promise<Observation> {
  const d = db ?? (await getDb());
  const r = observationToRow(obs);
  await d.runAsync(
    `INSERT INTO observations (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      r.id,
      r.kind,
      r.occurredAt,
      r.loggedAt,
      r.tz,
      r.tier,
      r.fidelity,
      r.source,
      r.payload,
      r.notes,
      r.supersedes,
    ]
  );
  return obs;
}

export type ListObservationsOptions = {
  from?: ISOInstant; // inclusive lower bound on occurredAt
  to?: ISOInstant; // inclusive upper bound on occurredAt
  kinds?: ObservationKind[];
};

export async function listObservations(
  opts: ListObservationsOptions = {},
  db?: SqlDatabase
): Promise<Observation[]> {
  const d = db ?? (await getDb());
  const where: string[] = [];
  const params: SqlParam[] = [];

  if (opts.from) {
    where.push('occurredAt >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    where.push('occurredAt <= ?');
    params.push(opts.to);
  }
  if (opts.kinds && opts.kinds.length > 0) {
    where.push(`kind IN (${opts.kinds.map(() => '?').join(', ')})`);
    params.push(...opts.kinds);
  }
  // Exclude any observation that a later version supersedes.
  where.push(
    'id NOT IN (SELECT supersedes FROM observations WHERE supersedes IS NOT NULL)'
  );

  const sql = `SELECT ${COLUMNS} FROM observations
     WHERE ${where.join(' AND ')}
     ORDER BY occurredAt ASC;`;
  const rows = await d.getAllAsync<ObservationRow>(sql, params);
  return rows.map(rowToObservation);
}

export async function getObservationById(
  id: ObservationId,
  db?: SqlDatabase
): Promise<Observation | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<ObservationRow>(
    `SELECT ${COLUMNS} FROM observations WHERE id = ?;`,
    [id]
  );
  return row ? rowToObservation(row) : null;
}

/**
 * Records an edit: inserts `newObs` with a back-pointer to `oldId`. The old row
 * is preserved (append-only); list() will now return the new version instead.
 */
export async function supersedeObservation(
  oldId: ObservationId,
  newObs: Observation,
  db?: SqlDatabase
): Promise<Observation> {
  const d = db ?? (await getDb());
  return createObservation({ ...newObs, supersedes: oldId }, d);
}

/**
 * Hard-delete by id. Pass 6 contract: edits and deletes are destructive — the
 * supersede pattern is deferred to Ring 2 (see backlog.md). Returns true when
 * a row was removed, false when nothing matched the id.
 */
export async function deleteObservation(
  id: ObservationId,
  db?: SqlDatabase
): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>(
    'SELECT id FROM observations WHERE id = ?;',
    [id]
  );
  if (!existed) return false;
  await d.runAsync('DELETE FROM observations WHERE id = ?;', [id]);
  return true;
}

/**
 * Hard-overwrite by id. The row's kind and original loggedAt are preserved;
 * everything else comes from `obs`. Pass 6 contract: edits do not supersede —
 * they replace. Throws if no row with that id exists.
 */
export async function updateObservation(
  obs: Observation,
  db?: SqlDatabase
): Promise<Observation> {
  const d = db ?? (await getDb());
  const existing = await getObservationById(obs.id, d);
  if (!existing) {
    throw new Error(`updateObservation: no observation with id ${obs.id}`);
  }
  const merged: Observation = {
    ...obs,
    kind: existing.kind,
    loggedAt: existing.loggedAt,
  } as Observation;
  const r = observationToRow(merged);
  await d.runAsync(
    `UPDATE observations SET
       occurredAt = ?, loggedAt = ?, tz = ?, tier = ?,
       fidelity = ?, source = ?, payload = ?, notes = ?, supersedes = ?
     WHERE id = ?;`,
    [
      r.occurredAt,
      r.loggedAt,
      r.tz,
      r.tier,
      r.fidelity,
      r.source,
      r.payload,
      r.notes,
      r.supersedes,
      r.id,
    ]
  );
  return merged;
}

export interface RecentFoodItem {
  item: FoodItem;
  lastLoggedAt: string;
}

/**
 * Extracts distinct food items from recent foodEntry observations whose
 * description matches the search term. Deduplicates by foodId, keeping
 * only the most-recent occurrence of each.
 */
export async function getRecentFoodItems(
  searchTerm: string,
  db?: SqlDatabase
): Promise<RecentFoodItem[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<{ payload: string; occurredAt: string }>(
    `SELECT payload, occurredAt FROM observations
     WHERE kind = 'foodEntry'
       AND id NOT IN (SELECT supersedes FROM observations WHERE supersedes IS NOT NULL)
     ORDER BY occurredAt DESC
     LIMIT 100;`,
    []
  );

  const term = searchTerm.toLowerCase();
  const seen = new Map<string, RecentFoodItem>();

  for (const row of rows) {
    const payload = JSON.parse(row.payload) as { items?: FoodItem[] };
    if (!payload.items) continue;
    for (const item of payload.items) {
      // Keyless LLM estimates aren't catalog entries — they have no stable foodId
      // to recur by, so they never appear in recents (save-as-meal handles reuse).
      if (item.foodId == null) continue;
      if (!item.description || !item.description.toLowerCase().includes(term)) continue;
      if (seen.has(item.foodId)) continue;
      seen.set(item.foodId, { item, lastLoggedAt: row.occurredAt });
    }
  }

  return Array.from(seen.values());
}

/**
 * Sessions that followed a given route (routes-spec ⚑7 / training-tab.md §4:
 * "a scoped filtered view of sessions, not the logbook" — same JS-scan-over-
 * payload rationale as the anticipated listSessionsForSpot; a route's
 * `routeId` backlink lives on EnduranceBlock/SkyBlock, not a column, so
 * there's no query to push into SQL). Fine at personal scale; a ceiling is
 * already flagged (training-tab.md §9) if route counts grow large. Single-
 * route detail use (app/route/[id].tsx) — for a per-route COUNT across many
 * routes, use countSessionsByRoute instead of calling this in a loop.
 */
export async function listSessionsForRoute(
  routeId: string,
  db?: SqlDatabase
): Promise<ObservationOf<'session'>[]> {
  const sessions = (await listObservations({ kinds: ['session'] }, db)) as ObservationOf<'session'>[];
  return sessions
    .filter((o) => o.payload.endurance?.routeId === routeId || o.payload.sky?.routeId === routeId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/**
 * Effort counts for every route that has any, from ONE scan of the session
 * table — the batch counterpart to listSessionsForRoute. Calling
 * listSessionsForRoute once per route (the Routes list / Training shelf's
 * original shape) re-scans and re-JSON.parses the entire session table N
 * times over; this does it once and groups in memory. A route with zero
 * sessions is simply absent from the map (never a fabricated 0 entry).
 */
export async function countSessionsByRoute(db?: SqlDatabase): Promise<Map<string, number>> {
  const sessions = (await listObservations({ kinds: ['session'] }, db)) as ObservationOf<'session'>[];
  const counts = new Map<string, number>();
  for (const o of sessions) {
    const routeId = o.payload.endurance?.routeId ?? o.payload.sky?.routeId;
    if (!routeId) continue;
    counts.set(routeId, (counts.get(routeId) ?? 0) + 1);
  }
  return counts;
}
