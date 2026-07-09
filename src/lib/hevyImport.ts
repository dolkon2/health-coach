/**
 * hevyImport.ts — Hevy CSV -> ImportedSession[] (Body P5).
 * Format details: __fixtures__/strong-csv/format-spec.md ("Hevy CSV" §).
 * One row = one set, already grouped by (title, start_time) — Hevy's own
 * session identity, no separate "workout name" concept to key on. Units
 * live in the COLUMN NAME (weight_kg vs weight_lbs), never a prompt.
 * superset_id is read but dropped this round (v1 — no schema support for
 * supersets, and none needed descriptively per format-spec.md).
 */
import { colIndex, parseCsv } from './csv';
import { displayToKg } from './units';
import { resolveExerciseName } from './importExerciseResolve';
import { rowKey, type ImportedSession, type ImportedSet, type ImportReport } from './csvImport';

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** "22 Dec 2025, 08:00" -> ISO instant (treated as UTC — Hevy's export
 *  carries no timezone; best-effort, flagged). */
function parseHevyDate(s: string): string | undefined {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4}),\s*(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const [, dayStr, monStr, yearStr, hStr, minStr] = m;
  const month = MONTHS[monStr.toLowerCase().slice(0, 3)];
  if (month == null) return undefined;
  const date = new Date(
    Date.UTC(Number(yearStr), month, Number(dayStr), Number(hStr), Number(minStr))
  );
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function num(s: string | undefined): number {
  if (s == null || s.trim() === '') return 0;
  const n = Number(s.trim());
  return Number.isFinite(n) ? n : 0;
}

export type HevyParseResult =
  | { status: 'header-error' }
  | { status: 'ok'; sessions: ImportedSession[]; report: ImportReport };

export function parseHevyCsv(raw: string): HevyParseResult {
  const { headers, rows } = parseCsv(raw);

  const titleIdx = colIndex(headers, 'title');
  const startIdx = colIndex(headers, 'start_time');
  const exerciseIdx = colIndex(headers, 'exercise_title');
  if (titleIdx === -1 || startIdx === -1 || exerciseIdx === -1) {
    return { status: 'header-error' };
  }

  const endIdx = colIndex(headers, 'end_time');
  const descriptionIdx = colIndex(headers, 'description');
  const setTypeIdx = colIndex(headers, 'set_type');
  const rpeIdx = colIndex(headers, 'rpe');
  const distanceKmIdx = colIndex(headers, 'distance_km');
  const distanceMiIdx = colIndex(headers, 'distance_miles');
  const durationSecIdx = colIndex(headers, 'duration_seconds');

  // Unit lives in the column name — whichever of the pair is present.
  const weightKgIdx = colIndex(headers, 'weight_kg');
  const weightLbIdx = colIndex(headers, 'weight_lbs', 'weight_lb');
  const weightIdx = weightKgIdx !== -1 ? weightKgIdx : weightLbIdx;
  const weightIsKg = weightKgIdx !== -1;
  const repsIdx = colIndex(headers, 'reps');
  const distanceIdx = distanceKmIdx !== -1 ? distanceKmIdx : distanceMiIdx;

  const sessionsByKey = new Map<string, ImportedSession>();
  const report: ImportReport = {
    sessionsFound: 0,
    setsImported: 0,
    cardioSkipped: 0,
    restTimerSkipped: 0,
    allZeroSkipped: 0,
    ambiguousExercises: [],
    unmatchedExercises: [],
    rirDerivedFromRpeCount: 0,
  };
  const ambiguous = new Set<string>();
  const unmatched = new Set<string>();

  for (const row of rows) {
    const title = row[titleIdx]?.trim();
    const startRaw = row[startIdx]?.trim();
    const rawExercise = row[exerciseIdx]?.trim();
    if (!title || !startRaw || !rawExercise) continue;

    const weight = weightIdx !== -1 ? num(row[weightIdx]) : 0;
    const reps = repsIdx !== -1 ? Math.round(num(row[repsIdx])) : 0;
    const distance = distanceIdx !== -1 ? num(row[distanceIdx]) : 0;
    const seconds = durationSecIdx !== -1 ? Math.round(num(row[durationSecIdx])) : 0;
    const setType = setTypeIdx !== -1 ? row[setTypeIdx]?.trim().toLowerCase() : '';
    const rpeRaw = rpeIdx !== -1 ? row[rpeIdx]?.trim() : '';

    if (weight === 0 && reps === 0 && distance === 0 && seconds === 0) {
      report.allZeroSkipped++;
      continue;
    }
    if (distance > 0) {
      report.cardioSkipped++;
      continue;
    }

    const start = parseHevyDate(startRaw);
    if (!start) continue; // an unparseable date is an unusable row — skip, never fabricate a date

    const sessionKey = `${start}\u0001${title}`;
    let session = sessionsByKey.get(sessionKey);
    if (!session) {
      const end = endIdx !== -1 ? parseHevyDate(row[endIdx]?.trim() ?? '') : undefined;
      const durationMin =
        end != null ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : undefined;
      const fileNotes = descriptionIdx !== -1 ? row[descriptionIdx]?.trim() || undefined : undefined;
      session = {
        date: start,
        workoutName: title,
        ...(durationMin != null && durationMin > 0 ? { durationMin } : {}),
        sets: [],
        ...(fileNotes ? { fileNotes } : {}),
      };
      sessionsByKey.set(sessionKey, session);
      report.sessionsFound++;
    }

    const weightKg = weightIsKg ? weight : displayToKg(weight, 'lb');
    const resolution = resolveExerciseName(rawExercise);
    if (resolution.status === 'ambiguous') ambiguous.add(rawExercise);
    if (resolution.status === 'unmatched') unmatched.add(rawExercise);

    const isWarmup = setType === 'warmup';
    const marker = setType === 'failure' ? 'Failure set' : setType === 'dropset' ? 'Drop set' : undefined;

    let rir: number | undefined;
    if (rpeRaw) {
      const rpe = num(rpeRaw);
      if (rpe > 0) {
        rir = 10 - rpe;
        report.rirDerivedFromRpeCount++;
      }
    }

    const set: ImportedSet = {
      exercise: rawExercise,
      ...(resolution.exerciseId ? { exerciseId: resolution.exerciseId } : {}),
      movementPattern: resolution.movementPattern,
      weightKg,
      reps: seconds > 0 && reps === 0 ? 0 : reps,
      ...(seconds > 0 && reps === 0 ? { holdSec: seconds } : {}),
      ...(rir != null ? { rir } : {}),
      ...(isWarmup ? { isWarmup: true } : {}),
      rowKey: rowKey({
        date: start,
        workoutName: title,
        exercise: rawExercise,
        setOrder: setType || '',
        weightKg,
        reps,
      }),
      ...(marker ? { marker } : {}),
    };
    session.sets.push(set);
    report.setsImported++;
  }

  report.ambiguousExercises = [...ambiguous];
  report.unmatchedExercises = [...unmatched];

  return { status: 'ok', sessions: [...sessionsByKey.values()], report };
}
