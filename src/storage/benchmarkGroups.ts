/**
 * benchmarkGroups.ts — typed CRUD for benchmark_groups + the
 * benchmark_group_members join (migration 018, Phase 4 P4-3 / B4).
 *
 * A group is a user-built bundle of benchmarks with one lifecycle knob:
 * pause/resume. Membership is a relational fact, not JSON on either side —
 * `addMember`/`removeMember` write/delete individual join rows. Ids are the
 * caller's job (uuidv7 from @/lib/id), matching gear.ts/observations.ts.
 *
 * `pausedBenchmarkIds()` is the one query Home (useBenchmarkStatuses) and
 * Reflect (useBenchmarkReflect) both call to apply the framing effect: a
 * benchmark belonging to ANY paused group is excluded from those two
 * surfaces, without its own status/pinned row ever changing. The management
 * surface (Profile) reads groups/membership directly and is unaffected.
 */
import { getDb, type SqlDatabase } from './db';
import type { BenchmarkGroup } from '@core/benchmarkGroup';

interface BenchmarkGroupRow {
  id: string;
  createdAt: string;
  title: string;
  paused: number; // 0 | 1
}

function rowToGroup(r: BenchmarkGroupRow): BenchmarkGroup {
  return { id: r.id, createdAt: r.createdAt, title: r.title, paused: r.paused === 1 };
}

export async function createBenchmarkGroup(
  group: BenchmarkGroup,
  db?: SqlDatabase
): Promise<BenchmarkGroup> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO benchmark_groups (id, createdAt, title, paused) VALUES (?, ?, ?, ?);`,
    [group.id, group.createdAt, group.title, group.paused ? 1 : 0]
  );
  return group;
}

export async function listBenchmarkGroups(db?: SqlDatabase): Promise<BenchmarkGroup[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<BenchmarkGroupRow>(
    `SELECT id, createdAt, title, paused FROM benchmark_groups ORDER BY createdAt DESC;`
  );
  return rows.map(rowToGroup);
}

export async function getBenchmarkGroupById(
  id: string,
  db?: SqlDatabase
): Promise<BenchmarkGroup | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<BenchmarkGroupRow>(
    `SELECT id, createdAt, title, paused FROM benchmark_groups WHERE id = ?;`,
    [id]
  );
  return row ? rowToGroup(row) : null;
}

export async function updateBenchmarkGroup(
  id: string,
  patch: Partial<Omit<BenchmarkGroup, 'id' | 'createdAt'>>,
  db?: SqlDatabase
): Promise<BenchmarkGroup> {
  const d = db ?? (await getDb());
  const existing = await getBenchmarkGroupById(id, d);
  if (!existing) {
    throw new Error(`benchmark group ${id} not found`);
  }
  const merged: BenchmarkGroup = { ...existing, ...patch, id };
  await d.runAsync(`UPDATE benchmark_groups SET title = ?, paused = ? WHERE id = ?;`, [
    merged.title,
    merged.paused ? 1 : 0,
    id,
  ]);
  return merged;
}

/** Removes the group and its membership rows. Member benchmarks are untouched. */
export async function deleteBenchmarkGroup(id: string, db?: SqlDatabase): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(`DELETE FROM benchmark_group_members WHERE groupId = ?;`, [id]);
  await d.runAsync(`DELETE FROM benchmark_groups WHERE id = ?;`, [id]);
}

export async function addBenchmarkToGroup(
  groupId: string,
  benchmarkId: string,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT OR IGNORE INTO benchmark_group_members (groupId, benchmarkId) VALUES (?, ?);`,
    [groupId, benchmarkId]
  );
}

export async function removeBenchmarkFromGroup(
  groupId: string,
  benchmarkId: string,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `DELETE FROM benchmark_group_members WHERE groupId = ? AND benchmarkId = ?;`,
    [groupId, benchmarkId]
  );
}

/** Member benchmark ids for one group, e.g. to seed a membership picker. */
export async function listGroupMemberIds(groupId: string, db?: SqlDatabase): Promise<string[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<{ benchmarkId: string }>(
    `SELECT benchmarkId FROM benchmark_group_members WHERE groupId = ?;`,
    [groupId]
  );
  return rows.map((r) => r.benchmarkId);
}

/** Groups with their member count — Profile's management list, one query. */
export async function listBenchmarkGroupsWithCounts(
  db?: SqlDatabase
): Promise<Array<BenchmarkGroup & { memberCount: number }>> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<BenchmarkGroupRow & { memberCount: number }>(
    `SELECT g.id, g.createdAt, g.title, g.paused, COUNT(m.benchmarkId) AS memberCount
     FROM benchmark_groups g
     LEFT JOIN benchmark_group_members m ON m.groupId = g.id
     GROUP BY g.id
     ORDER BY g.createdAt DESC;`
  );
  return rows.map((r) => ({ ...rowToGroup(r), memberCount: r.memberCount }));
}

/** Every group a benchmark belongs to — the detail sheet's membership chips. */
export async function listGroupsForBenchmark(
  benchmarkId: string,
  db?: SqlDatabase
): Promise<BenchmarkGroup[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<BenchmarkGroupRow>(
    `SELECT g.id, g.createdAt, g.title, g.paused
     FROM benchmark_groups g
     JOIN benchmark_group_members m ON m.groupId = g.id
     WHERE m.benchmarkId = ?
     ORDER BY g.createdAt DESC;`,
    [benchmarkId]
  );
  return rows.map(rowToGroup);
}

/**
 * The Home/Reflect framing effect: every benchmark id that belongs to at
 * least one currently-paused group. Both hooks subtract this set from their
 * own active/pinned query — the member benchmark's own row is never read or
 * written here.
 */
export async function pausedBenchmarkIds(db?: SqlDatabase): Promise<Set<string>> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<{ benchmarkId: string }>(
    `SELECT DISTINCT m.benchmarkId
     FROM benchmark_group_members m
     JOIN benchmark_groups g ON g.id = m.groupId
     WHERE g.paused = 1;`
  );
  return new Set(rows.map((r) => r.benchmarkId));
}
