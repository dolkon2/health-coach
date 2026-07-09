/**
 * normalizeWorkout tests — pure TS, no native imports.
 *
 * Covers the contract §7 claims:
 *   1. HK activity type maps to the registry id (46→swim, 31→kayak, 38→sail,
 *      45→surf) and unmapped types normalize to null;
 *   2. a yard-pool swim keeps the reader-converted 22.86 m lengths and the
 *      MEASURED total distance (never recomputed laps × poolLengthM);
 *   3. HK stroke-style enum maps onto the SwimLength stroke union, with
 *      unrecognized values collapsing to 'unknown' and absent staying absent;
 *   4. energySystem comes from the registry default, falling back to 'aerobic';
 *   5. durationMin = Math.round(durationS / 60) on EVERY ingested payload;
 *   6. provenance: source carries the HK workout UUID, occurredAt = startUtc,
 *      tier 1, fidelity 0.95 (the existing device-recorded rung).
 */
import { describe, it, expect } from '@jest/globals';
import { normalizeWorkout, normalizeWorkouts } from '@/lib/healthkit/normalizeWorkout';
import type { RawSwimLength, RawWorkout } from '@/lib/wearable';

const ctx = { tz: 'America/Los_Angeles', nowUtc: '2026-07-04T18:00:00.000Z' } as const;

const YD_25_M = 22.86; // 25 yd × 0.9144 — converted by the reader, kept here

function makeWorkout(over: Partial<RawWorkout> = {}): RawWorkout {
  return {
    uuid: 'wk-0001',
    hkActivityType: 31, // paddleSports
    startUtc: '2026-07-03T16:00:00.000Z',
    endUtc: '2026-07-03T17:30:00.000Z',
    durationS: 5400,
    sourceBundleId: 'com.apple.health',
    sourceName: 'Apple Watch',
    ...over,
  };
}

function makeYardPoolSwim(): RawWorkout {
  const start = Date.parse('2026-07-03T16:00:00.000Z');
  const lengths: RawSwimLength[] = [0, 1, 2, 3].map((i) => ({
    startUtc: new Date(start + i * 30_000).toISOString(),
    endUtc: new Date(start + i * 30_000 + 28_000).toISOString(),
    distanceM: YD_25_M,
    strokes: 18,
    hkStrokeStyle: i === 3 ? 6 : 2, // freestyle ×3, kickboard ×1
  }));
  return makeWorkout({
    uuid: 'wk-swim-1',
    hkActivityType: 46,
    durationS: 118,
    distanceM: 4 * YD_25_M, // measured total from the device
    swim: { locationType: 'pool', lapLengthM: YD_25_M, lengths },
  });
}

describe('normalizeWorkout — activity mapping', () => {
  it.each([
    [46, 'swim', 'swim'],
    [31, 'kayak', 'paddle'],
    [38, 'sail', 'other'],
    [45, 'surf', 'surf'],
  ])('maps HK type %i to activity %s / modality %s', (hkType, activity, modality) => {
    const obs = normalizeWorkout(makeWorkout({ hkActivityType: hkType as number }), ctx);
    expect(obs).not.toBeNull();
    expect(obs?.payload.activity).toBe(activity);
    expect(obs?.payload.modality).toBe(modality);
  });

  it('returns null for an HK type outside the water set (run=37)', () => {
    expect(normalizeWorkout(makeWorkout({ hkActivityType: 37 }), ctx)).toBeNull();
  });

  it('normalizeWorkouts drops unmappable workouts and sorts by occurrence', () => {
    const later = makeWorkout({ uuid: 'b', startUtc: '2026-07-03T18:00:00.000Z' });
    const earlier = makeWorkout({ uuid: 'a', startUtc: '2026-07-03T08:00:00.000Z' });
    const alien = makeWorkout({ uuid: 'x', hkActivityType: 13 }); // ride → Earth's job
    const out = normalizeWorkouts([later, alien, earlier], ctx);
    expect(out).toHaveLength(2);
    expect(out.map((o) => o.occurredAt)).toEqual([
      '2026-07-03T08:00:00.000Z',
      '2026-07-03T18:00:00.000Z',
    ]);
  });
});

