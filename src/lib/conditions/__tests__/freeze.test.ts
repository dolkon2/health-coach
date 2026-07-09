/**
 * The Proof — freezeEarthConditions can never hurt a save (⚑ E-2):
 *   1. Sub-fetches are independent: SNOTEL down costs only the snow
 *      sub-object; the weather that landed still freezes.
 *   2. A HUNG fetch (never resolves) is cut by the per-sub-fetch deadline —
 *      the composer returns promptly without it, so a wedged socket can
 *      never wedge the save path.
 *   3. All sources failing → {} (callers treat an empty snapshot as absence;
 *      it is never stored). It never throws.
 *   4. include: {} → {} with zero network calls — nothing is fetched that
 *      wasn't asked for (conditions are pull-only context).
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { freezeEarthConditions } from '../freeze';

const FX = join(__dirname, '..', '__fixtures__');
const forecast = JSON.parse(
  readFileSync(join(FX, 'openmeteo-forecast-past3.json'), 'utf8')
) as unknown;

const INPUT = {
  lat: 45.37,
  lng: -121.7,
  atIso: '2026-07-03T14:20:00Z',
  dateLocal: '2026-07-03',
};
const NOW = () => new Date('2026-07-05T12:00:00Z');

describe('freezeEarthConditions', () => {
  it('one source down → the others still land (weather survives SNOTEL failure)', async () => {
    const fetchImpl = (async (url: unknown) => {
      if (String(url).includes('open-meteo')) {
        return { ok: true, status: 200, json: async () => forecast };
      }
      throw new Error('awdb down'); // SNOTEL rejects
    }) as unknown as typeof fetch;

    const snap = await freezeEarthConditions(
      { ...INPUT, include: { weather: true, snow: true } },
      { fetchImpl, now: NOW }
    );
    expect(snap.weather?.tempC).toBe(18.3);
    expect(snap.weather?.source).toBe('open-meteo');
    expect('snow' in snap).toBe(false);
  });

  it('a hung fetch is cut by the deadline — the composer returns without it', async () => {
    const hang = (() => new Promise(() => {})) as unknown as typeof fetch;
    const snap = await freezeEarthConditions(
      { ...INPUT, include: { weather: true, snow: true, avalanche: true } },
      { fetchImpl: hang, now: NOW, timeoutMs: 40 }
    );
    expect(snap).toEqual({});
  });

  it('all sources failing → {} — and it never throws', async () => {
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const snap = await freezeEarthConditions(
      { ...INPUT, include: { weather: true, snow: true, avalanche: true } },
      { fetchImpl: boom, now: NOW }
    );
    expect(snap).toEqual({});
  });

  it('include {} → {} with zero fetches (pull-only: nothing unasked is fetched)', async () => {
    const spy = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const snap = await freezeEarthConditions(
      { ...INPUT, include: {} },
      { fetchImpl: spy as unknown as typeof fetch, now: NOW }
    );
    expect(snap).toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it('snow asked for without a dateLocal → skipped, not guessed from a UTC slice', async () => {
    const spy = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    const { dateLocal: _omit, ...noDay } = INPUT;
    const snap = await freezeEarthConditions(
      { ...noDay, include: { snow: true } },
      { fetchImpl: spy as unknown as typeof fetch, now: NOW }
    );
    expect(snap).toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });
});
