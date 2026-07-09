/**
 * strongImport.ts — Strong CSV -> ImportedSession[] (Body P5).
 * Format details: __fixtures__/strong-csv/format-spec.md. One row = one set;
 * session identity = group by (Date, Workout Name); no per-set timestamps in
 * any Strong export, so `durationMin` comes from the file's Duration column,
 * never fabricated per-set completedAt.
 *
 * Two variants are both in the wild (detect, don't assume): "classic" (no
 * unit columns, weights are in whatever unit the user's Strong app was set
 * to) and "unit-columns" (adds Weight Unit/Distance Unit per row, often
 * semicolon-delimited on Android). Header-alias matching, never positional —
 * a localized (non-English) export fails clearly rather than misreading columns.
 */
import type { WeightUnit } from './units';
import { displayToKg } from './units';
import { colIndex, parseCsv } from './csv';
import { resolveExerciseName } from './importExerciseResolve';
import { rowKey, type ImportedSession, type ImportedSet, type ImportReport } from './csvImport';

export type StrongParseResult =
  | { status: 'localized-header-error' }
  | { status: 'needs-unit-confirm'; weightUnitHeuristic: WeightUnit; parse: (weightUnit: WeightUnit) => StrongParseResult }
  | { status: 'ok'; sessions: ImportedSession[]; report: ImportReport };

