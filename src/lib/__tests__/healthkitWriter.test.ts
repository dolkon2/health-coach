/**
 * healthkitWriter.test.ts — src/lib/healthkit/writer.ts (Body P8) never
 * throws, in Node/jest where neither expo-sqlite nor the HealthKit bridge
 * exist. Full "written" success-path coverage (real settings, real
 * authorization, real HK save) needs an iOS device/simulator — see
 * dev-log/body-build-flags.md for what's covered where. writer.ts reads the
 * app's real settings singleton (no db-injection param, by design — it runs
 * against production data, not a fixture), so in Node it degrades to
 * `status: 'failed'` (the storage call itself can't reach expo-sqlite) — the
 * property under test is that this degradation is a returned RESULT, never
 * an uncaught rejection a fire-and-forget call site would need to guard.
 */
import { describe, expect, it } from '@jest/globals';
import { writeSessionToHealthKit, deleteHealthKitExport } from '../healthkit/writer';
import { DEFAULT_SETTINGS } from '@/lib/appSettings';
import type { ObservationOf } from '@core/observation';

function gymSession(overrides: Partial<ObservationOf<'session'>['payload']> = {}): ObservationOf<'session'> {
  return {
    id: 'obs-1',
    kind: 'session',
    occurredAt: '2026-01-01T10:00:00.000Z',
    loggedAt: '2026-01-01T10:00:00.000Z',
    tz: 'UTC',
    tier: 1,
    fidelity: 0.95,
    source: { type: 'manual' },
    payload: { kind: 'session', modality: 'gym', activity: 'gym', durationMin: 45, ...overrides },
  };
}

describe('writeSessionToHealthKit — never throws', () => {
  it('resolves to a result object rather than rejecting, even when storage is unreachable', async () => {
    const result = await writeSessionToHealthKit(gymSession());
    expect(['skipped', 'failed', 'written']).toContain(result.status);
  });

  it('is safe to fire-and-forget (void .catch never needed to see a rejection)', async () => {
    await expect(writeSessionToHealthKit(gymSession())).resolves.toBeDefined();
  });
});

describe('deleteHealthKitExport — degrades safely outside a real HK bridge', () => {
  it('returns 0 rather than throwing when the native module is unavailable', async () => {
    await expect(deleteHealthKitExport('obs-1')).resolves.toBe(0);
  });
});

describe('DEFAULT_SETTINGS', () => {
  it('healthkitWriteEnabled defaults to false — writes never happen until opted in', () => {
    expect(DEFAULT_SETTINGS.healthkitWriteEnabled).toBe(false);
  });
});
