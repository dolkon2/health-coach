/**
 * reader.ts — the iOS HealthKit implementation of WearableSource.
 *
 * Wraps @kingstinct/react-native-healthkit. Returns platform-neutral
 * shapes from wearable.ts so the normalizer never sees HK types. The native
 * module is imported dynamically — merely importing this file from a Node
 * test must not load the bridge.
 *
 * Scope: steps + sleep (Pass 2) + workouts (Water pass). Workout reads are
 * restricted to WATER activity types in v1 (water-build-contract.md §7);
 * Earth extends the type map for run/ride/hike on its branch.
 */
import type { GeoPoint } from '@core/observation';
import type {
  DateRange,
  RawDailyStepSample,
  RawSleepSample,
  RawSleepStage,
  RawSwimLength,
  RawWorkout,
  WearableSource,
} from '@/lib/wearable';
import { todayLocalDate, deviceTz } from '@/lib/date';
import { thinTrack } from '@/lib/geo';

// Sleep enum values from CategoryValueSleepAnalysis (see
// node_modules/@kingstinct/react-native-healthkit/.../healthkit.generated.d.ts).
// Duplicated here as numeric constants so this module stays unit-testable
// without booting the native module.
const SLEEP_VALUE_TO_STAGE: Record<number, RawSleepStage> = {
  0: 'inBed',
  1: 'asleepUnspecified', // legacy `asleep` aliases to this value
  2: 'awake',
  3: 'asleepCore',
  4: 'asleepDeep',
  5: 'asleepREM',
};

// Workout enum values duplicated as numeric constants (same rationale as the
// sleep map above): WorkoutActivityType / WorkoutSwimmingLocationType /
// WorkoutEventType from healthkit.generated.d.ts.
const HK_WORKOUT_EVENT_LAP = 3;
const HK_SWIM_LOCATION_POOL = 1;
const HK_SWIM_LOCATION_OPEN_WATER = 2;
const HK_TYPE_SWIMMING = 46;

/** The WATER activity types ingested in v1 (contract §7). Earth adds
 *  run=37 / ride=13 / hike=24 on its branch — extend, don't fork. ⚑ */
const HK_WATER_ACTIVITY_TYPES: ReadonlySet<number> = new Set([
  46, // swimming
  31, // paddleSports
  38, // sailing
  45, // surfingSports
]);

// ─── Quantity conversion ─────────────────────────────────────────────────────
// HK returns Quantity {unit, quantity} and the unit follows the recording
// device's locale — yd, mi, km all occur in the wild. NEVER assume metres.

type HkQuantity = { unit: string; quantity: number };

const LENGTH_UNIT_TO_M: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  yd: 0.9144,
  ft: 0.3048,
  in: 0.0254,
  mi: 1609.344,
};

/** Metres from an HK length Quantity. Unknown unit → undefined (an absent
 *  distance is honest; a mis-scaled one is not — constitution: never fabricate). */
export function toMeters(q: HkQuantity | undefined): number | undefined {
  if (!q || !Number.isFinite(q.quantity)) return undefined;
  const factor = LENGTH_UNIT_TO_M[q.unit];
  return factor === undefined ? undefined : q.quantity * factor;
}

const ENERGY_UNIT_TO_KCAL: Record<string, number> = {
  kcal: 1,
  Cal: 1, // large calorie == kcal
  cal: 0.001,
  kJ: 1 / 4.184,
  J: 1 / 4184,
};

/** kcal from an HK energy Quantity. Unknown unit → undefined. */
export function toKcal(q: HkQuantity | undefined): number | undefined {
  if (!q || !Number.isFinite(q.quantity)) return undefined;
  const factor = ENERGY_UNIT_TO_KCAL[q.unit];
  return factor === undefined ? undefined : q.quantity * factor;
}

const DURATION_UNIT_TO_S: Record<string, number> = {
  s: 1,
  min: 60,
  hr: 3600,
  ms: 0.001,
};

function toSeconds(q: HkQuantity | undefined): number | undefined {
  if (!q || !Number.isFinite(q.quantity)) return undefined;
  const factor = DURATION_UNIT_TO_S[q.unit];
  return factor === undefined ? undefined : q.quantity * factor;
}

async function getHk() {
  // Lazy require keeps the native bridge out of module-eval time so importing
  // this file from a Node test never loads the bridge (same pattern as
  // healthkit/index.ts — and unlike a native dynamic import, jest can
  // intercept it without ESM VM flags).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
}

