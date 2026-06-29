/**
 * foodCache.ts — typed access to the cached_foods table (migration 002).
 *
 * A local cache of looked-up foods, keyed by (sourceDb, foodId). It stores the
 * original source response so the food layer can re-hydrate a FoodItem through
 * the Pass 2.2 adapter without a second network call — and so logging works
 * offline. `lastUsedAt` is bumped on every read/write for recently-used ranking.
 */
import type { FoodSourceDb } from '@core/observation';
import { getDb, type SqlDatabase } from './db';

export interface CachedFood {
  sourceDb: FoodSourceDb;
  foodId: string;
  description: string;
  raw: unknown; // the original source response — re-runnable through the 2.2 adapter
  lastUsedAt: string; // ISO instant
}

interface CachedFoodRow {
  sourceDb: string;
  foodId: string;
  description: string;
  raw: string;
  lastUsedAt: string;
}

const COLUMNS = 'sourceDb, foodId, description, raw, lastUsedAt';

function rowToCachedFood(r: CachedFoodRow): CachedFood {
  return {
    sourceDb: r.sourceDb as FoodSourceDb,
    foodId: r.foodId,
    description: r.description,
    raw: JSON.parse(r.raw),
    lastUsedAt: r.lastUsedAt,
  };
}

export async function getCachedFood(
  sourceDb: FoodSourceDb,
  foodId: string,
  db?: SqlDatabase
): Promise<CachedFood | null> {
  const d = db ?? (await getDb());
  const row = await d.getFirstAsync<CachedFoodRow>(
    `SELECT ${COLUMNS} FROM cached_foods WHERE sourceDb = ? AND foodId = ?;`,
    [sourceDb, foodId]
  );
  return row ? rowToCachedFood(row) : null;
}

/** Upsert a food into the cache and stamp it as just-used. */
export async function putCachedFood(
  food: { sourceDb: FoodSourceDb; foodId: string; description: string; raw: unknown },
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `INSERT INTO cached_foods (${COLUMNS})
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sourceDb, foodId) DO UPDATE SET
       description = excluded.description,
       raw = excluded.raw,
       lastUsedAt = excluded.lastUsedAt;`,
    [food.sourceDb, food.foodId, food.description, JSON.stringify(food.raw), new Date().toISOString()]
  );
}

/** Bump lastUsedAt on a cache hit, so recency ranking stays honest. */
export async function touchCachedFood(
  sourceDb: FoodSourceDb,
  foodId: string,
  db?: SqlDatabase
): Promise<void> {
  const d = db ?? (await getDb());
  await d.runAsync(
    `UPDATE cached_foods SET lastUsedAt = ? WHERE sourceDb = ? AND foodId = ?;`,
    [new Date().toISOString(), sourceDb, foodId]
  );
}

/** Most-recently-used foods first — the basis for a quick re-log list. */
export async function listRecentFoods(limit = 20, db?: SqlDatabase): Promise<CachedFood[]> {
  const d = db ?? (await getDb());
  const rows = await d.getAllAsync<CachedFoodRow>(
    `SELECT ${COLUMNS} FROM cached_foods ORDER BY lastUsedAt DESC LIMIT ?;`,
    [limit]
  );
  return rows.map(rowToCachedFood);
}
