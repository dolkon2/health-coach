/**
 * mealTemplates.ts — typed access to the meal_templates table (migration 003).
 *
 * A MealTemplate is a saved meal definition, NOT an Observation (the meal *logs*
 * are foodEntry Observations). Modeled on benchmarks.ts.
 *
 * The integrity boundary (plan § 4): the template stores no earned fidelity and
 * no occurrence list. `occurrencesFor` derives occurrences as a *query* over the
 * foodEntry observations that carry this template's id — so there is nothing on
 * the template a re-log could inflate. Each occurrence already records its own
 * `inputMethod`, giving {timestamp, method} for free.
 */
import type { FoodItem, InputMethod, ISOInstant, MealTemplate } from '@core/observation';
import { getDb, type SqlDatabase } from './db';

export interface MealOccurrence {
  observationId: string;
  occurredAt: ISOInstant;
  inputMethod: InputMethod;
}

const COLUMNS = 'id, name, createdAt, userConfirmed, canonicalItems';

interface MealTemplateRow {
  id: string;
  name: string | null;
  createdAt: string;
  userConfirmed: number;
  canonicalItems: string;
}

function rowToMealTemplate(r: MealTemplateRow): MealTemplate {
  return {
    id: r.id,
    // Omit the name when the row has none (legacy rows, or an unnamed meal) — the
    // same omit-when-absent rule the type uses, so callers fall back to item names.
    ...(r.name ? { name: r.name } : {}),
    createdAt: r.createdAt,
    userConfirmed: r.userConfirmed === 1,
    canonicalItems: JSON.parse(r.canonicalItems) as FoodItem[],
  };
}

export async function createMealTemplate(
  t: MealTemplate,
  db?: SqlDatabase
): Promise<MealTemplate> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO meal_templates (${COLUMNS}) VALUES (?, ?, ?, ?, ?);`,
    [t.id, t.name ?? null, t.createdAt, t.userConfirmed ? 1 : 0, JSON.stringify(t.canonicalItems)]
  );
  return t;
}

export async function getMealTemplateById(
  id: string,
  db?: SqlDatabase
): Promise<MealTemplate | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<MealTemplateRow>(
    `SELECT ${COLUMNS} FROM meal_templates WHERE id = ?;`,
    [id]
  );
  return row ? rowToMealTemplate(row) : null;
}

export async function listMealTemplates(db?: SqlDatabase): Promise<MealTemplate[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<MealTemplateRow>(
    `SELECT ${COLUMNS} FROM meal_templates ORDER BY createdAt DESC;`
  );
  return rows.map(rowToMealTemplate);
}

/**
 * Occurrences of a template = the (non-superseded) foodEntry observations
 * carrying its id, oldest first. A query, never a stored counter — repetition
 * alone cannot inflate anything the engine reads.
 */
export async function occurrencesFor(
  templateId: string,
  db?: SqlDatabase
): Promise<MealOccurrence[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<{ id: string; occurredAt: string; inputMethod: string }>(
    `SELECT id, occurredAt, json_extract(payload, '$.inputMethod') AS inputMethod
       FROM observations
      WHERE kind = 'foodEntry'
        AND json_extract(payload, '$.templateId') = ?
        AND id NOT IN (SELECT supersedes FROM observations WHERE supersedes IS NOT NULL)
      ORDER BY occurredAt ASC;`,
    [templateId]
  );
  return rows.map((r) => ({
    observationId: r.id,
    occurredAt: r.occurredAt,
    inputMethod: r.inputMethod as InputMethod,
  }));
}
