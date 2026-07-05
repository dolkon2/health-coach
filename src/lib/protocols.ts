/**
 * protocols.ts — the user's own home-exercise plan ("My plan"), as they recorded it.
 *
 * A protocol is whatever the user (or their physio, offline, out of band)
 * decided; the app is the notebook, not the clinician. It never generates,
 * suggests, or modifies exercises, targets, or frequencies — informational and
 * non-diagnostic by design (FDA General Wellness safe harbor; the naming rules
 * in the PT capture spec are binding: no rehab-, rx-, therapy-, or compliance-
 * prefixed identifiers, in code or in copy).
 *
 * Storage: one settings-KV blob (migration 009 table) via storage/settings.ts —
 * ids are stable uuids, names are denormalized for display, and archived
 * protocols are never deleted so history stays honest. Daily "did it" ticks are
 * subjective Observations (metric 'protocolTick'), handled by
 * storage/protocolTicks.ts; adherence is derived at render, never stored.
 *
 * Pure types + lookups: no React, no storage (matches lib/session.ts).
 */
import type { ISOInstant } from '@core/observation';

export type ProtocolExercise = {
  id: string; // uuid — stable; ticks reference it
  name: string; // one free-text line, the user's words ("clamshells 3x15 each side")
  targetPerWeek: number; // integer >= 1 — the USER's own target, never generated
};

export type UserProtocol = {
  id: string; // uuid
  name: string; // user's words, e.g. "Knee routine from Sarah"
  exercises: ProtocolExercise[];
  createdAt: ISOInstant;
  archivedAt?: ISOInstant; // archived, never deleted — history stays honest
};

/** The settings-KV blob shape under the 'userProtocols' key. */
export type UserProtocolsBlob = { protocols: UserProtocol[] };

/** Protocols still in play — archived ones stay stored but leave the daily list. */
export function activeProtocols(all: UserProtocol[]): UserProtocol[] {
  return all.filter((p) => p.archivedAt == null);
}

/**
 * The first reason a protocol can't be saved, or null. An exercise with no
 * target is just a note, not a plan line — targetPerWeek must be an integer >= 1
 * (pt capture spec §2); every line needs the user's own words.
 */
export function validateProtocol(p: Pick<UserProtocol, 'name' | 'exercises'>): string | null {
  if (p.name.trim() === '') return 'Name the plan.';
  if (p.exercises.length === 0) return 'Add at least one exercise.';
  for (const ex of p.exercises) {
    if (ex.name.trim() === '') return 'Name each exercise.';
    if (!Number.isInteger(ex.targetPerWeek) || ex.targetPerWeek < 1) {
      return 'Times per week is a whole number, at least 1.';
    }
  }
  return null;
}
