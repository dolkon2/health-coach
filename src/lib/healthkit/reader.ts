/**
 * reader.ts — the iOS HealthKit implementation of WearableSource.
 *
 * Wraps @kingstinct/react-native-healthkit. Returns platform-neutral
 * shapes from wearable.ts so the normalizer never sees HK types. The native
 * module is imported dynamically — merely importing this file from a Node
 * test must not load the bridge.
 *
 * Scope: steps + sleep (Pass 2). Activities are Pass 3.
 */
import type {
  DateRange,
  RawDailyStepSample,
  RawSleepSample,
  RawSleepStage,
  WearableSource,
} from '@/lib/wearable';
import { todayLocalDate, deviceTz } from '@/lib/date';

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

async function getHk() {
  // Dynamic import keeps the native bridge out of Node test runners.
  return await import('@kingstinct/react-native-healthkit');
}

async function requestPermissions(): Promise<boolean> {
  const hk = await getHk();
  return hk.requestAuthorization({
    toRead: [
      'HKQuantityTypeIdentifierStepCount',
      'HKCategoryTypeIdentifierSleepAnalysis',
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

async function readActivities(): Promise<never> {
  const { notImplemented } = await import('@core/notImplemented');
  return notImplemented('WearableSource.readActivities', 'Phase 3 Pass 3');
}

export const healthKitReader: WearableSource = {
  requestPermissions,
  readSteps,
  readSleep,
  readActivities,
};
