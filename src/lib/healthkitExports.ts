/**
 * healthkitExports.ts — per-observation HealthKit export bookkeeping (Body
 * P8). Same role the binding design doc's `hk_exports` table would have
 * played, stored instead as a JSON blob in the EXISTING settings KV table
 * (migration 009) — no new migration. ⚑ Migration numbers 010-012 are
 * mid-reconciliation across the Earth/Sky/Water dimension branches in
 * parallel sessions; claiming 010 here would collide. A settings-tenant
 * blob is a legitimate no-migration path per the architecture briefing's
 * own rule (optional JSON-column additions never need DDL) and is a
 * mechanical one-time migration to a real table later if Dylan wants one.
 *
 * One record per observation, keyed by observationId. `syncVersion` seeds
 * from epoch-seconds at first write (not a restart-at-1 counter) so a
 * reinstalled app's first export still outranks any pre-reinstall sample
 * HealthKit remembers under the same sync identifier — bumped by 1 on every
 * re-export (edit → replace).
 */
export type HkExportStatus = 'written' | 'pending' | 'failed';

export type HkExportRecord = {
  hkUuid?: string;
  syncVersion: number;
  status: HkExportStatus;
  lastAttemptAt: string; // ISO instant
};

export type HkExportsBlob = Record<string, HkExportRecord>; // keyed by observationId
