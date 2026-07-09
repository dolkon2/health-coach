/**
 * healthkit/index.ts — picks the platform reader.
 *
 * iOS: the real HealthKit-backed reader. Anywhere else: a stub that resolves
 * to "no data" rather than throwing — Android support is a future pass, and a
 * dev running on web shouldn't see crashes from a feature that isn't theirs.
 */
import { Platform } from 'react-native';
import type { WearableSource } from '@/lib/wearable';

function makeStubReader(): WearableSource {
  return {
    async requestPermissions() {
      return false;
    },
    async readSteps() {
      return [];
    },
    async readSleep() {
      return [];
    },
    async readActivities() {
      return [];
    },
  };
}

let cached: WearableSource | null = null;

export function getWearableSource(): WearableSource {
  if (cached) return cached;
  if (Platform.OS === 'ios') {
    // Lazy require so non-iOS targets never load the native bridge file.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('./reader').healthKitReader as WearableSource;
  } else {
    cached = makeStubReader();
  }
  return cached;
}
