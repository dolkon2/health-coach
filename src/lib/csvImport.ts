/**
 * csvImport.ts — shared types + dedupe + storage write for Strong/Hevy CSV
 * import (Body P5). strongImport.ts and hevyImport.ts each parse their own
 * file format into these shared shapes; this module is format-agnostic from
 * here on.
 *
 * Dedupe (idempotent re-import): adds NO table. Each source row gets a
 * deterministic key — the composite tuple itself (date, workout, exercise,
 * set order, weight, reps), not a hash — stored in the session's
 * `source.rowHashes` (payload/source JSON, no migration). A re-import
 * re-derives the set of previously-seen keys from every existing
 * 'strong-csv'/'hevy-csv' session and drops any row whose key is already
 * there; a session left with zero new rows after that is skipped entirely.
 * A plain composite string is deliberately used instead of an actual hash
 * function — no compaction is needed here, and it carries zero collision
 * risk (a real hash would trade safety for nothing, on an import that runs
 * once in a while, not a hot path).
 */
import type { ISOInstant, MovementPattern, ObservationOf } from '@core/observation';
import { createObservation, listObservations } from '@/storage/observations';
import type { SqlDatabase } from '@/storage/db';

export type ImportedSet = {
  exercise: string;
  exerciseId?: string;
  movementPattern: MovementPattern;
  weightKg: number;
  reps: number;
  holdSec?: number;
  rir?: number;
  isWarmup?: boolean;
  /** Deterministic dedupe key for this source row — see file header. */
  rowKey: string;
  /** e.g. "Drop set" / "Failure set" — folded into session notes at write
   *  time (LiftingBlock sets carry no per-set note field). */
  marker?: string;
};

export type ImportedSession = {
  date: ISOInstant;
  workoutName: string;
  durationMin?: number;
  sets: ImportedSet[];
  fileNotes?: string; // workout-level notes from the source file
};

export type ImportReport = {
  sessionsFound: number;
  setsImported: number;
  cardioSkipped: number;
  restTimerSkipped: number;
  allZeroSkipped: number;
  /** Raw names that resolved 0.75-0.90 — surfaced for user confirmation; the
   *  import already proceeded with pattern 'other' for these. */
  ambiguousExercises: string[];
  /** Raw names that matched nothing at all — imported as custom/'other'. */
  unmatchedExercises: string[];
  rirDerivedFromRpeCount: number;
};

/** \u0001-separated so field values can't accidentally merge into a
 *  colliding key (same convention as session.ts's exercise-group key). */
export function rowKey(fields: {
  date: string;
  workoutName: string;
  exercise: string;
  setOrder: string;
  weightKg: number;
  reps: number;
}): string {
  return [fields.date, fields.workoutName, fields.exercise, fields.setOrder, fields.weightKg, fields.reps].join(
    '\u0001'
  );
}

export type ImportWriteResult = {
  sessionsWritten: number;
  setsWritten: number;
  sessionsSkippedAsFullDuplicate: number;
};

/**
 * Writes imported sessions to storage, skipping rows already imported by a
 * prior run (any 'strong-csv'/'hevy-csv' session already in storage).
 */
export async function applyCsvImport(
  sessions: ImportedSession[],
  format: 'strong-csv' | 'hevy-csv',
  filename: string | undefined,
  ctx: { idFactory: () => string; tz: string; loggedAt?: ISOInstant },
  db?: SqlDatabase
): Promise<ImportWriteResult> {
  const existing = await listObservations({ kinds: ['session'] }, db);
  const seen = new Set<string>();
  for (const o of existing) {
    if (o.source.type === 'fileimport' && (o.source.format === 'strong-csv' || o.source.format === 'hevy-csv')) {
      for (const k of o.source.rowHashes ?? []) seen.add(k);
    }
  }

  let sessionsWritten = 0;
  let setsWritten = 0;
  let sessionsSkippedAsFullDuplicate = 0;

  for (const session of sessions) {
    const newSets = session.sets.filter((s) => !seen.has(s.rowKey));
    if (newSets.length === 0) {
      sessionsSkippedAsFullDuplicate++;
      continue;
    }
    for (const s of newSets) seen.add(s.rowKey); // guard against dupes within the same import batch

    const markerLines = newSets
      .filter((s) => s.marker)
      .map((s) => `${s.marker}: ${s.exercise}`);
    const notes = [session.fileNotes, ...markerLines].filter(Boolean).join('\n');

    const obs: ObservationOf<'session'> = {
      id: ctx.idFactory(),
      kind: 'session',
      occurredAt: session.date,
      loggedAt: ctx.loggedAt ?? new Date().toISOString(),
      tz: ctx.tz,
      tier: 1,
      // Matches the GPX-import precedent (session.ts SURFACE_FIDELITY gps
      // fileimport = 0.9): a file the source app recorded set-by-set, higher
      // trust than a manually typed entry but not the live in-app logger's
      // own 0.95 (no per-set timestamps survive the export).
      fidelity: 0.9,
      source: {
        type: 'fileimport',
        format,
        ...(filename ? { filename } : {}),
        rowHashes: newSets.map((s) => s.rowKey),
      },
      payload: {
        kind: 'session',
        modality: 'gym',
        activity: 'gym',
        ...(session.durationMin != null ? { durationMin: session.durationMin } : {}),
        lifting: {
          sets: newSets.map((s) => ({
            exercise: s.exercise,
            ...(s.exerciseId ? { exerciseId: s.exerciseId } : {}),
            movementPattern: s.movementPattern,
            weightKg: s.weightKg,
            reps: s.reps,
            ...(s.holdSec != null ? { holdSec: s.holdSec } : {}),
            ...(s.rir != null ? { rir: s.rir } : {}),
            ...(s.isWarmup ? { isWarmup: true } : {}),
          })),
        },
      },
      ...(notes ? { notes } : {}),
    };
    await createObservation(obs, db);
    sessionsWritten++;
    setsWritten += newSets.length;
  }

  return { sessionsWritten, setsWritten, sessionsSkippedAsFullDuplicate };
}