describe('normalizeWorkout — provenance and measured facts', () => {
  it('stamps source.workoutUuid, occurredAt = startUtc, tier 1, fidelity 0.95', () => {
    const obs = normalizeWorkout(makeWorkout(), ctx);
    expect(obs?.source).toEqual({
      type: 'healthkit',
      rawType: 'HKWorkout',
      workoutUuid: 'wk-0001',
    });
    expect(obs?.occurredAt).toBe('2026-07-03T16:00:00.000Z');
    expect(obs?.loggedAt).toBe(ctx.nowUtc);
    expect(obs?.tz).toBe(ctx.tz);
    expect(obs?.tier).toBe(1);
    expect(obs?.fidelity).toBe(0.95);
  });

  it('durationMin is Math.round(durationS / 60), always present', () => {
    expect(normalizeWorkout(makeWorkout({ durationS: 5400 }), ctx)?.payload.durationMin).toBe(90);
    expect(normalizeWorkout(makeWorkout({ durationS: 1770 }), ctx)?.payload.durationMin).toBe(30); // 29.5 rounds up
    expect(normalizeWorkout(makeWorkout({ durationS: 29 }), ctx)?.payload.durationMin).toBe(0); // rounded, not fabricated
    expect(normalizeWorkout(makeWorkout({ durationS: 118 }), ctx)?.payload.durationMin).toBe(2);
  });

  it('non-swim workouts get an EnduranceBlock with distance and gpsPath when present', () => {
    const route = [
      { lat: 45.7, lng: -121.5, tsSec: 1_780_500_000 },
      { lat: 45.71, lng: -121.51, tsSec: 1_780_500_060 },
    ];
    const obs = normalizeWorkout(makeWorkout({ distanceM: 8200, route }), ctx);
    expect(obs?.payload.endurance).toEqual({
      energySystem: 'aerobic', // kayak's registry default
      distanceM: 8200,
      gpsPath: route,
    });
    expect(obs?.payload.swimming).toBeUndefined();
  });

  it('omits distance/gpsPath entirely when absent (null ≠ 0)', () => {
    const obs = normalizeWorkout(makeWorkout(), ctx);
    expect(obs?.payload.endurance).toEqual({ energySystem: 'aerobic' });
    expect(obs?.payload.endurance).not.toHaveProperty('distanceM');
    expect(obs?.payload.endurance).not.toHaveProperty('gpsPath');
  });
});

describe('normalizeWorkout — energySystem', () => {
  it('takes the mapped activity registry default (surf → mixed)', () => {
    const obs = normalizeWorkout(makeWorkout({ hkActivityType: 45 }), ctx);
    expect(obs?.payload.endurance?.energySystem).toBe('mixed');
  });

  it("falls back to 'aerobic' when the registry has no entry for the activity", () => {
    const obs = normalizeWorkout(makeWorkout({ hkActivityType: 45 }), {
      ...ctx,
      activityLookup: () => undefined, // simulate a registry miss
    });
    expect(obs?.payload.endurance?.energySystem).toBe('aerobic');
    expect(obs?.payload.modality).toBe('other');
  });
});

describe('normalizeWorkout — yard-pool swim', () => {
  it('builds a SwimmingBlock with the converted pool length and measured total', () => {
    const obs = normalizeWorkout(makeYardPoolSwim(), ctx);
    const swim = obs?.payload.swimming;
    expect(swim).toBeDefined();
    expect(swim?.poolLengthM).toBeCloseTo(22.86, 5);
    expect(swim?.laps).toBe(4);
    // MEASURED total, not recomputed laps × poolLengthM.
    expect(swim?.distanceM).toBeCloseTo(91.44, 5);
    expect(swim?.energySystem).toBe('aerobic');
    expect(obs?.payload.endurance).toBeUndefined();
  });

  it('converts lengths to startSec offsets from session start', () => {
    const obs = normalizeWorkout(makeYardPoolSwim(), ctx);
    const lengths = obs?.payload.swimming?.lengths ?? [];
    expect(lengths.map((l) => l.startSec)).toEqual([0, 30, 60, 90]);
    expect(lengths.every((l) => l.durationS === 28)).toBe(true);
    expect(lengths.every((l) => l.strokes === 18)).toBe(true);
    expect(lengths[0].distanceM).toBeCloseTo(22.86, 5);
  });

  it('maps HK stroke styles onto the SwimLength stroke union', () => {
    const obs = normalizeWorkout(makeYardPoolSwim(), ctx);
    const strokes = (obs?.payload.swimming?.lengths ?? []).map((l) => l.stroke);
    expect(strokes).toEqual(['freestyle', 'freestyle', 'freestyle', 'kickboard']);
  });

  it.each([
    [0, 'unknown'],
    [1, 'mixed'],
    [3, 'backstroke'],
    [4, 'breaststroke'],
    [5, 'butterfly'],
    [99, 'unknown'], // future HK arm — unknown to us, never a guess
  ])('stroke style %i → %s', (hkStyle, expected) => {
    const swim = makeYardPoolSwim();
    swim.swim!.lengths = [{ ...swim.swim!.lengths[0], hkStrokeStyle: hkStyle as number }];
    const obs = normalizeWorkout(swim, ctx);
    expect(obs?.payload.swimming?.lengths?.[0].stroke).toBe(expected);
  });

  it('omits stroke when the length carried no style, and omits laps/lengths when empty', () => {
    const swim = makeYardPoolSwim();
    const bare = { ...swim.swim!.lengths[0] };
    delete bare.hkStrokeStyle;
    swim.swim!.lengths = [bare];
    const withOne = normalizeWorkout(swim, ctx);
    expect(withOne?.payload.swimming?.lengths?.[0]).not.toHaveProperty('stroke');

    const noLengths = makeYardPoolSwim();
    noLengths.swim!.lengths = [];
    const obs = normalizeWorkout(noLengths, ctx);
    expect(obs?.payload.swimming).toBeDefined();
    expect(obs?.payload.swimming).not.toHaveProperty('laps');
    expect(obs?.payload.swimming).not.toHaveProperty('lengths');
  });
});
