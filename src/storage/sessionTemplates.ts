/**
 * sessionTemplates.ts — typed CRUD for the SessionTemplate table.
 *
 * Templates are user-authored training shapes (Phase 6 Pass 1). Unlike
 * Observations, they're mutable in place: edits overwrite the row, deletes
 * hard-remove it. Library ships empty — every record here came from the user.
 *
 * Every function accepts an optional `db` for tests; the app uses the
 * expo-sqlite singleton by default (matches benchmarks.ts and observations.ts).
 */
import type { SessionTemplate } from '@core/sessionTemplate';
import { getDb, type SqlDatabase } from './db';
import {
  sessionTemplateToRow,
  rowToSessionTemplate,
  type SessionTemplateRow,
} from './serialize';

const COLUMNS =
  'id, name, surface, activity, shape, dayAssignment, isActive, createdAt, updatedAt';

export async function createTemplate(
  t: SessionTemplate,
  db?: SqlDatabase
): Promise<SessionTemplate> {
  const d = db ?? (await getDb());
  const r = sessionTemplateToRow(t);
  await d.runAsync(
    `INSERT INTO session_templates (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      r.id,
      r.name,
      r.surface,
      r.activity,
      r.shape,
      r.dayAssignment,
      r.isActive,
      r.createdAt,
      r.updatedAt,
    ]
  );
  return t;
}

export async function listTemplates(
  db?: SqlDatabase
): Promise<SessionTemplate[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<SessionTemplateRow>(
    `SELECT ${COLUMNS} FROM session_templates ORDER BY updatedAt DESC;`
  );
  return rows.map(rowToSessionTemplate);
}

export async function getTemplateById(
  id: string,
  db?: SqlDatabase
): Promise<SessionTemplate | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<SessionTemplateRow>(
    `SELECT ${COLUMNS} FROM session_templates WHERE id = ?;`,
    [id]
  );
  return row ? rowToSessionTemplate(row) : null;
}

/**
 * Merge a partial change into an existing template and persist it. `updatedAt`
 * is the caller's responsibility — the screen sets it to `new Date().toISOString()`
 * on save, so tests stay deterministic.
 */
export async function updateTemplate(
  id: string,
  patch: Partial<Omit<SessionTemplate, 'id' | 'createdAt'>>,
  db?: SqlDatabase
): Promise<SessionTemplate> {
  const d = db ?? (await getDb());
  const existing = await getTemplateById(id, d);
  if (!existing) {
    throw new Error(`updateTemplate: no template with id ${id}`);
  }
  const merged: SessionTemplate = { ...existing, ...patch, id };
  const r = sessionTemplateToRow(merged);
  await d.runAsync(
    `UPDATE session_templates
     SET name = ?, surface = ?, activity = ?, shape = ?,
         dayAssignment = ?, isActive = ?, updatedAt = ?
     WHERE id = ?;`,
    [
      r.name,
      r.surface,
      r.activity,
      r.shape,
      r.dayAssignment,
      r.isActive,
      r.updatedAt,
      id,
    ]
  );
  return merged;
}

export async function deleteTemplate(
  id: string,
  db?: SqlDatabase
): Promise<boolean> {
  const d = db ?? (await getDb());
  const existed = await d.getFirstAsync<{ id: string }>(
    'SELECT id FROM session_templates WHERE id = ?;',
    [id]
  );
  if (!existed) return false;
  await d.runAsync('DELETE FROM session_templates WHERE id = ?;', [id]);
  return true;
}
