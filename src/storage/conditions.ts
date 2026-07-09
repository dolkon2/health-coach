/**
 * conditions.ts — storage for conditions_snapshots (migration 012).
 *
 * Freezes are captured-at-the-time facts, so this module is INSERT-ONLY: no
 * update path exists, deliberately — a snapshot is never recomputed or
 * overwritten later. capturedAt IS the write time, so there is no separate
 * createdAt/updatedAt bookkeeping.
 *
 * Listing serves the product query "this site's history by day": newest civil
 * day first, newest freeze first within a day.
 */
import type { SkyConditionsSnapshot } from '@core/skyConditions';
import { getDb, type SqlDatabase, type SqlParam } from './db';
import {
  conditionsSnapshotToRow,
  rowToSkyConditionsSnapshot,
  type SkyConditionsSnapshotRow,
} from './serialize';

const COLUMNS = 'id, spotId, capturedAt, dateLocal, source, surface, aloft';

export async function saveSnapshot(
  snapshot: SkyConditionsSnapshot,
  db?: SqlDatabase
): Promise<SkyConditionsSnapshot> {
  const d = db ?? (await getDb());
  const r = conditionsSnapshotToRow(snapshot);
  await d.runAsync(
    `INSERT INTO conditions_snapshots (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [r.id, r.spotId, r.capturedAt, r.dateLocal, r.source, r.surface, r.aloft]
  );
  return snapshot;
}

export type ListSnapshotsOptions = {
  limit?: number;
};

export async function listSnapshotsForSpot(
  spotId: string,
  opts: ListSnapshotsOptions = {},
  db?: SqlDatabase
): Promise<SkyConditionsSnapshot[]> {
  const d = db ?? (await getDb());
  const params: SqlParam[] = [spotId];
  let limitClause = '';
  if (opts.limit != null) {
    limitClause = 'LIMIT ?';
    params.push(opts.limit);
  }
  const rows = await d.getAllAsync<SkyConditionsSnapshotRow>(
    `SELECT ${COLUMNS} FROM conditions_snapshots
     WHERE spotId = ?
     ORDER BY dateLocal DESC, capturedAt DESC
     ${limitClause};`,
    params
  );
  return rows.map(rowToSkyConditionsSnapshot);
}

export async function getSnapshotById(
  id: string,
  db?: SqlDatabase
): Promise<SkyConditionsSnapshot | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<SkyConditionsSnapshotRow>(
    `SELECT ${COLUMNS} FROM conditions_snapshots WHERE id = ?;`,
    [id]
  );
  return row ? rowToSkyConditionsSnapshot(row) : null;
}
