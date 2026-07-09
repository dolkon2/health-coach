/**
 * Water dimension — screen-wiring flow tests (contract §8, integration pass I2).
 *
 * The slice the Log Session screen's Water sections drive, minus React:
 *
 *   condition client (mocked fetch) -> snapshot onto the form slice
 *   -> buildSessionObservation -> createObservation -> read back
 *   -> sessionFormFromObservation -> rebuild -> updateObservation
 *
 * Guards the freeze-at-save semantics end to end: a FETCHED gauge snapshot
 * persists and survives an edit round-trip byte-identical (snapshots are
 * immutable facts); the manual fallbacks construct honest 'manual'-source
 * snapshots pinned to the session time; a downwind wind session keeps its
 * landing spot; a kit pick expands gearIds while recording kitId provenance;
 * and a failed fetch leaves the field ABSENT (never fabricated). Plus the
 * one-shot workout re-permission flag (healthkit/state).
 */
import { describe, it, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ObservationOf } from '@core/observation';
import type { Kit } from '@core/gear';
import type { Spot } from '@core/spot';
import { runMigrations } from '../storage/db';
import { makeTestDb } from '../storage/__tests__/sqliteTestDb';
import {
  createObservation,
  getObservationById,
  updateObservation,
} from '../storage/observations';
import { createGearItem, createKit, listKits } from '../storage/gear';
import { createSpot, getSpot, listSpots } from '../storage/spots';
import {
  getWorkoutPermsRequestedAt,
  setWorkoutPermsRequestedAt,
} from '../lib/healthkit/state';
import { fetchGaugeSnapshot } from '../lib/conditions/usgsClient';
import { fetchWindSnapshot } from '../lib/conditions/openMeteoClient';
import {
  buildSessionObservation,
  emptySessionForm,
  sessionFormFromObservation,
  type BuildContext,
  type SessionForm,
} from '../lib/session';
import { manualGaugeSnapshot, riverSectionFromSpot } from '../components/surface/WhitewaterSection';
import { manualWindSnapshot, kitPickPatch } from '../components/surface/WindSection';
import { deriveRiverSectionSpot } from '../components/surface/SpotPicker';

const CTX: BuildContext = {
  id: 'wf1',
  now: '2026-07-05T17:00:00Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'kg',
  distanceUnit: 'km',
};
const UNITS = { weightUnit: 'kg' as const, distanceUnit: 'km' as const };

const FX = join(__dirname, '..', '..', 'core', 'src', 'conditions', '__fixtures__');
function load(name: string): unknown {
  return JSON.parse(readFileSync(join(FX, name), 'utf8'));
}

const asFetch = (f: unknown) => f as unknown as typeof fetch;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });

/** Fetch mock dispatching on FIRST URL-substring match (usgsClient.test.ts pattern). */
function routedFetch(routes: Array<[match: string, body: unknown]>) {
  return jest.fn(async (url: unknown) => {
    const hit = routes.find(([m]) => String(url).includes(m));
    return hit ? ok(hit[1]) : notFound();
  });
}

function invert(obs: ObservationOf<'session'>): SessionForm {
  let n = 0;
  return sessionFormFromObservation(obs, UNITS, () => `g${n++}`);
}

describe('whitewater flow — fetched snapshot freezes at save and survives edit', () => {
  it('persists the block and an edit round-trip keeps the snapshot byte-identical', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // The screen fetches for the session time via the real client (mocked
    // transport). Recent session → latest-continuous path.
    const when = Math.floor(Date.now() / 1000) - 600;
    const impl = routedFetch([
      ['sortby=-time', load('usgs-series-6h.json')],
      ['latest-continuous', load('usgs-latest-discharge.json')],
    ]);
    const fetched = await fetchGaugeSnapshot('USGS-14123500', when, { fetchImpl: asFetch(impl) });
    expect(fetched).not.toBeNull();

    // The section copies the picked site's NAME onto the snapshot — the
    // client omits it (known gap).
    const gauge = { ...fetched!, siteName: 'WHITE SALMON RIVER NEAR UNDERWOOD, WA' };

    const form = emptySessionForm();
    form.activity = 'whitewater';
    form.durationMin = '95';
    form.whitewater = {
      ...form.whitewater,
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
      sectionClass: 'IV-V',
      swims: '0', // zero swims is a fact (null ≠ 0)
      spotId: 'spot-truss',
      gauge,
      precip72hMm: 18.4,
    };

    const obs = buildSessionObservation(form, CTX);
    await createObservation(obs, db);

    const stored = (await getObservationById('wf1', db)) as ObservationOf<'session'>;
    expect(stored.payload.whitewater).toBeDefined();
    expect(JSON.stringify(stored.payload.whitewater!.gauge)).toBe(JSON.stringify(gauge));
    expect(stored.payload.whitewater!.swims).toBe(0);
    expect(stored.payload.whitewater!.precip72hMm).toBe(18.4);

    // Edit path: rebuild the WHOLE payload from restored form state (exactly
    // what the screen does), preserving source/fidelity like handleSave.
    const rebuilt = buildSessionObservation(invert(stored), { ...CTX, id: stored.id });
    await updateObservation(
      { ...rebuilt, source: stored.source, fidelity: stored.fidelity },
      db
    );

    const after = (await getObservationById('wf1', db)) as ObservationOf<'session'>;
    expect(JSON.stringify(after.payload.whitewater!.gauge)).toBe(JSON.stringify(gauge));
    expect(after.payload.whitewater!.spotId).toBe('spot-truss');
    expect(after.payload.whitewater!.swims).toBe(0);
    expect(after.payload.whitewater!.precip72hMm).toBe(18.4);
  });
});

