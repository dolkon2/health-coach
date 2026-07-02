/**
 * benchmarks.ts — typed CRUD for the Benchmark table.
 *
 * Benchmarks are the user's own goals, in their own words (no category picker).
 * Unlike Observations, they're mutable: status moves active → achieved/abandoned/
 * paused, so this exposes update() rather than supersede().
 */
import type { Benchmark } from '@core/benchmark';
import { getDb, type SqlDatabase } from './db';
import { benchmarkToRow, rowToBenchmark, type BenchmarkRow } from './serialize';

const COLUMNS =
  'id, createdAt, resolvedAt, status, title, description, targetDate, relatedModalities, behavior, outcome, pinned';

export async function createBenchmark(
  b: Benchmark,
  db?: SqlDatabase
): Promise<Benchmark> {
  const d = db ?? (await getDb());
  const r = benchmarkToRow(b);
  await d.runAsync(
    `INSERT INTO benchmarks (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      r.id,
      r.createdAt,
      r.resolvedAt,
      r.status,
      r.title,
      r.description,
      r.targetDate,
      r.relatedModalities,
      r.behavior,
      r.outcome,
      r.pinned,
    ]
  );
  return b;
}

export async function listBenchmarks(
  opts: { status?: Benchmark['status'] } = {},
  db?: SqlDatabase
): Promise<Benchmark[]> {
  const d = db ?? (await getDb());
  const sql = opts.status
    ? `SELECT ${COLUMNS} FROM benchmarks WHERE status = ? ORDER BY createdAt DESC;`
    : `SELECT ${COLUMNS} FROM benchmarks ORDER BY createdAt DESC;`;
  const rows = await d.getAllAsync<BenchmarkRow>(sql, opts.status ? [opts.status] : []);
  return rows.map(rowToBenchmark);
}

export async function getBenchmarkById(
  id: string,
  db?: SqlDatabase
): Promise<Benchmark | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<BenchmarkRow>(
    `SELECT ${COLUMNS} FROM benchmarks WHERE id = ?;`,
    [id]
  );
  return row ? rowToBenchmark(row) : null;
}

/**
 * Merge a partial change into an existing benchmark and persist it.
 *
 * Spread merge means a key must be PRESENT in the patch to change — so to
 * remove a face, pass it explicitly as undefined (`{ outcome: undefined }`);
 * omitting the key keeps the stored face. The edit form always sends both
 * face keys for exactly this reason. Removing the last face throws (the
 * serializer's ≥1-face gate).
 */
export async function updateBenchmark(
  id: string,
  patch: Partial<Omit<Benchmark, 'id'>>,
  db?: SqlDatabase
): Promise<Benchmark> {
  const d = db ?? (await getDb());
  const existing = await getBenchmarkById(id, d);
  if (!existing) {
    throw new Error(`benchmark ${id} not found`);
  }
  const merged: Benchmark = { ...existing, ...patch, id };
  const r = benchmarkToRow(merged);
  await d.runAsync(
    `UPDATE benchmarks
     SET createdAt = ?, resolvedAt = ?, status = ?, title = ?, description = ?,
         targetDate = ?, relatedModalities = ?, behavior = ?, outcome = ?, pinned = ?
     WHERE id = ?;`,
    [
      r.createdAt,
      r.resolvedAt,
      r.status,
      r.title,
      r.description,
      r.targetDate,
      r.relatedModalities,
      r.behavior,
      r.outcome,
      r.pinned,
      id,
    ]
  );
  return merged;
}
