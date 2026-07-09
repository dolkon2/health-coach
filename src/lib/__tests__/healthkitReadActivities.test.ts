/**
 * reader.readActivities tests — the HK module is jest-mocked (the factory
 * replaces the dynamic import, so the native bridge never loads).
 *
 * Covers the platform-boundary claims of contract §7:
 *   1. only WATER activity types come back (swim/paddle/sail/surf), and
 *      open-water swims are dropped deliberately;
 *   2. every HK Quantity is converted, never unit-assumed — a 25 yd pool is
 *      22.86 m, a mile-denominated distance becomes metres, kJ becomes kcal;
 *   3. pool per-length rows join stroke counts and lap-event stroke styles by
 *      interval overlap;
 *   4. routes are flattened and storage-thinned via thinTrack;
 *   5. a failed route read yields an absent route, not a dropped workout.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockQueryWorkoutSamples = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockQueryQuantitySamples = jest.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockRequestAuthorization = jest.fn<(...args: unknown[]) => Promise<boolean>>();

jest.mock('@kingstinct/react-native-healthkit', () => ({
  queryWorkoutSamples: mockQueryWorkoutSamples,
  queryQuantitySamples: mockQueryQuantitySamples,
  requestAuthorization: mockRequestAuthorization,
}));

import { healthKitReader, toKcal, toMeters } from '@/lib/healthkit/reader';
import { MAX_STORED_POINTS } from '@/lib/geo';

const RANGE = { fromUtc: '2026-06-27T00:00:00.000Z', toUtc: '2026-07-04T00:00:00.000Z' };

type FakeWorkout = {
  uuid: string;
  workoutActivityType: number;
  startDate: Date;
  endDate: Date;
  duration: { unit: string; quantity: number };
  totalDistance?: { unit: string; quantity: number };
  totalEnergyBurned?: { unit: string; quantity: number };
  metadata?: Record<string, unknown>;
  events?: { type: number; startDate: Date; endDate: Date; metadata?: Record<string, unknown> }[];
  sourceRevision?: { source: { bundleIdentifier: string; name: string } };
};

function makeProxy(
  sample: FakeWorkout,
  opts: {
    routes?: { locations: { latitude: number; longitude: number; date: Date; altitude: number }[] }[];
    routesError?: boolean;
  } = {}
) {
  return {
    toJSON: () => sample,
    getWorkoutRoutes: async () => {
      if (opts.routesError) throw new Error('route read failed');
      return opts.routes ?? [];
    },
  };
}

function baseSample(over: Partial<FakeWorkout> = {}): FakeWorkout {
  return {
    uuid: 'hk-uuid-1',
    workoutActivityType: 31,
    startDate: new Date('2026-07-03T16:00:00.000Z'),
    endDate: new Date('2026-07-03T17:00:00.000Z'),
    duration: { unit: 's', quantity: 3600 },
    metadata: {},
    events: [],
    sourceRevision: { source: { bundleIdentifier: 'com.apple.health', name: 'Apple Watch' } },
    ...over,
  };
}

beforeEach(() => {
  mockQueryWorkoutSamples.mockReset();
  mockQueryQuantitySamples.mockReset();
  mockQueryQuantitySamples.mockResolvedValue([]);
});

describe('unit conversion helpers', () => {
  it('toMeters converts yd / mi / km and passes m through', () => {
    expect(toMeters({ unit: 'yd', quantity: 25 })).toBeCloseTo(22.86, 5);
    expect(toMeters({ unit: 'mi', quantity: 1 })).toBeCloseTo(1609.344, 3);
    expect(toMeters({ unit: 'km', quantity: 2.5 })).toBe(2500);
    expect(toMeters({ unit: 'm', quantity: 812 })).toBe(812);
  });

  it('toMeters/toKcal return undefined for unknown units — never a mis-scaled number', () => {
    expect(toMeters({ unit: 'furlong', quantity: 3 })).toBeUndefined();
    expect(toKcal({ unit: 'BTU', quantity: 3 })).toBeUndefined();
    expect(toMeters(undefined)).toBeUndefined();
    expect(toKcal(undefined)).toBeUndefined();
  });

  it('toKcal converts kJ and treats Cal as kcal', () => {
    expect(toKcal({ unit: 'kJ', quantity: 418.4 })).toBeCloseTo(100, 5);
    expect(toKcal({ unit: 'Cal', quantity: 350 })).toBe(350);
    expect(toKcal({ unit: 'kcal', quantity: 350 })).toBe(350);
  });
});

describe('readActivities — filtering', () => {
  it('keeps only WATER activity types', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(baseSample({ uuid: 'a', workoutActivityType: 37 })), // run — Earth's job
      makeProxy(baseSample({ uuid: 'b', workoutActivityType: 31 })), // paddleSports
      makeProxy(baseSample({ uuid: 'c', workoutActivityType: 13 })), // ride — Earth's job
      makeProxy(baseSample({ uuid: 'd', workoutActivityType: 38 })), // sailing
      makeProxy(baseSample({ uuid: 'e', workoutActivityType: 45 })), // surfing
    ]);
    const out = await healthKitReader.readActivities(RANGE);
    expect(out.map((w) => w.uuid)).toEqual(['b', 'd', 'e']);
    expect(out.map((w) => w.hkActivityType)).toEqual([31, 38, 45]);
  });

  it('drops open-water swims (out of scope v1) but keeps pool swims', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(
        baseSample({
          uuid: 'open',
          workoutActivityType: 46,
          metadata: { HKSwimmingLocationType: 2 },
        })
      ),
      makeProxy(
        baseSample({
          uuid: 'pool',
          workoutActivityType: 46,
          metadata: { HKSwimmingLocationType: 1, HKLapLength: { unit: 'yd', quantity: 25 } },
        })
      ),
    ]);
    const out = await healthKitReader.readActivities(RANGE);
    expect(out).toHaveLength(1);
    expect(out[0].uuid).toBe('pool');
    expect(out[0].swim?.locationType).toBe('pool');
  });

  it('queries with the range filter, no limit, ascending', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([]);
    await healthKitReader.readActivities(RANGE);
    expect(mockQueryWorkoutSamples).toHaveBeenCalledWith({
      filter: {
        date: { startDate: new Date(RANGE.fromUtc), endDate: new Date(RANGE.toUtc) },
      },
      limit: -1,
      ascending: true,
    });
  });
});

describe('readActivities — quantity conversion', () => {
  it('converts a mile-denominated distance and kJ energy on the workout', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(
        baseSample({
          totalDistance: { unit: 'mi', quantity: 2 },
          totalEnergyBurned: { unit: 'kJ', quantity: 1673.6 },
        })
      ),
    ]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.distanceM).toBeCloseTo(3218.688, 3);
    expect(w.energyKcal).toBeCloseTo(400, 5);
  });

  it('derives durationS from the duration Quantity in minutes', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(baseSample({ duration: { unit: 'min', quantity: 90 } })),
    ]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.durationS).toBe(5400);
  });

  it('falls back to end − start when the duration unit is unrecognized', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(baseSample({ duration: { unit: 'fortnight', quantity: 1 } })),
    ]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.durationS).toBe(3600); // 16:00 → 17:00
  });
});

describe('readActivities — pool swim per-length join', () => {
  const start = Date.parse('2026-07-03T16:00:00.000Z');

  function poolProxy() {
    return makeProxy(
      baseSample({
        uuid: 'pool-1',
        workoutActivityType: 46,
        metadata: { HKSwimmingLocationType: 1, HKLapLength: { unit: 'yd', quantity: 25 } },
        events: [
          // lap events carry the stroke style; windows offset by ~1s from the
          // samples to prove the join is by overlap, not exact equality
          {
            type: 3,
            startDate: new Date(start + 1000),
            endDate: new Date(start + 29_000),
            metadata: { HKSwimmingStrokeStyle: 2 },
          },
          {
            type: 3,
            startDate: new Date(start + 31_000),
            endDate: new Date(start + 59_000),
            metadata: { HKSwimmingStrokeStyle: 5 },
          },
          // a pause event must not join as a stroke style
          { type: 1, startDate: new Date(start), endDate: new Date(start) },
        ],
      }),
      { routes: [] }
    );
  }

  function lengthSamples(unit: string, distancePer: number) {
    return [0, 1].map((i) => ({
      startDate: new Date(start + i * 30_000),
      endDate: new Date(start + i * 30_000 + 28_000),
      quantity: distancePer,
      unit,
    }));
  }

  it('joins distance samples, stroke counts, and lap stroke styles by overlap', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([poolProxy()]);
    mockQueryQuantitySamples.mockImplementation(async (identifier: unknown) => {
      if (identifier === 'HKQuantityTypeIdentifierDistanceSwimming') {
        return lengthSamples('yd', 25);
      }
      if (identifier === 'HKQuantityTypeIdentifierSwimmingStrokeCount') {
        return lengthSamples('count', 18);
      }
      return [];
    });

    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.swim?.lapLengthM).toBeCloseTo(22.86, 5); // 25 yd pool
    expect(w.swim?.lengths).toHaveLength(2);
    const [l0, l1] = w.swim!.lengths;
    expect(l0.distanceM).toBeCloseTo(22.86, 5);
    expect(l0.strokes).toBe(18);
    expect(l0.hkStrokeStyle).toBe(2); // freestyle
    expect(l1.hkStrokeStyle).toBe(5); // butterfly
    expect(l0.startUtc).toBe(new Date(start).toISOString());

    // both quantity reads were scoped to the workout proxy
    for (const call of mockQueryQuantitySamples.mock.calls) {
      expect((call[1] as { filter: { workout: unknown } }).filter.workout).toBeDefined();
      expect((call[1] as { limit: number }).limit).toBe(-1);
    }
  });

  it('a pool swim with no per-length samples still comes back (empty lengths)', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([poolProxy()]);
    mockQueryQuantitySamples.mockResolvedValue([]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.swim?.lengths).toEqual([]);
    expect(w.swim?.lapLengthM).toBeCloseTo(22.86, 5);
  });
});

describe('readActivities — routes', () => {
  function loc(i: number) {
    return {
      latitude: 45.7 + i * 0.0001,
      longitude: -121.5 - i * 0.0001,
      date: new Date(Date.parse('2026-07-03T16:00:00.000Z') + i * 1000),
      altitude: 20 + i * 0.1,
    };
  }

  it('flattens route locations to GeoPoints', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(baseSample(), { routes: [{ locations: [loc(0), loc(1)] }] }),
    ]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.route).toHaveLength(2);
    expect(w.route?.[0]).toEqual({
      lat: 45.7,
      lng: -121.5,
      tsSec: Math.round(Date.parse('2026-07-03T16:00:00.000Z') / 1000),
      eleM: 20,
    });
  });

  it('thins an oversized route to the storage cap, keeping the final point', async () => {
    const many = Array.from({ length: 9000 }, (_, i) => loc(i));
    mockQueryWorkoutSamples.mockResolvedValue([
      makeProxy(baseSample(), { routes: [{ locations: many }] }),
    ]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w.route!.length).toBeLessThanOrEqual(MAX_STORED_POINTS);
    expect(w.route![w.route!.length - 1].lat).toBeCloseTo(45.7 + 8999 * 0.0001, 8);
  });

  it('a failed route read keeps the workout with an absent route', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([makeProxy(baseSample(), { routesError: true })]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w).toBeDefined();
    expect(w.route).toBeUndefined();
  });

  it('a workout with no route locations carries no route key (absent, not empty)', async () => {
    mockQueryWorkoutSamples.mockResolvedValue([makeProxy(baseSample(), { routes: [] })]);
    const [w] = await healthKitReader.readActivities(RANGE);
    expect(w).not.toHaveProperty('route');
  });
});
