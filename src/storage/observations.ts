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
 * Hard-deletes an observation and any observations that supersede it (so the
 * full edit chain is removed). Used by the food log for "remove this entry"
 * actions where keeping a tombstone adds no value. Trends derived from
 * persisted observations should be recomputed after a delete.
 */
export async function deleteObservation(
  id: ObservationId,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  // Walk forward through the supersede chain so we delete every version.
  const ids = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const cur of frontier) {
      const successors = await d.getAllAsync<{ id: string }>(
        'SELECT id FROM observations WHERE supersedes = ?;',
        [cur]
      );
      for (const s of successors) {
        if (!ids.has(s.id)) {
          ids.add(s.id);
          next.push(s.id);
        }
      }
    }
    frontier = next;
  }
  for (const i of ids) {
    await d.runAsync('DELETE FROM observations WHERE id = ?;', [i]);
  }
}
