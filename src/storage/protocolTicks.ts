/**
 * protocolTicks.ts — daily "did it" marks against the user's own plan.
 *
 * A tick is a subjective Observation (metric 'protocolTick', value 1) — the
 * ledger stays the one observations table, never a parallel tick store. This
 * accessor layer enforces the capture contract: at most ONE tick per exercise
 * per local civil day, and re-tapping untoggles (hard-deletes the tick, the
 * Pass 6 destructive-edit contract) instead of stacking rows or writing a 0 —
 * an undone tick is absent, not a zero (null ≠ 0). Adherence is derived from
 * these at render time (P6), never stored.
 *
 * Callers supply the new tick's id (lib/id's uuidv7 pulls in expo-crypto, which
 * this storage module keeps out of its import graph so real-SQL tests run in
 * Node). Every function accepts an optional `db` for test injection.
 */
import type { ObservationOf } from '@core/observation';
import { isKind } from '@core/observation';
import type { SqlDatabase } from './db';
import { createObservation, deleteObservation, listObservations } from './observations';
import { deviceTz, localDayWindow } from '@/lib/date';

export type ProtocolTick = ObservationOf<'subjective'>;

/** All protocolTick observations in [from, to] (both optional), oldest first. */
export async function listProtocolTicks(
  opts: { from?: string; to?: string } = {},
  db?: SqlDatabase
): Promise<ProtocolTick[]> {
  const rows = await listObservations({ ...opts, kinds: ['subjective'] }, db);
  return rows.filter(
    (o): o is ProtocolTick => isKind(o, 'subjective') && o.payload.metric === 'protocolTick'
  );
}

export type ToggleTickArgs = {
  protocolId: string;
  exerciseId: string;
  id: string; // uuid v7 for the tick if one is created
  now?: Date; // defaults to the device clock; tests pin it
  tz?: string; // defaults to the device timezone
};

/**
 * Tick or untick `exerciseId` for the civil day containing `now`. If a tick for
 * (protocolId, exerciseId) already exists that day, it is deleted (re-tap
 * untoggles); otherwise one tier-1 manual tick is created. Returns the new
 * state and the observation id involved.
 */
export async function toggleProtocolTick(
  args: ToggleTickArgs,
  db?: SqlDatabase
): Promise<{ ticked: boolean; observationId: string }> {
  const now = args.now ?? new Date();
  const { startUtc, endUtc } = localDayWindow(now);

  const existing = (await listProtocolTicks({ from: startUtc, to: endUtc }, db)).find(
    (o) => o.payload.protocolId === args.protocolId && o.payload.exerciseId === args.exerciseId
  );
  if (existing) {
    await deleteObservation(existing.id, db);
    return { ticked: false, observationId: existing.id };
  }

  const iso = now.toISOString();
  const tick: ProtocolTick = {
    id: args.id,
    kind: 'subjective',
    occurredAt: iso,
    loggedAt: iso,
    tz: args.tz ?? deviceTz(),
    tier: 1, // the tap happened
    fidelity: 1, // a binary mark is exact
    source: { type: 'manual' },
    payload: {
      kind: 'subjective',
      metric: 'protocolTick',
      value: 1, // the tick IS the datum — untoggling deletes, never writes a 0
      protocolId: args.protocolId,
      exerciseId: args.exerciseId,
    },
  };
  await createObservation(tick, db);
  return { ticked: true, observationId: tick.id };
}