function parseDurationToMinutes(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const hMatch = t.match(/(\d+)\s*h/i);
  const mMatch = t.match(/(\d+)\s*m/i);
  const h = hMatch ? Number(hMatch[1]) : 0;
  const m = mMatch ? Number(mMatch[1]) : 0;
  if (!hMatch && !mMatch) {
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return h * 60 + m;
}

function num(s: string | undefined): number {
  if (s == null || s.trim() === '') return 0;
  const n = Number(s.trim().replace(',', '.')); // tolerate comma-decimals (format-spec.md: cheap to tolerate on ';'-delimited files)
  return Number.isFinite(n) ? n : 0;
}

/** Heuristic file-wide unit guess for Variant A (no per-row unit column) —
 *  prefilled but NEVER applied without the caller's confirmation. */
export function heuristicWeightUnit(weights: number[], appDefault: WeightUnit): WeightUnit {
  const positive = weights.filter((w) => w > 0);
  if (positive.length === 0) return appDefault;
  if (positive.some((w) => w >= 250)) return 'lb'; // format-spec.md: Makros heuristic
  const closeTo = (w: number, step: number) => {
    const r = w % step;
    return Math.min(r, step - r) < 0.05;
  };
  const lbShare = positive.filter((w) => closeTo(w, 5) || closeTo(w, 2.5)).length / positive.length;
  const kgShare = positive.filter((w) => closeTo(w, 2.5) || closeTo(w, 1.25)).length / positive.length;
  if (lbShare === kgShare) return appDefault;
  return lbShare > kgShare ? 'lb' : 'kg';
}

const REST_TIMER_NAMES = new Set(['rest timer', 'rest']);

export function parseStrongCsv(
  raw: string,
  opts: { appDefaultWeightUnit: WeightUnit; weightUnit?: WeightUnit }
): StrongParseResult {
  const { headers, rows } = parseCsv(raw);

  const dateIdx = colIndex(headers, 'date');
  const exerciseIdx = colIndex(headers, 'exercise name');
  if (dateIdx === -1 || exerciseIdx === -1) {
    return { status: 'localized-header-error' };
  }

  const workoutNameIdx = colIndex(headers, 'workout name');
  const durationIdx = colIndex(headers, 'duration', 'workout duration');
  const setOrderIdx = colIndex(headers, 'set order');
  const weightIdx = colIndex(headers, 'weight');
  const weightUnitIdx = colIndex(headers, 'weight unit');
  const repsIdx = colIndex(headers, 'reps');
  const distanceIdx = colIndex(headers, 'distance');
  const secondsIdx = colIndex(headers, 'seconds');
  const notesIdx = colIndex(headers, 'notes');
  const workoutNotesIdx = colIndex(headers, 'workout notes');
  const rpeIdx = colIndex(headers, 'rpe');

  const isVariantB = weightUnitIdx !== -1;
  if (!isVariantB && opts.weightUnit == null) {
    const weights = rows.map((r) => num(r[weightIdx])).filter((w) => w > 0);
    return {
      status: 'needs-unit-confirm',
      weightUnitHeuristic: heuristicWeightUnit(weights, opts.appDefaultWeightUnit),
      parse: (weightUnit) => parseStrongCsv(raw, { ...opts, weightUnit }),
    };
  }
  const fileWideUnit: WeightUnit = opts.weightUnit ?? 'kg';

  const sessionsByKey = new Map<string, ImportedSession>();
  // (date, workout, exercise) -> how many sets of it we've built so far —
  // the dedupe key's uniqueness relies on this, not Set Order (see
  // csvImport.ts's rowKey doc: W/D/F rows share a letter with no index).
  const occurrenceByExercise = new Map<string, number>();
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
    const date = row[dateIdx]?.trim();
    const rawExercise = row[exerciseIdx]?.trim();
    if (!date || !rawExercise) continue; // an unusable row — never fabricate a session identity

    const workoutName = workoutNameIdx !== -1 ? row[workoutNameIdx]?.trim() || 'Workout' : 'Workout';
    const weight = weightIdx !== -1 ? num(row[weightIdx]) : 0;
    // Variant B trusts the per-row cell; a blank/unrecognized cell (a gap in
    // an otherwise unit-columned file) falls back to the app's own display
    // unit rather than silently assuming kg — 'kg' isn't a more honest
    // default than any other unit for a cell that just doesn't say.
    const rawWeightUnit = isVariantB ? row[weightUnitIdx]?.trim().toLowerCase() : undefined;
    const weightUnit: WeightUnit =
      rawWeightUnit === 'lbs' || rawWeightUnit === 'lb'
        ? 'lb'
        : rawWeightUnit === 'kg' || rawWeightUnit === 'kgs'
          ? 'kg'
          : isVariantB
            ? opts.appDefaultWeightUnit
            : fileWideUnit;
    const reps = repsIdx !== -1 ? Math.round(num(row[repsIdx])) : 0;
    const distance = distanceIdx !== -1 ? num(row[distanceIdx]) : 0;
    const seconds = secondsIdx !== -1 ? Math.round(num(row[secondsIdx])) : 0;
    const setOrder = setOrderIdx !== -1 ? row[setOrderIdx]?.trim() : '';
    const rpeRaw = rpeIdx !== -1 ? row[rpeIdx]?.trim() : '';
    const rowNote = notesIdx !== -1 ? row[notesIdx]?.trim() : '';

    if (REST_TIMER_NAMES.has(rawExercise.toLowerCase()) && weight === 0 && reps === 0 && distance === 0) {
      report.restTimerSkipped++;
      continue;
    }
    if (weight === 0 && reps === 0 && distance === 0 && seconds === 0) {
      report.allZeroSkipped++;
      continue;
    }
    if (distance > 0) {
      report.cardioSkipped++;
      continue;
    }

    const sessionKey = `${date}\u0001${workoutName}`;
    let session = sessionsByKey.get(sessionKey);
    if (!session) {
      const durationMin =
        durationIdx !== -1 ? parseDurationToMinutes(row[durationIdx] ?? '') : undefined;
      const fileNotes = workoutNotesIdx !== -1 ? row[workoutNotesIdx]?.trim() || undefined : undefined;
      session = {
        date: new Date(date.replace(' ', 'T') + 'Z').toISOString(),
        workoutName,
        ...(durationMin != null ? { durationMin } : {}),
        sets: [],
        ...(fileNotes ? { fileNotes } : {}),
      };
      sessionsByKey.set(sessionKey, session);
      report.sessionsFound++;
    }

    const weightKg = displayToKg(weight, weightUnit);
    const resolution = resolveExerciseName(rawExercise);
    if (resolution.status === 'ambiguous') ambiguous.add(rawExercise);
    if (resolution.status === 'unmatched') unmatched.add(rawExercise);

    const isWarmup = setOrder.toUpperCase() === 'W';
    const marker =
      setOrder.toUpperCase() === 'D' ? 'Drop set' : setOrder.toUpperCase() === 'F' ? 'Failure set' : undefined;

    let rir: number | undefined;
    if (rpeRaw) {
      const rpe = num(rpeRaw);
      // format-spec.md: RPE is logged 6-10 in 0.5 steps. Out-of-range input
      // (a typo, or a garbage cell) is dropped rather than converted into a
      // nonsensical or negative rir that would get written as fact.
      if (rpe >= 1 && rpe <= 10) {
        rir = 10 - rpe;
        report.rirDerivedFromRpeCount++;
      }
    }

    const occKey = `${date}\u0001${workoutName}\u0001${rawExercise}`;
    const occurrence = occurrenceByExercise.get(occKey) ?? 0;
    occurrenceByExercise.set(occKey, occurrence + 1);

    const set: ImportedSet = {
      exercise: rawExercise,
      ...(resolution.exerciseId ? { exerciseId: resolution.exerciseId } : {}),
      movementPattern: resolution.movementPattern,
      weightKg,
      // A duration-based set (Plank: Seconds>0, Reps 0) has no rep count —
      // never fabricated as 0-with-implied-reps; holdSec carries the fact.
      reps: seconds > 0 && reps === 0 ? 0 : reps,
      ...(seconds > 0 && reps === 0 ? { holdSec: seconds } : {}),
      ...(rir != null ? { rir } : {}),
      ...(isWarmup ? { isWarmup: true } : {}),
      rowKey: rowKey({ date, workoutName, exercise: rawExercise, occurrence, weightKg, reps }),
      ...(marker ? { marker } : {}),
    };
    session.sets.push(set);
    report.setsImported++;
    void rowNote; // per-row Notes aren't carried structurally (no per-set note field) — session-level marker lines cover D/F; free-text set Notes are a v2 follow-up, not silently dropped data loss of a FACT (weight/reps still import).
  }

  report.ambiguousExercises = [...ambiguous];
  report.unmatchedExercises = [...unmatched];

  return { status: 'ok', sessions: [...sessionsByKey.values()], report };
}
