/**
 * writer.ts — HealthKit WRITE layer for Body sessions (Body P8, binding doc
 * `healthkit-write-layer.md`). Fire-and-forget from every call site: this
 * module never throws — every function returns a result, catches its own
 * errors, and a failure here can never fail or delay a log.
 *
 * The native module is imported dynamically (mirrors reader.ts) so merely
 * importing this file from a Node test never loads the bridge. Enum values
 * used at runtime (AuthorizationStatus.sharingDenied,
 * ComparisonPredicateOperator.equalTo, CategoryValue.notApplicable) are
 * duplicated as numeric literals for the same reason, verified against
 * node_modules/@kingstinct/react-native-healthkit's generated types.
 */
import { Platform } from 'react-native';
import type { ObservationOf } from '@core/observation';
import { mapSessionToHk } from './hkMapping';
import { getAppSettings, getHkExports, setHkExportRecord, deleteHkExportRecord } from '@/storage/settings';
import { withDefaults } from '@/lib/appSettings';

const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier';
const MINDFUL_TYPE = 'HKCategoryTypeIdentifierMindfulSession';
const CATEGORY_VALUE_NOT_APPLICABLE = 0; // CategoryValue.notApplicable
const AUTH_SHARING_DENIED = 1; // AuthorizationStatus.sharingDenied
const OPERATOR_EQUAL_TO = 4; // ComparisonPredicateOperator.equalTo

export type WorkoutWriteResult =
  | { status: 'written'; hkUuid: string }
  | {
      status: 'skipped';
      reason: 'disabled' | 'not-mappable' | 'no-duration' | 'unauthorized' | 'unavailable';
    }
  | { status: 'failed'; error: string };

async function getHk() {
  return await import('@kingstinct/react-native-healthkit');
}

/** Never call from a log-save path — only from the explicit settings toggle
 *  (binding doc: "trigger the auth sheet only from the toggle, never mid-log"). */
export async function requestWritePermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const hk = await getHk();
    return await hk.requestAuthorization({ toShare: [WORKOUT_TYPE, MINDFUL_TYPE] });
  } catch {
    return false;
  }
}

/** Gym duration is already derived (deriveSessionDuration) into
 *  payload.durationMin at build time; every other surface carries a manual
 *  value there too. No derivable duration -> skip, never fabricate a
 *  zero-length workout (constitution: null ≠ 0). */
function derivedDurationMin(obs: ObservationOf<'session'>): number | null {
  const m = obs.payload.durationMin;
  return m != null && m > 0 ? m : null;
}

export async function writeSessionToHealthKit(
  obs: ObservationOf<'session'>
): Promise<WorkoutWriteResult> {
  // Hoisted so the catch block below can also stamp a 'failed' record with
  // the version that would have been written — a subsequent manual retry
  // then increments from the right place instead of reusing a stale one.
  let syncVersion: number | undefined;
  try {
    const settings = withDefaults(await getAppSettings());
    if (!settings.healthkitWriteEnabled) return { status: 'skipped', reason: 'disabled' };
    if (Platform.OS !== 'ios') return { status: 'skipped', reason: 'unavailable' };

    const mapped = mapSessionToHk(obs);
    if (!mapped) return { status: 'skipped', reason: 'not-mappable' };

    const durationMin = derivedDurationMin(obs);
    if (durationMin == null) return { status: 'skipped', reason: 'no-duration' };

    const hk = await getHk();
    const authType = mapped.kind === 'mindful' ? MINDFUL_TYPE : WORKOUT_TYPE;
    // SYNC call (no bridge round-trip) — cheap pre-check before any write.
    if (hk.authorizationStatusFor(authType) === AUTH_SHARING_DENIED) {
      return { status: 'skipped', reason: 'unauthorized' };
    }

    const startDate = new Date(obs.occurredAt);
    const endDate = new Date(startDate.getTime() + durationMin * 60_000);

    const exports = await getHkExports();
    const prior = exports[obs.id];
    // Epoch-seconds seed (not restart-at-1): a reinstalled app's first
    // export still outranks any pre-reinstall sample HK remembers under the
    // same sync identifier (binding doc §"Idempotency", seeding choice ⚑).
    syncVersion = prior ? prior.syncVersion + 1 : Math.floor(Date.now() / 1000);

    const metadata = {
      HKSyncIdentifier: `healthcoach.obs.${obs.id}`,
      HKSyncVersion: syncVersion,
      HCObservationId: obs.id,
      HKExternalUUID: obs.id,
      HKWasUserEntered: true,
      HKTimeZone: obs.tz,
    };

    const hkUuid =
      mapped.kind === 'mindful'
        ? (
            await hk.saveCategorySample(
              MINDFUL_TYPE,
              CATEGORY_VALUE_NOT_APPLICABLE,
              startDate,
              endDate,
              // The package's generated metadata type for MindfulSession is
              // (over-strictly) `Record<string, never>` — Apple's real
              // HKMetadata dictionary accepts arbitrary string keys
              // regardless of sample type (verified: healthkit-write-layer.md
              // §1, "arbitrary custom string keys are supported").
              metadata as never
            )
          )?.uuid
        : // quantities: [] and no totals — modeled (tier-3) energy never enters HealthKit.
          (await hk.saveWorkoutSample(mapped.activityType, [], startDate, endDate, undefined, metadata))?.uuid;

    if (!hkUuid) {
      // No local retry loop yet (deferred — see dev-log/body-build-flags.md);
      // this record at least leaves a trace instead of silently vanishing.
      await setHkExportRecord(obs.id, {
        syncVersion,
        status: 'failed',
        lastAttemptAt: new Date().toISOString(),
      });
      return { status: 'failed', error: 'HealthKit save returned no sample' };
    }

    await setHkExportRecord(obs.id, {
      hkUuid,
      syncVersion,
      status: 'written',
      lastAttemptAt: new Date().toISOString(),
    });
    return { status: 'written', hkUuid };
  } catch (e) {
    // Same as above: record the failure locally even though nothing retries
    // it automatically yet. syncVersion may still be undefined if the throw
    // happened before it was computed (e.g. getHkExports() itself failed) —
    // fall back to a fresh epoch-seconds version in that case.
    await setHkExportRecord(obs.id, {
      syncVersion: syncVersion ?? Math.floor(Date.now() / 1000),
      status: 'failed',
      lastAttemptAt: new Date().toISOString(),
    }).catch(() => {});
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

/** Removes every HK sample this observation ever produced (matched by the
 *  HCObservationId metadata key, both types) and drops the local export
 *  record. Fire-and-forget; a failure here never blocks the delete of the
 *  Body observation itself. */
export async function deleteHealthKitExport(observationId: string): Promise<number> {
  try {
    if (Platform.OS !== 'ios') return 0;
    const hk = await getHk();
    const filter = {
      metadata: { withMetadataKey: 'HCObservationId', operatorType: OPERATOR_EQUAL_TO, value: observationId },
    };
    const removedWorkouts = await hk.deleteObjects(WORKOUT_TYPE, filter);
    const removedMindful = await hk.deleteObjects(MINDFUL_TYPE, filter);
    await deleteHkExportRecord(observationId);
    return removedWorkouts + removedMindful;
  } catch {
    return 0;
  }
}
