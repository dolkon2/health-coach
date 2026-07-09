/**
 * eightA.ts — best-effort parser for 8a.nu / Vertical-Life's "Logbook Export
 * (CSV)" (Profile -> Edit -> Logbook Export) (dimension/earth, Pass E5).
 *
 * ⚑ E-12 (dev-log/dimension-earth-build.md) already flagged this: "8a.nu
 * columns are undocumented anywhere — parser is built tolerant, from
 * web-researched samples, flagged if confidence is low." Confirmed again
 * this pass — no official column reference exists; theCrag's own import-from-
 * 8a help page (a downstream consumer that MUST know the exact format) 403s
 * anonymous fetches. Triangulated from three independent secondary sources
 * (a market-research summary citing grade/date/route/crag/sector/country/
 * style/flags/stars/comments; a scraped-dataset analysis of the underlying
 * ascent/method tables; and climbing-apps-research.md's own convergent-
 * findings read of the export). Where sources agreed, trusted; where they
 * didn't, this parser stays permissive rather than confidently wrong.
 *
 * `route` is matched against name/route-name/ascent aliases only — NOT
 * `crag` (a climbing area is not a route; an earlier draft conflated them,
 * which review caught: on a header ordering crag before a real route column,
 * naive first-match aliasing would have silently mislabeled every route as
 * its crag).
 *
 * Because 8a.nu's product is a per-ascent scorecard (not a bids-and-ascents
 * log like BoardLib — research: "Per-ascent: type, attempts, grade proposal,
 * quality, comment"), every row is treated as a send (sent:true) by default;
 * `outcome` is only set when a recognizable style keyword is found in a style
 * column, never guessed from format alone. Non-send keywords ('attempt',
 * 'fell'/'hang') are checked BEFORE clean-send keywords so a compound value
 * like "Flash attempt" reads as the more conservative attempt, not a flash.
 * Header matching is case-insensitive and tries several plausible aliases
 * per field, since the exact column names are the unverified part.
 */
import { parseCsv, rowToRecord } from './csv';
import { extractLocalDate, groupSendsByDate, parseAttemptCount } from './shared';
import type { ImportedSend, ImportedSession } from './shared';
import type { ClimbOutcome } from '@core/observation';

export type EightAImportResult = {
  sessions: ImportedSession[]; // grouped by date, ascending
  skippedRows: number; // no usable date or grade
};

const FIELD_ALIASES: Record<string, string[]> = {
  date: ['date', 'ascent date', 'ascent_date'],
  grade: ['grade', 'french grade', 'grade_french', 'fra_routes', 'fra_boulders'],
  route: ['route', 'name', 'route name', 'ascent'],
  style: ['style', 'type', 'ascent type', 'ascent_type', 'method'],
  attempts: ['attempts', 'tries', 'try_count'],
};

/** True if the header row plausibly matches an 8a.nu-shaped export: at minimum a date and a grade column, by any known alias. */
export function looksLike8aCsv(header: string[]): boolean {
  const normalized = header.map((h) => h.trim().toLowerCase());
  const has = (field: string) => FIELD_ALIASES[field].some((alias) => normalized.includes(alias));
  return has('date') && has('grade');
}

/** Finds the first header cell (by original casing) matching any alias for `field`. */
function findColumn(header: string[], field: string): string | null {
  const aliases = FIELD_ALIASES[field];
  return header.find((h) => aliases.includes(h.trim().toLowerCase())) ?? null;
}

// Non-send keywords first: a compound or ambiguous value ("Flash attempt")
// should read as the more conservative "didn't send" rather than the send
// style it also happens to mention.
const OUTCOME_KEYWORDS: Array<[string, ClimbOutcome]> = [
  ['attempt', 'attempt'],
  ['fell', 'fell-hung'],
  ['hang', 'fell-hung'],
  ['onsight', 'onsight'],
  ['flash', 'flash'],
  ['redpoint', 'redpoint'],
  ['pinkpoint', 'pinkpoint'],
];

function matchOutcome(cell: string | undefined): ClimbOutcome | undefined {
  if (!cell) return undefined;
  const lower = cell.trim().toLowerCase();
  for (const [keyword, outcome] of OUTCOME_KEYWORDS) {
    if (lower.includes(keyword)) return outcome;
  }
  return undefined;
}

export function parse8aCsv(text: string): EightAImportResult {
  const { header, rows } = parseCsv(text);
  const dateCol = findColumn(header, 'date');
  const gradeCol = findColumn(header, 'grade');
  const routeCol = findColumn(header, 'route');
  const styleCol = findColumn(header, 'style');
  const attemptsCol = findColumn(header, 'attempts');

  const byDate = new Map<string, ImportedSend[]>();
  let skippedRows = 0;

  for (const row of rows) {
    const rec = rowToRecord(header, row);
    const date = dateCol ? extractLocalDate(rec[dateCol]) : null;
    const grade = gradeCol ? rec[gradeCol]?.trim() : '';
    if (!date || !grade) {
      skippedRows += 1;
      continue;
    }
    const outcome = styleCol ? matchOutcome(rec[styleCol]) : undefined;
    const route = routeCol ? rec[routeCol]?.trim() : undefined;
    const send: ImportedSend = {
      grade,
      // No attempts-shaped column at all -> defaults to 1 (see
      // parseAttemptCount's doc: a logged send implies at least one try;
      // this is a floor, not a measured count, same as the manual form).
      attempts: attemptsCol ? parseAttemptCount(rec[attemptsCol]) : 1,
      // A style keyword of 'attempt' or 'fell-hung' means this specific row
      // is a bid, not a send — everything else (a recognized clean-send
      // style, or no style column at all) defaults to sent:true, since 8a.nu
      // is a per-ascent scorecard by product design (see module doc).
      sent: outcome !== 'attempt' && outcome !== 'fell-hung',
      ...(outcome ? { outcome } : {}),
      ...(route ? { route } : {}),
      raw: rec,
    };
    const existing = byDate.get(date);
    if (existing) existing.push(send);
    else byDate.set(date, [send]);
  }

  return { sessions: groupSendsByDate(byDate), skippedRows };
}
