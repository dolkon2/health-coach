/**
 * wearable.ts — the platform-agnostic shape that all wearable readers speak.
 *
 * Both HealthKit (iOS, this pass) and a future Health Connect (Android) reader
 * implement WearableSource. The values they return are deliberately *not* native
 * (no `Date`, no HK enums) so the normalizer that builds Observations stays a
 * pure-TS, jest-friendly module — and the engine never learns which platform a
 * number came from. See planning/wearable-ingestion-spec.md § Architecture.
 */
import type { IANATimezone, ISOInstant, LocalDate } from '@core/observation';

export type DateRange = { fromUtc: ISOInstant; toUtc: ISOInstant };

/** One source's step total for one civil day. The reader is responsible for
 *  bucketing into civil days using the device's local zone — the normalizer
 *  trusts the date field and never re-buckets. */
export type RawDailyStepSample = {
  date: LocalDate;
  count: number;
  sourceBundleId: string; // e.g. 'com.garmin.connect.mobile'
  sourceName: string; // e.g. 'Garmin Connect'
};

/** The set of sleep stages HealthKit reports. Light = asleepCore + the legacy
 *  asleepUnspecified bucket; the normalizer collapses them. */
export type RawSleepStage =
  | 'inBed'
  | 'asleepUnspecified'
  | 'awake'
  | 'asleepCore'
  | 'asleepDeep'
  | 'asleepREM';

/** One sleep sample window. A night yields many of these (alarm sleep stages
 *  fragment a single sleep window into 30s–5min slices). The normalizer groups
 *  by wake-day. */
export type RawSleepSample = {
  startUtc: ISOInstant;
  endUtc: ISOInstant;
  stage: RawSleepStage;
  sourceBundleId: string;
  sourceName: string;
  tz: IANATimezone; // device tz at read time — used to attribute the wake day
};

/** The four operations every wearable adapter must implement. Pass 2 wires up
 *  the first three; readActivities is a Pass 3 stub. */
export interface WearableSource {
  /** Asks the OS for read scopes. Resolves true if the system sheet was shown
   *  (or already decided); never tells us *what* was granted (Apple privacy). */
  requestPermissions(): Promise<boolean>;
  readSteps(range: DateRange): Promise<RawDailyStepSample[]>;
  readSleep(range: DateRange): Promise<RawSleepSample[]>;
  readActivities(range: DateRange): Promise<never>;
}
