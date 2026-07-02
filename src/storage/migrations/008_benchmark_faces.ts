/**
 * Migration 008 — benchmarks v0.4 (the behavior/outcome collapse).
 *
 * v0.3 stored a benchmark as one `shape` (cadence | trend) resolving to one
 * top-level `resolution`. v0.4 collapses the families into two composable
 * FACES, each carrying its own dimension: `behavior` (window + measure — the
 * old cadence math) and `outcome` (direction + target — the old trend math).
 * Two nullable JSON columns, one per face, matching the domain type exactly
 * (a missing face is NULL, same idiom as relatedModalities).
 *
 * The rewrite block migrates any v0.3-era rows (dev-DB test benchmarks from
 * the Pass-2 sim tap-through): a cadence shape becomes a behavior face, a
 * trend shape becomes an outcome face, and the old top-level resolution moves
 * INTO the face as its dimension. `json()` wrappers keep extracted sub-objects
 * as JSON (bare json_extract text would be re-quoted as a string by
 * json_object). Trend rows split on target presence so a targetless outcome
 * omits the key entirely — the deserializer expects absent, not null.
 *
 * The old `resolution`/`shape` columns stay in place but dead (additive
 * discipline — SQLite ALTERs only; never edit a shipped migration).
 */
import type { Migration } from './index';

/** Exported separately so tests can exercise the rewrite against a hand-built
 *  legacy row (runMigrations on a fresh DB never sees v0.3-format data). */
export const legacyShapeRewrite = `
  UPDATE benchmarks SET behavior = json_object(
    'dimension', json(resolution),
    'window', json_extract(shape, '$.window'),
    'measure', json(json_extract(shape, '$.measure'))
  ) WHERE json_extract(shape, '$.family') = 'cadence' AND behavior IS NULL;

  UPDATE benchmarks SET outcome = json_object(
    'dimension', json(resolution),
    'direction', json_extract(shape, '$.direction'),
    'target', json_extract(shape, '$.target')
  ) WHERE json_extract(shape, '$.family') = 'trend'
    AND json_extract(shape, '$.target') IS NOT NULL AND outcome IS NULL;

  UPDATE benchmarks SET outcome = json_object(
    'dimension', json(resolution),
    'direction', json_extract(shape, '$.direction')
  ) WHERE json_extract(shape, '$.family') = 'trend'
    AND json_extract(shape, '$.target') IS NULL AND outcome IS NULL;
`;

export const migration008: Migration = {
  version: 8,
  name: 'benchmark_faces',
  sql: `
    ALTER TABLE benchmarks ADD COLUMN behavior TEXT;
    ALTER TABLE benchmarks ADD COLUMN outcome TEXT;
    ${legacyShapeRewrite}
  `,
};
