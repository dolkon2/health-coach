/**
 * buildSessions.ts — turns parsed CSV rows (boardlib.ts / eightA.ts) into
 * real session Observations (dimension/earth, Pass E5).
 *
 * Owns all the climbing-domain judgment calls so the two parsers stay pure
 * CSV-dialect readers: which style to tag a session with, which grade scale
 * a string belongs to, what fidelity an import earns. Pure and DI'd (id/now
 * factories, caller-supplied existing dates) so it's testable without
 * storage or Date.now() — same shape as buildSessionObservation.
 *
 * ⚑ E-16 decisions:
 * - Idempotency is by (platform, date), decided by the CALLER (app/
 *   settings.tsx builds `existingDates` from only THIS platform's prior
 *   imports) — never merged or overwritten, whole-date skip. Review caught
 *   an earlier draft that scoped this to "any climbing session that day"
 *   regardless of source: that would silently discard a real hand-logged
 *   gym session on a day a later BoardLib import also covers, since both
 *   would collide on the same date key. Scoping to (platform, date) fixes
 *   that while still making a same-file re-import a no-op.
 * - BoardLib sessions are always tagged 'boulder' — Aurora/Moon boards are
 *   exclusively bouldering apparatus, a certain fact, not an inference.
 * - 8a.nu mixes route and boulder climbing in one export with no reliable
 *   per-row discipline column (research: "gym + outdoor in one logbook").
 *   Style is inferred per date-group by a majority vote of which grade scale
 *   each row's grade string matches with NO bias (core/climbGrade.ts tries
 *   boulder scales first when unbiased) — a genuine tie (including 0-0, when
 *   nothing is unambiguous) resolves to 'gym', the same style the manual log
 *   form and climbGrade.ts already use for "mixed/unknown discipline" rather
 *   than fabricating a confident 'sport' label the data doesn't support.
 */
import type { ClimbingBlock, ObservationOf } from '@core/observation';
import { parseClimbGrade } from '@core/climbGrade';
import { noonOfLocalDate } from '../date';
import { type ImportedSend, type ImportedSession } from './shared';

export type { ImportedSend, ImportedSession } from './shared';

export type ImportPlatform = 'boardlib' | '8a.nu';

// boardlib: structured, board-verified data — same tier as a device-recorded
// GPX import (0.9). 8a.nu: self-reported personal logbook through an
// unverified column-alias mapping (⚑ E-12) — meaningfully lower.
const PLATFORM_FIDELITY: Record<ImportPlatform, number> = {
  boardlib: 0.9,
  '8a.nu': 0.65,
};

// Only V-scale ("V4") and YDS ("5.10a") have a prefix distinctive enough to
// be unambiguous signals on their own. Font and French share IDENTICAL
// notation ("7a") by design of both systems — a no-bias parseClimbGrade call
// would match Font first every time (core/climbGrade.ts tries boulder scales
// before route scales when unbiased), so counting THOSE as boulder "votes"
// would make every ambiguous grade vote boulder regardless of the truth.
// Ambiguous or unrecognized grades cast no vote either way.
const VSCALE_PREFIX = /^vb$|^v[0-9]/i;
const YDS_PREFIX = /^5\./;

function inferSessionStyle(sends: ImportedSend[]): ClimbingBlock['style'] {
  let boulderVotes = 0;
  let routeVotes = 0;
  for (const s of sends) {
    const grade = s.grade.trim();
    if (VSCALE_PREFIX.test(grade)) boulderVotes += 1;
    else if (YDS_PREFIX.test(grade)) routeVotes += 1;
  }
  if (boulderVotes > routeVotes) return 'boulder';
  if (routeVotes > boulderVotes) return 'sport';
  return 'gym'; // genuine tie (including 0-0) — honestly "mixed/unknown", not a guess
}

export type BuildImportedSessionsContext = {
  now: string; // ISO instant
  tz: string;
  filename?: string;
  idFactory: () => string;
  // LocalDates this platform has already imported a climbing session for —
  // skipped whole, never merged (see module doc). The caller decides scope;
  // this function just trusts the set it's given.
  existingDates: ReadonlySet<string>;
};

export type BuildImportedSessionsResult = {
  observations: ObservationOf<'session'>[];
  skippedDates: string[];
};

export function buildImportedClimbingSessions(
  sessions: ImportedSession[],
  platform: ImportPlatform,
  ctx: BuildImportedSessionsContext
): BuildImportedSessionsResult {
  const observations: ObservationOf<'session'>[] = [];
  const skippedDates: string[] = [];
  const fidelity = PLATFORM_FIDELITY[platform];

  for (const session of sessions) {
    if (ctx.existingDates.has(session.date)) {
      skippedDates.push(session.date);
      continue;
    }
    const style = platform === 'boardlib' ? 'boulder' : inferSessionStyle(session.sends);
    const sends: ClimbingBlock['sends'] = session.sends.map((s) => {
      const gradeSystem = parseClimbGrade(s.grade, style);
      return {
        grade: s.grade,
        ...(gradeSystem ? { gradeSystem } : {}),
        attempts: s.attempts,
        sent: s.sent,
        ...(s.outcome ? { outcome: s.outcome } : {}),
        ...(s.route ? { route: s.route } : {}),
        raw: s.raw,
      };
    });
    observations.push({
      id: ctx.idFactory(),
      kind: 'session',
      occurredAt: noonOfLocalDate(session.date),
      loggedAt: ctx.now,
      tz: ctx.tz,
      tier: 1,
      fidelity,
      source: {
        type: 'fileimport',
        format: 'csv',
        platform,
        ...(ctx.filename ? { filename: ctx.filename } : {}),
      },
      payload: {
        kind: 'session',
        activity: 'climb',
        modality: 'climb',
        climbing: { style, sends },
      },
    });
  }

  return { observations, skippedDates };
}