describe('manual fallback snapshots', () => {
  it('constructs a manual gauge snapshot pinned to the SESSION time, no site fields', () => {
    const snap = manualGaugeSnapshot({
      value: 4.2,
      unit: 'ft',
      parameter: 'gaugeHeight',
      sessionTimeUtc: '2026-07-04T15:00:00Z',
      now: '2026-07-05T17:00:00Z',
    });
    expect(snap).toEqual({
      readings: [
        { parameter: 'gaugeHeight', value: 4.2, unit: 'ft', timeUtc: '2026-07-04T15:00:00Z' },
      ],
      observedAtUtc: '2026-07-04T15:00:00Z', // the river THEN, not entry time
      fetchedAtUtc: '2026-07-05T17:00:00Z',
      source: 'manual',
    });
    expect('siteId' in snap).toBe(false); // absent, never fabricated
  });

  it('constructs a manual wind snapshot with optional gust/direction omitted when absent', () => {
    const full = manualWindSnapshot({
      lat: 45.7115,
      lng: -121.4977,
      speedKts: 24,
      gustKts: 31,
      directionDeg: 280,
      sessionTimeUtc: '2026-07-05T16:00:00Z',
      now: '2026-07-05T17:00:00Z',
    });
    expect(full).toEqual({
      lat: 45.7115,
      lng: -121.4977,
      speedKts: 24,
      gustKts: 31,
      directionDeg: 280,
      observedAtUtc: '2026-07-05T16:00:00Z',
      fetchedAtUtc: '2026-07-05T17:00:00Z',
      source: 'manual',
    });

    const sparse = manualWindSnapshot({
      lat: 45.7115,
      lng: -121.4977,
      speedKts: 18,
      sessionTimeUtc: '2026-07-05T16:00:00Z',
      now: '2026-07-05T17:00:00Z',
    });
    expect('gustKts' in sparse).toBe(false);
    expect('directionDeg' in sparse).toBe(false);
  });

  it('a manual gauge snapshot persists and round-trips like a fetched one', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const gauge = manualGaugeSnapshot({
      value: 1150,
      unit: 'cfs',
      parameter: 'discharge',
      sessionTimeUtc: CTX.now,
      now: CTX.now,
    });
    const form = emptySessionForm();
    form.activity = 'kayak';
    form.durationMin = '60';
    form.whitewater = { ...form.whitewater, gauge };

    const obs = buildSessionObservation(form, { ...CTX, id: 'wf2' });
    await createObservation(obs, db);
    const stored = (await getObservationById('wf2', db)) as ObservationOf<'session'>;

    const rebuilt = buildSessionObservation(invert(stored), { ...CTX, id: 'wf2' });
    expect(JSON.stringify(rebuilt.payload.whitewater!.gauge)).toBe(JSON.stringify(gauge));
  });
});

