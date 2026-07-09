/**
 * boardlib.ts — parses the CSV `boardlib logbook <board> -u <user> -o out.csv`
 * produces (dimension/earth, Pass E5).
 *
 * BoardLib (MIT, github.com/lemeryfertitta/BoardLib) pulls a user's own
 * Kilter/Tension/Moon board logbook via their own credentials — all client-
 * side, no API call from this app. The promised recon doc for this format
 * didn't exist any more than sandbag's did (⚑ E-12/E-14 pattern repeats), so
 * this parser is grounded directly in the installed tool's source (verified
 * against `src/boardlib/__main__.py` and `src/boardlib/api/aurora.py`,
 * 2026-07-09, and independently re-verified against the live GitHub repo
 * during code review), not the paraphrase in climbing-apps-research.md:
 *
 *   LOGBOOK_FIELDS = (board, angle, climb_name, date, logged_grade,
 *     displayed_grade, is_benchmark, tries, is_mirror, sessions_count,
 *     tries_total, is_repeat, is_ascent, comment)
 *
 * Load-bearing facts verified from source, not assumed:
 * - One row = one distinct climb attempted on one distinct day (already
 *   grouped by BoardLib itself: climb_uuid + date + is_mirror + angle).
 *   `tries` is the combined ascent+bid attempt count for that row.
 * - `is_ascent` genuinely distinguishes a send from a bid (an unsent
 *   attempt) — the CLI help text says the command downloads "ascents and
 *   bids". Booleans are Python's `str(bool)`: "True"/"False", exact case.
 * - `logged_grade` is the climber's OWN proposed grade, populated only on an
 *   ascent (bids carry `None` -> ''); `displayed_grade` is the board's
 *   canonical grade, always populated. Preferring `logged_grade` when
 *   present means preferring the climber's own opinion over the board's,
 *   same principle as climbing-apps-research.md's "personal grade opinion
 *   beside consensus" finding — just resolved to one field since this app
 *   doesn't carry a dual-grade UI yet.
 * - `sessions_count`/`tries_total`/`is_repeat` are PER-CLIMB lifetime
 *   aggregates (grouped by climb_name+is_mirror+angle across ALL dates, not
 *   per-session) — not meaningful as structured fields here; kept in `raw`
 *   for audit only.
 * - Aurora/Moon boards are exclusively bouldering apparatus, so grade
 *   parsing is always biased 'boulder' (core/climbGrade.ts).
 *
 * Not defended: `boardlib logbook --no-headers` (an opt-in CLI flag this
 * app's own instructions won't tell Dylan to use) would make the first data
 * row look like a header. Flagged, not coded around.
 */
import { parseCsv, rowToRecord } from '../csv';
import { extractLocalDate, groupSendsByDate, parseAttemptCount } from './shared';
import type { ImportedSend, ImportedSession } from './shared';

export type BoardLibImportResult = {
  sessions: ImportedSession[]; // grouped by date, ascending
  skippedRows: number; // no usable date, climb name, or grade
};

const REQUIRED_HEADERS = ['climb_name', 'date', 'tries', 'is_ascent'];

/** Whether a CSV's header row looks like a BoardLib logbook export. */
export function looksLikeBoardLibCsv(header: string[]): boolean {
  return REQUIRED_HEADERS.every((h) => header.includes(h));
}

export function parseBoardLibCsv(text: string): BoardLibImportResult {
  const { header, rows } = parseCsv(text);
  const byDate = new Map<string, ImportedSend[]>();
  let skippedRows = 0;

  for (const row of rows) {
    const rec = rowToRecord(header, row);
    const date = extractLocalDate(rec.date);
    const route = rec.climb_name?.trim();
    const grade = (rec.logged_grade?.trim() || rec.displayed_grade?.trim()) ?? '';
    if (!date || !route || !grade) {
      skippedRows += 1;
      continue;
    }
    const send: ImportedSend = {
      grade,
      attempts: parseAttemptCount(rec.tries),
      sent: rec.is_ascent?.trim() === 'True',
      route,
      raw: rec,
    };
    const existing = byDate.get(date);
    if (existing) existing.push(send);
    else byDate.set(date, [send]);
  }

  return { sessions: groupSendsByDate(byDate), skippedRows };
}
