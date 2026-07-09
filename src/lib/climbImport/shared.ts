/**
 * shared.ts — the row/session shapes and small helpers boardlib.ts and
 * eightA.ts both need (dimension/earth, Pass E5). Split out after review
 * found the two parsers had independently duplicated the same date-
 * extraction regex, attempts-count clamping, and date-grouping tail —
 * exactly the kind of drift risk the E5 review flagged twice over.
 */
import type { ClimbOutcome } from '@core/observation';

export type ImportedSend = {
  grade: string;
  attempts: number;
  sent: boolean;
  outcome?: ClimbOutcome;
  route?: string;
  raw: Record<string, string>;
};

export type ImportedSession = {
  date: string; // LocalDate 'YYYY-MM-DD'
  sends: ImportedSend[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Only an unambiguous ISO YYYY-MM-DD prefix is trusted. Some exports could
 * plausibly use D/M/Y or M/D/Y; without a documented format, guessing which
 * would risk misdating real history, so anything else is left unparsed.
 */
export function extractLocalDate(cell: string | undefined): string | null {
  const m = cell?.match(DATE_RE);
  return m ? m[0] : null;
}

/**
 * A logged send/attempt implies at least one try happened — 0 isn't a
 * meaningful record here (unlike a real bodyweight or elevation-gain 0, an
 * "attempted 0 times" row is a contradiction, not a fact), so this floors
 * at 1 the same way the manual log-session form already does
 * (src/lib/session.ts: `Math.max(1, Math.round(num(s.attempts) ?? 1))`) —
 * consistent with the already-shipped convention, not a new one.
 */
export function parseAttemptCount(cell: string | undefined): number {
  const n = Number(cell);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

/** Groups sends by date and returns sessions sorted ascending by date. */
export function groupSendsByDate(byDate: Map<string, ImportedSend[]>): ImportedSession[] {
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sends]) => ({ date, sends }));
}