describe('river-section spot naming (deriveRiverSectionSpot / riverSectionFromSpot)', () => {
  it('derives a joined name from both river and section, trimming whitespace', () => {
    expect(deriveRiverSectionSpot('White Salmon', 'Green Truss')).toEqual({
      name: 'White Salmon · Green Truss',
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
    });
    expect(deriveRiverSectionSpot('  White Salmon  ', '  Green Truss  ')).toEqual({
      name: 'White Salmon · Green Truss',
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
    });
  });

  it('derives from river only or section only, omitting the absent half', () => {
    const riverOnly = deriveRiverSectionSpot('White Salmon', undefined);
    expect(riverOnly).toEqual({ name: 'White Salmon', riverName: 'White Salmon' });
    expect('sectionName' in riverOnly).toBe(false);

    const sectionOnly = deriveRiverSectionSpot(undefined, 'Green Truss');
    expect(sectionOnly).toEqual({ name: 'Green Truss', sectionName: 'Green Truss' });
    expect('riverName' in sectionOnly).toBe(false);
  });

  it('both blank or whitespace-only yields an empty name — the state that keeps Create disabled', () => {
    expect(deriveRiverSectionSpot('', '')).toEqual({ name: '' });
    expect(deriveRiverSectionSpot('   ', '   ')).toEqual({ name: '' });
    expect(deriveRiverSectionSpot(undefined, undefined)).toEqual({ name: '' });
  });

  it('a river-only derived spot persists with sectionName genuinely absent, not an empty string', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    const spot: Spot = {
      id: 'spot-klick',
      kind: 'river-section',
      createdAt: '2026-07-06T10:00:00.000Z',
      ...deriveRiverSectionSpot('Klickitat', undefined),
    };
    await createSpot(spot, db);

    const back = await getSpot('spot-klick', db);
    expect(back?.name).toBe('Klickitat');
    expect(back).not.toHaveProperty('sectionName');
  });

  it('riverSectionFromSpot: river-only spot restores section blank (no name-into-section duplication)', () => {
    const spot: Spot = {
      id: 's1',
      name: 'Klickitat',
      kind: 'river-section',
      riverName: 'Klickitat',
      createdAt: '2026-07-06T10:00:00.000Z',
    };
    expect(riverSectionFromSpot(spot)).toEqual({ riverName: 'Klickitat', sectionName: '' });
  });

  it('riverSectionFromSpot: both-set spot restores both', () => {
    const spot: Spot = {
      id: 's2',
      name: 'White Salmon · Green Truss',
      kind: 'river-section',
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
      createdAt: '2026-07-06T10:00:00.000Z',
    };
    expect(riverSectionFromSpot(spot)).toEqual({
      riverName: 'White Salmon',
      sectionName: 'Green Truss',
    });
  });

  it('riverSectionFromSpot: a legacy spot with neither river nor section restores both blank', () => {
    const spot: Spot = {
      id: 's3',
      name: 'Secret Run', // pre-fix free-typed name, unrelated to river/section
      kind: 'river-section',
      createdAt: '2026-06-01T10:00:00.000Z',
    };
    expect(riverSectionFromSpot(spot)).toEqual({ riverName: '', sectionName: '' });
  });
});

