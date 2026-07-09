/**
 * The Proof — parse8aCsv against a plausible (unverified, ⚑ E-12) export
 * shape:
 *   1. Style keywords map to a real ClimbOutcome; 'attempt' and unrecognized
 *      text both leave sent honestly derived (attempt -> false, others ->
 *      per-outcome), never guessed beyond what the text says.
 *   2. A row with no grade or date is skipped and counted.
 *   3. attempts defaults to 1 when no attempts-shaped column exists.
 *   4. raw carries the full original row for audit.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { looksLike8aCsv, parse8aCsv } from '../eightA';
import { parseCsv } from '../csv';

const FX = join(__dirname, '..', '__fixtures__');
const SAMPLE = readFileSync(join(FX, 'eightA-sample.csv'), 'utf8');

describe('looksLike8aCsv', () => {
  it('recognizes a header with date + grade columns', () => {
    const { header } = parseCsv(SAMPLE);
    expect(looksLike8aCsv(header)).toBe(true);
  });

  it('rejects a header with neither', () => {
    expect(looksLike8aCsv(['foo', 'bar'])).toBe(false);
  });
});

describe('parse8aCsv', () => {
  it('groups rows into two sessions by date, ascending', () => {
    const { sessions } = parse8aCsv(SAMPLE);
    expect(sessions.map((s) => s.date)).toEqual(['2026-05-10', '2026-05-17']);
    expect(sessions[0].sends).toHaveLength(3);
    expect(sessions[1].sends).toHaveLength(1);
  });

  it('maps a recognized style keyword to outcome and derives sent honestly', () => {
    const { sessions } = parse8aCsv(SAMPLE);
    const [onsight, redpoint, attempt] = sessions[0].sends;
    expect(onsight).toMatchObject({ outcome: 'onsight', sent: true, grade: '7a' });
    expect(redpoint).toMatchObject({ outcome: 'redpoint', sent: true, grade: '7b+' });
    expect(attempt).toMatchObject({ outcome: 'attempt', sent: false, grade: '6c' });
  });

  it('defaults attempts to 1 when no attempts column exists', () => {
    const { sessions } = parse8aCsv(SAMPLE);
    expect(sessions[0].sends[0].attempts).toBe(1);
  });

  it('preserves the original row verbatim in raw', () => {
    const { sessions } = parse8aCsv(SAMPLE);
    expect(sessions[0].sends[1].raw.comments).toBe('took 5 tries, sharp holds');
    expect(sessions[0].sends[1].raw.crag).toBe('Smith Rock');
  });

  it('skips a row with no usable grade or date and counts it', () => {
    const withBlankRow = SAMPLE + ',2026-05-20,No Grade,Bishop,,USA,Onsight,,,\n';
    const { skippedRows } = parse8aCsv(withBlankRow);
    expect(skippedRows).toBe(1);
  });

  it('a compound style value reads as the conservative non-send, not the send keyword it also contains', () => {
    const csv =
      'grade,date,route,crag,sector,country,style,flags,stars,comments\n' +
      '7a,2026-06-01,Compound Case,Smith Rock,,USA,Flash attempt,,,\n';
    const { sessions } = parse8aCsv(csv);
    expect(sessions[0].sends[0]).toMatchObject({ outcome: 'attempt', sent: false });
  });

  it('never uses crag as a route fallback (a climbing area is not a route)', () => {
    const csv = 'grade,date,crag,country\n7a,2026-06-01,Smith Rock,USA\n';
    const { sessions } = parse8aCsv(csv);
    expect('route' in sessions[0].sends[0]).toBe(false);
  });
});