async function requestPermissions(): Promise<boolean> {
  const hk = await getHk();
  return hk.requestAuthorization({
    toRead: [
      'HKQuantityTypeIdentifierStepCount',
      'HKCategoryTypeIdentifierSleepAnalysis',
      'HKWorkoutTypeIdentifier',
      'HKWorkoutRouteTypeIdentifier',
      'HKQuantityTypeIdentifierSwimmingStrokeCount',
      'HKQuantityTypeIdentifierDistanceSwimming',
    ],
  });
}

async function readSteps(range: DateRange): Promise<RawDailyStepSample[]> {
  const hk = await getHk();
  const from = new Date(range.fromUtc);
  const to = new Date(range.toUtc);

  // Anchor on the START of the device's civil day containing `from` so the
  // per-day buckets line up with civil days (HealthKit slices the range using
  // the device calendar starting at the anchor).
  const anchor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);

  const buckets = await hk.queryStatisticsCollectionForQuantitySeparateBySource(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    anchor,
    { day: 1 },
    { filter: { date: { startDate: from, endDate: to } } }
  );

  const out: RawDailyStepSample[] = [];
  for (const b of buckets) {
    const count = b.sumQuantity?.quantity;
    if (!b.startDate || count == null || count <= 0) continue;
    out.push({
      date: todayLocalDate(b.startDate),
      count,
      sourceBundleId: b.source.bundleIdentifier,
      sourceName: b.source.name,
    });
  }
  return out;
}

async function readSleep(range: DateRange): Promise<RawSleepSample[]> {
  const hk = await getHk();
  const tz = deviceTz();
  const samples = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    filter: {
      date: { startDate: new Date(range.fromUtc), endDate: new Date(range.toUtc) },
    },
    limit: -1, // all samples in range — a night fragments into 30s–5min slices
    ascending: true,
  });

  const out: RawSleepSample[] = [];
  for (const s of samples) {
    const stage = SLEEP_VALUE_TO_STAGE[s.value as number];
    if (!stage) continue; // unknown value → drop rather than guess
    out.push({
      startUtc: s.startDate.toISOString(),
      endUtc: s.endDate.toISOString(),
      stage,
      sourceBundleId: s.sourceRevision?.source.bundleIdentifier ?? 'unknown',
      sourceName: s.sourceRevision?.source.name ?? 'Unknown',
      tz,
    });
  }
  return out;
}

// ─── Workouts ────────────────────────────────────────────────────────────────

type HkInterval = { startMs: number; endMs: number };

function intervalOverlapMs(a: HkInterval, b: HkInterval): number {
  return Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
}

/** The candidate whose interval overlaps `target` the most (must overlap at
 *  all). Used to join per-length samples with lap events — HK writes them with
 *  near-identical windows but never guarantees exact timestamp equality. */
function bestOverlap<T extends HkInterval>(candidates: readonly T[], target: HkInterval): T | undefined {
  let best: T | undefined;
  let bestMs = 0;
  for (const c of candidates) {
    const o = intervalOverlapMs(c, target);
    if (o > bestMs) {
      best = c;
      bestMs = o;
    }
  }
  return best;
}

function toMs(d: Date | string): number {
  return new Date(d).getTime();
}

/** Per-length swim rows: distance + stroke-count quantity samples scoped to the
 *  workout, joined with the lap events' stroke style by interval overlap. */
async function readSwimLengths(
  hk: Awaited<ReturnType<typeof getHk>>,
  proxy: { toJSON(): unknown },
  events: readonly { type: number; startDate: Date | string; endDate: Date | string; metadata?: unknown }[]
): Promise<RawSwimLength[]> {
  const workoutFilter = {
    // The typed filter takes the live proxy — HK resolves it to an HKWorkout predicate.
    filter: { workout: proxy as never },
    limit: -1,
    ascending: true,
  };
  const [distanceSamples, strokeSamples] = await Promise.all([
    hk.queryQuantitySamples('HKQuantityTypeIdentifierDistanceSwimming', workoutFilter),
    hk.queryQuantitySamples('HKQuantityTypeIdentifierSwimmingStrokeCount', workoutFilter),
  ]);

  const strokeIvs = strokeSamples.map((s) => ({
    startMs: toMs(s.startDate),
    endMs: toMs(s.endDate),
    strokes: Math.round(s.quantity), // unit is 'count'
  }));
  const lapIvs = events
    .filter((e) => e.type === HK_WORKOUT_EVENT_LAP)
    .map((e) => {
      const style = (e.metadata as { HKSwimmingStrokeStyle?: number } | undefined)?.HKSwimmingStrokeStyle;
      return { startMs: toMs(e.startDate), endMs: toMs(e.endDate), style };
    })
    .filter((e): e is { startMs: number; endMs: number; style: number } => typeof e.style === 'number');

  // Distance samples are the base rows (Apple writes one per length); when a
  // device reports only stroke counts, those become the base instead.
  const base = distanceSamples.length
    ? distanceSamples.map((s) => ({
        startMs: toMs(s.startDate),
        endMs: toMs(s.endDate),
        distanceM: toMeters({ unit: s.unit, quantity: s.quantity }),
      }))
    : strokeIvs.map((s) => ({ startMs: s.startMs, endMs: s.endMs, distanceM: undefined as number | undefined }));

  const out: RawSwimLength[] = [];
  for (const row of base) {
    const strokes = bestOverlap(strokeIvs, row)?.strokes;
    const style = bestOverlap(lapIvs, row)?.style;
    out.push({
      startUtc: new Date(row.startMs).toISOString(),
      endUtc: new Date(row.endMs).toISOString(),
      ...(row.distanceM !== undefined ? { distanceM: row.distanceM } : {}),
      ...(strokes !== undefined ? { strokes } : {}),
      ...(style !== undefined ? { hkStrokeStyle: style } : {}),
    });
  }
  return out;
}