describe('wind flow — downwinder with landing spot, kit expansion, honest failure', () => {
  it('saves a downwind session with a fetched snapshot and an end spot; edit keeps both', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    // Launch + landing come from the spots store, like the SpotPicker does.
    const launch: Spot = {
      id: 'sp-launch',
      name: 'Hood River sandbar',
      kind: 'launch',
      lat: 45.7115,
      lng: -121.4977,
      createdAt: '2026-07-01T00:00:00Z',
    };
    const landing: Spot = {
      id: 'sp-landing',
      name: 'Mosier ramp',
      kind: 'launch',
      lat: 45.684,
      lng: -121.396,
      createdAt: '2026-07-01T00:00:00Z',
    };
    await createSpot(launch, db);
    await createSpot(landing, db);
    expect(await listSpots({ kind: 'launch' }, db)).toHaveLength(2);

    // Recent session → the forecast API's current= block (mocked transport).
    const when = Math.floor(Date.now() / 1000) - 600;
    const impl = routedFetch([['current=', load('om-current-unixtime.json')]]);
    const wind = await fetchWindSnapshot(launch.lat!, launch.lng!, when, {
      fetchImpl: asFetch(impl),
    });
    expect(wind).not.toBeNull();
    expect(wind!.lat).toBe(45.7115); // REQUESTED coords, not the grid echo
    expect(wind!.speedKts).toBe(10.3);

    const form = emptySessionForm();
    form.activity = 'parawing'; // the new registry entry, end to end
    form.durationMin = '80';
    form.wind = {
      note: 'first downwinder on the new wing',
      spotId: launch.id,
      spotName: launch.name,
      sessionStyle: 'downwind',
      endSpotId: landing.id,
      endSpotName: landing.name,
      wind: wind!,
    };

    const obs = buildSessionObservation(form, { ...CTX, id: 'wf3' });
    await createObservation(obs, db);
    const stored = (await getObservationById('wf3', db)) as ObservationOf<'session'>;

    expect(stored.payload.wind!.sessionStyle).toBe('downwind');
    expect(stored.payload.wind!.endSpotId).toBe('sp-landing');
    expect(stored.payload.wind!.endSpotName).toBe('Mosier ramp');
    expect(JSON.stringify(stored.payload.wind!.wind)).toBe(JSON.stringify(wind));

    const rebuilt = buildSessionObservation(invert(stored), { ...CTX, id: 'wf3' });
    await updateObservation(
      { ...rebuilt, source: stored.source, fidelity: stored.fidelity },
      db
    );
    const after = (await getObservationById('wf3', db)) as ObservationOf<'session'>;
    expect(JSON.stringify(after.payload.wind!.wind)).toBe(JSON.stringify(wind));
    expect(after.payload.wind!.endSpotId).toBe('sp-landing');
  });

  it('a kit pick expands gearIds onto the block and records kitId provenance', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    await createGearItem(
      {
        id: 'g-wing',
        name: '9m Duotone Unit',
        category: 'wing',
        spec: { sizeM2: 9 },
        createdAt: '2026-07-01T00:00:00Z',
      },
      db
    );
    await createGearItem(
      { id: 'g-board', name: '95L Rocket', category: 'board', createdAt: '2026-07-01T00:00:00Z' },
      db
    );
    await createKit(
      {
        id: 'k-light',
        name: 'Light-wind setup',
        gearIds: ['g-wing', 'g-board'],
        createdAt: '2026-07-01T00:00:00Z',
      },
      db
    );

    const kit = (await listKits(db)).find((k): k is Kit => k.id === 'k-light')!;
    const patch = kitPickPatch(kit);
    expect(patch).toEqual({ kitId: 'k-light', gearIds: ['g-wing', 'g-board'] });
    // Expansion is a COPY — mutating the form must not reach the kit.
    expect(patch.gearIds).not.toBe(kit.gearIds);

    const form = emptySessionForm();
    form.activity = 'wingfoil';
    form.durationMin = '70';
    form.wind = { ...form.wind, ...patch };

    const obs = buildSessionObservation(form, { ...CTX, id: 'wf4' });
    await createObservation(obs, db);
    const stored = (await getObservationById('wf4', db)) as ObservationOf<'session'>;

    expect(stored.payload.wind!.kitId).toBe('k-light');
    expect(stored.payload.wind!.gearIds).toEqual(['g-wing', 'g-board']);
  });

  it('a failed wind fetch is a typed null → the field stays ABSENT on the saved block', async () => {
    const failing = jest.fn(async () => notFound());
    const snap = await fetchWindSnapshot(45.7, -121.5, Math.floor(Date.now() / 1000) - 600, {
      fetchImpl: asFetch(failing),
    });
    expect(snap).toBeNull();

    // The screen writes nothing on a miss — the block saves without `wind`
    // (absent snapshot ≠ fabricated snapshot), other fields intact.
    const form = emptySessionForm();
    form.activity = 'kitesurf';
    form.durationMin = '55';
    form.wind = { ...form.wind, spotId: 'sp-x', spotName: 'The Wall', note: 'sensor down' };

    const obs = buildSessionObservation(form, { ...CTX, id: 'wf5' });
    expect(obs.payload.wind).toBeDefined();
    expect('wind' in obs.payload.wind!).toBe(false);
    expect(obs.payload.wind!.spotName).toBe('The Wall');
  });
});

describe('workout re-permission nudge flag (healthkit/state)', () => {
  it('is absent until stamped, then reads back and overwrites idempotently', async () => {
    const db = makeTestDb();
    await runMigrations(db);

    expect(await getWorkoutPermsRequestedAt(db)).toBeNull();

    await setWorkoutPermsRequestedAt('2026-07-05T17:00:00Z', db);
    expect(await getWorkoutPermsRequestedAt(db)).toBe('2026-07-05T17:00:00Z');

    // Re-stamping (e.g. a fresh connect after the nudge) upserts, not errors.
    await setWorkoutPermsRequestedAt('2026-07-06T09:00:00Z', db);
    expect(await getWorkoutPermsRequestedAt(db)).toBe('2026-07-06T09:00:00Z');
  });
});
