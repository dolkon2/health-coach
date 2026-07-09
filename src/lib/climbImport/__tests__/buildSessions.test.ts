/**
 * The Proof — buildImportedClimbingSessions turns grouped rows into honest
 * session Observations:
 *   1. BoardLib sessions are always tagged style 'boulder' and indoor:true
 *      (certainties, not inferences — Aurora/Moon boards are exclusively
 *      bouldering apparatus in a fixed location).
 *   2. 8a.nu style is inferred per session from unambiguous grade prefixes
 *      only (V-scale/YDS) — a genuine tie (including a group of ambiguous
 *      Font/French-shaped grades that cast no vote either way) leaves style
 *      absent (⚑ E-17: 'gym' used to be this app's name for "mixed/unknown
 *      discipline"; removed entirely, so the honest fallback is omitting the
 *      field), never a confident 'sport' or 'boulder' guess the data doesn't
 *      support.
 *   3. gradeSystem is tagged using the resolved style (or no bias, when
 *      style is absent) as the bias.
 *   4. A date already in existingDates is skipped whole and reported.
 *   5. Fidelity differs by platform (boardlib higher than 8a.nu).
 *   6. occurredAt is noon-local on the session's date; source carries format
 *      csv + the platform tag.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildImportedClimbingSessions, type ImportedSession } from '../buildSessions';
import { parseBoardLibCsv } from '../boardlib';
import { parse8aCsv } from '../eightA';

const FX = join(__dirname, '..', '__fixtures__');

const ctx = (existingDates: string[] = []) => ({
  now: '2026-07-09T18:00:00Z',
  tz: 'America/Los_Angeles',
  idFactory: (() => {
    let n = 0;
    return () => `imp-${++n}`;
  })(),
  existingDates: new Set(existingDates),
});

describe('buildImportedClimbingSessions — boardlib', () => {
  it('always tags style boulder and writes the platform-tagged fileimport source', () => {
    const sessions: ImportedSession[] = [
      {
        date: '2026-06-01',
        sends: [{ grade: 'V5', attempts: 3, sent: true, route: 'Purple Reign', raw: { a: '1' } }],
      },
    ];
    const { observations, skippedDates } = buildImportedClimbingSessions(
      sessions,
      'boardlib',
      ctx()
    );
    expect(skippedDates).toEqual([]);
    expect(observations).toHaveLength(1);
    const obs = observations[0];
    expect(obs.payload.climbing?.style).toBe('boulder');
    expect(obs.payload.climbing?.indoor).toBe(true); // a board is always indoor, a certainty (⚑ E-17)
    expect(obs.payload.climbing?.sends[0]).toMatchObject({
      grade: 'V5',
      gradeSystem: 'vscale',
      sent: true,
      route: 'Purple Reign',
      raw: { a: '1' },
    });
    expect(obs.source).toEqual({ type: 'fileimport', format: 'csv', platform: 'boardlib' });
    expect(obs.fidelity).toBe(0.9);
    expect(obs.tier).toBe(1);
  });

  it('skips a date already in existingDates and reports it', () => {
    const sessions: ImportedSession[] = [
      { date: '2026-06-01', sends: [{ grade: 'V5', attempts: 1, sent: true, raw: {} }] },
      { date: '2026-06-08', sends: [{ grade: 'V2', attempts: 1, sent: true, raw: {} }] },
    ];
    const { observations, skippedDates } = buildImportedClimbingSessions(
      sessions,
      'boardlib',
      ctx(['2026-06-01'])
    );
    expect(skippedDates).toEqual(['2026-06-01']);
    expect(observations).toHaveLength(1);
    expect(observations[0].occurredAt.startsWith('2026-06-08')).toBe(true);
  });
});

describe('buildImportedClimbingSessions — 8a.nu style inference', () => {
  it('a group of ambiguous Font/French-shaped grades is a genuine tie -> style absent, never a confident guess', () => {
    const sessions: ImportedSession[] = [
      {
        date: '2026-05-10',
        sends: [
          { grade: '7a', attempts: 1, sent: true, outcome: 'onsight', raw: {} },
          { grade: '7b+', attempts: 1, sent: true, outcome: 'redpoint', raw: {} },
        ],
      },
    ];
    const { observations } = buildImportedClimbingSessions(sessions, '8a.nu', ctx());
    expect('style' in (observations[0].payload.climbing ?? {})).toBe(false);
    expect('indoor' in (observations[0].payload.climbing ?? {})).toBe(false);
    // No style bias, same as any other unbiased parse — this is the honest
    // consequence of not fabricating a style, not a new guess.
    expect(observations[0].payload.climbing?.sends[0].gradeSystem).toBe('font');
    expect(observations[0].fidelity).toBe(0.65);
  });

  it('infers boulder for a group with an unambiguous V-scale grade', () => {
    const sessions: ImportedSession[] = [
      { date: '2026-05-17', sends: [{ grade: 'V6', attempts: 1, sent: true, raw: {} }] },
    ];
    const { observations } = buildImportedClimbingSessions(sessions, '8a.nu', ctx());
    expect(observations[0].payload.climbing?.style).toBe('boulder');
    expect(observations[0].payload.climbing?.sends[0].gradeSystem).toBe('vscale');
  });

  it('a mixed group with more unambiguous route votes infers sport', () => {
    const sessions: ImportedSession[] = [
      {
        date: '2026-05-20',
        sends: [
          { grade: '5.10a', attempts: 1, sent: true, raw: {} },
          { grade: '5.9', attempts: 1, sent: true, raw: {} },
          { grade: 'V2', attempts: 1, sent: true, raw: {} },
        ],
      },
    ];
    const { observations } = buildImportedClimbingSessions(sessions, '8a.nu', ctx());
    expect(observations[0].payload.climbing?.style).toBe('sport');
  });
});

describe('end-to-end: real fixture file -> parse -> build', () => {
  it('boardlib-sample.csv produces two complete, storable session Observations', () => {
    const { sessions, skippedRows } = parseBoardLibCsv(
      readFileSync(join(FX, 'boardlib-sample.csv'), 'utf8')
    );
    const { observations, skippedDates } = buildImportedClimbingSessions(
      sessions,
      'boardlib',
      ctx()
    );
    expect(skippedRows).toBe(1);
    expect(skippedDates).toEqual([]);
    expect(observations).toHaveLength(2);
    for (const obs of observations) {
      expect(obs.kind).toBe('session');
      expect(obs.payload.climbing?.style).toBe('boulder');
      expect(obs.payload.climbing?.sends.length).toBeGreaterThan(0);
      for (const s of obs.payload.climbing!.sends) {
        expect(s.grade).not.toBe('');
        expect(s.gradeSystem).toBe('vscale');
      }
    }
  });

  it('eightA-sample.csv produces two complete, storable session Observations', () => {
    const { sessions } = parse8aCsv(readFileSync(join(FX, 'eightA-sample.csv'), 'utf8'));
    const { observations } = buildImportedClimbingSessions(sessions, '8a.nu', ctx());
    expect(observations).toHaveLength(2);
    // tie: all 3 grades are Font/French-ambiguous -> style honestly absent
    expect('style' in (observations[0].payload.climbing ?? {})).toBe(false);
    expect(observations[1].payload.climbing?.style).toBe('boulder');
  });
});