async function readActivities(range: DateRange): Promise<RawWorkout[]> {
  const hk = await getHk();
  const proxies = await hk.queryWorkoutSamples({
    filter: {
      date: { startDate: new Date(range.fromUtc), endDate: new Date(range.toUtc) },
    },
    limit: -1, // all workouts in range
    ascending: true,
  });

  const out: RawWorkout[] = [];
  for (const proxy of proxies) {
    // Snapshot immediately — proxies are live native objects, never persisted.
    const w = proxy.toJSON();
    const hkType = w.workoutActivityType as number;
    if (!HK_WATER_ACTIVITY_TYPES.has(hkType)) continue; // v1: water only

    const meta = (w.metadata ?? {}) as {
      HKSwimmingLocationType?: number;
      HKLapLength?: HkQuantity;
    };
    const isSwim = hkType === HK_TYPE_SWIMMING;
    // Open-water swims are out of scope v1 (Dylan 2026-07-05): drop, deliberately.
    if (isSwim && meta.HKSwimmingLocationType === HK_SWIM_LOCATION_OPEN_WATER) continue;

    const startMs = toMs(w.startDate);
    const endMs = toMs(w.endDate);
    const durationS = toSeconds(w.duration) ?? Math.max(0, (endMs - startMs) / 1000);
    const distanceM = toMeters(w.totalDistance);
    const energyKcal = toKcal(w.totalEnergyBurned);

    // Route: fetched eagerly (the proxy dies with this loop), flattened and
    // storage-thinned. A failed route read = absent route, never a partial lie.
    let route: GeoPoint[] | undefined;
    try {
      const routes = await proxy.getWorkoutRoutes();
      const pts: GeoPoint[] = [];
      for (const r of routes) {
        for (const loc of r.locations) {
          pts.push({
            lat: loc.latitude,
            lng: loc.longitude,
            tsSec: Math.round(toMs(loc.date) / 1000),
            ...(Number.isFinite(loc.altitude) ? { eleM: loc.altitude } : {}),
          });
        }
      }
      if (pts.length > 0) {
        pts.sort((a, b) => a.tsSec - b.tsSec);
        route = thinTrack(pts);
      }
    } catch {
      // absent means absent — the workout still ingests without a path
    }

    // Pool swims: per-length rows + lap length (a Quantity — US pools are
    // commonly 25 yd, so conversion is load-bearing, not cosmetic).
    let swim: RawWorkout['swim'];
    if (isSwim && meta.HKSwimmingLocationType === HK_SWIM_LOCATION_POOL) {
      const lapLengthM = toMeters(meta.HKLapLength);
      let lengths: RawSwimLength[] = [];
      try {
        lengths = await readSwimLengths(hk, proxy, w.events ?? []);
      } catch {
        // per-length read failed → keep the workout, just without lengths
      }
      swim = {
        locationType: 'pool',
        ...(lapLengthM !== undefined ? { lapLengthM } : {}),
        lengths,
      };
    }

    out.push({
      uuid: w.uuid,
      hkActivityType: hkType,
      startUtc: new Date(startMs).toISOString(),
      endUtc: new Date(endMs).toISOString(),
      durationS,
      ...(distanceM !== undefined ? { distanceM } : {}),
      ...(energyKcal !== undefined ? { energyKcal } : {}),
      sourceBundleId: w.sourceRevision?.source.bundleIdentifier ?? 'unknown',
      sourceName: w.sourceRevision?.source.name ?? 'Unknown',
      ...(route ? { route } : {}),
      ...(swim ? { swim } : {}),
    });
  }
  return out;
}

export const healthKitReader: WearableSource = {
  requestPermissions,
  readSteps,
  readSleep,
  readActivities,
};
