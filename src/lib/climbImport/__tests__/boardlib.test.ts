/**
 * The Proof — parseBoardLibCsv, against a fixture matching the VERIFIED
 * LOGBOOK_FIELDS shape (source-read 2026-07-09, not the paraphrase in
 * climbing-apps-research.md):
 *   1. Rows group by date into sessions, sorted ascending.
 *   2. logged_grade wins over displayed_grade when both are present; a bid
 *      row (no logged_grade) falls back to displayed_grade.
 *   3. is_ascent === 'True' (exact) drives sent; anything else is false.
 *   4. A row with no usable grade (both grade columns blank) is skipped and
 *      counted, never fabricated as an empty-string grade.
 *   5. The full original row survives verbatim in `raw`, including a
 *      comment with an embedded comma (proves CSV quoting round-trips).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { looksLikeBoardLibCsv, parseBoardLibCsv } from '../boardlib';
import { parseCsv } from '../csv';

const FX = join(__dirname, '..', '__fixtures__');
const SAMPLE = readFileSync(join(FX, 'boardlib-sample.csv'), 'utf8');

describe('looksLikeBoardLibCsv', () => {
  it('recognizes the real LOGBOOK_FIELDS header', () => {
    const { header } = parseCsv(SAMPLE);
    expect(looksLikeBoardLibCsv(header)).toBe(true);
  });

  it('rejects an unrelated header', () => {
    expect(looksLikeBoardLibCsv(['grade', 'date', 'route'])).toBe(false);
  });
});

describe('parseBoardLibCsv', () => {
  it('groups rows into two sessions by date, ascending', () => {
    const { sessions } = parseBoardLibCsv(SAMPLE);
    expect(sessions.map((s) => s.date)).toEqual(['2026-06-01', '2026-06-08']);
    expect(sessions[0].sends).toHaveLength(3);
    expect(sessions[1].sends).toHaveLength(2); // the 3rd 2026-06-08 row has no grade -> skipped
  });

  it('prefers logged_grade over displayed_grade, falls back when logged_grade is blank', () => {
    const { sessions } = parseBoardLibCsv(SAMPLE);
    const [ascent, bid] = sessions[0].sends;
    expect(ascent).toMatchObject({ grade: 'V5', route: 'Purple Reign', attempts: 3, sent: true });
    expect(bid).toMatchObject({ grade: 'V6', route: 'Sloper Problem', attempts: 4, sent: false });
  });

  it('is_ascent drives sent by "True" match', () => {
    const { sessions } = parseBoardLibCsv(SAMPLE);
    const mirroredBid = sessions[0].sends[2];
    expect(mirroredBid.sent).toBe(false);
    const warmup = sessions[1].sends[0];
    expect(warmup.sent).toBe(true);
  });

  it('trims stray whitespace around is_ascent before comparing (a hand-edited CSV could carry it)', () => {
    const csv =
      'board,angle,climb_name,date,logged_grade,displayed_grade,is_benchmark,tries,is_mirror,sessions_count,tries_total,is_repeat,is_ascent,comment\n' +
      'kilter,40,Space Padded,2026-06-15 10:00:00,V3,V3,False,1,False,1,1,False, True ,\n';
    const { sessions } = parseBoardLibCsv(csv);
    expect(sessions[0].sends[0].sent).toBe(true);
  });

  it('skips a row with no usable grade and counts it', () => {
    const { skippedRows } = parseBoardLibCsv(SAMPLE);
    expect(skippedRows).toBe(1);
  });

  it('preserves the full original row verbatim in raw, including a comma inside a quoted comment', () => {
    const { sessions } = parseBoardLibCsv(SAMPLE);
    const ascent = sessions[0].sends[0];
    expect(ascent.raw.comment).toBe('felt great, first try on the crimp');
    expect(ascent.raw.board).toBe('kilter');
    expect(ascent.raw.angle).toBe('40');
    expect(ascent.raw.is_mirror).toBe('False');
  });
});
