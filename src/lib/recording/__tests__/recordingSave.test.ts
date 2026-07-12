/**
 * recordingSave tests — the save-dispatch by element, run all the way
 * through buildSessionObservation so what's asserted is the payload that
 * actually lands: Earth/Water tracks in endurance.gpsPath (captureMeta →
 * fidelity 0.7, occurredAt = track start), Sky tracks RAW in sky.track with
 * auto-stamped segments, GPX imports at fileimport/0.9, the silent
 * conditions snapshot riding payload.conditions only when the freeze landed,
 * and the format ↔ surface pairings log-session can't represent refused
 * plainly instead of mislabeled.
 */
import { describe, it, expect } from '@jest/globals';
import type { GeoPoint } from '@core/observation';
import type { ConditionsSnapshot } from '@core/conditions';
import { activityById } from '@/lib/activity';
import { buildSessionObservation } from '@/lib/session';
import {
  recordingSessionForm,
  recordsOnMap,
  pairTrackFormat,
  recordingElementOf,
} from '../recordingSave';

const T0 = 1_782_921_600; // whole-second epoch for a deterministic startTime

/** A tiny northbound track: ~111 m per 0.001° lat, one fix per 10 s. */
function track(n: number, withEle = false): GeoPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    lat: 45.7 + i * 0.001,
    lng: -121.5,
    tsSec: T0 + i * 10,
    ...(withEle ? { eleM: 100 + i * 5, eleSource: 'gps' as const } : {}),
  }));
}

const ctx = {
  id: '0198c000-0000-7000-8000-000000000001',
  now: '2026-07-11T22:00:00.000Z',
  tz: 'America/Los_Angeles',
  weightUnit: 'lb' as const,
  distanceUnit: 'mi' as const,
};

const act = (id: string) => {
  const a = activityById(id);
  if (!a) throw new Error(`registry lost '${id}'`);
  return a;
};

describe('recordingSessionForm — record → save dispatch', () => {
  it('Earth recording lands in endurance.gpsPath at live-capture provenance', () => {
    const { form, summary } = recordingSessionForm({
      activity: act('run'),
      points: track(30, true),
      origin: { kind: 'record' },
      distanceUnit: 'mi',
    });
    expect(form.activity).toBe('run');
    expect(form.endurance.gpsPath).toEqual(summary.points);
    expect(form.endurance.captureMeta?.startTime).toBe(new Date(T0 * 1000).toISOString());
    expect(form.endurance.importMeta).toBeUndefined();
    expect(form.endurance.elevationGainSource).toBe('gps');
    expect(form.endurance.energySystem).toBe('aerobic'); // registry default seeded
    expect(Number(form.durationMin)).toBe(5); // 29 × 10 s ≈ 4.8 min

    const obs = buildSessionObservation(form, ctx);
    expect(obs.fidelity).toBe(0.7); // live phone capture
    expect(obs.source).toEqual({ type: 'manual' });
    expect(obs.occurredAt).toBe(new Date(T0 * 1000).toISOString()); // track start, not save tap
    expect(obs.payload.endurance?.gpsPath).toEqual(summary.points);
  });

  it('Water (kayak) rides the same endurance envelope', () => {
    const { form } = recordingSessionForm({
      activity: act('kayak'),
      points: track(20),
      origin: { kind: 'record' },
      distanceUnit: 'mi',
    });
    const obs = buildSessionObservation(form, ctx);
    expect(obs.payload.activity).toBe('kayak');
    expect(obs.payload.endurance?.gpsPath).toBeDefined();
    expect(obs.payload.whitewater).toBeUndefined(); // untouched section writes nothing
  });

  it('Sky recording keeps the RAW track with auto-stamped segments', () => {
    const raw = track(600, true); // > MAX_STORED_POINTS-irrelevant: sky never thins
    const { form } = recordingSessionForm({
      activity: act('paragliding'),
      points: raw,
      origin: { kind: 'record' },
      distanceUnit: 'mi',
    });
    expect(form.sky.track).toBe(raw); // same reference — never copied/trimmed
    expect(form.sky.trackSource).toBe('liveGps');
    expect(form.sky.segments.length).toBeGreaterThan(0);
    expect(form.sky.segments.every((s) => s.provenance === 'auto')).toBe(true);

    const obs = buildSessionObservation(form, ctx);
    expect(obs.fidelity).toBe(0.7);
    expect(obs.payload.sky?.track).toHaveLength(600);
    expect(obs.occurredAt).toBe(new Date(T0 * 1000).toISOString());
  });

  it('folds a landed conditions freeze into payload.conditions — and only a landed one', () => {
    const snapshot = { weather: { tempC: 18 } } as ConditionsSnapshot;
    const withWeather = recordingSessionForm({
      activity: act('hike'),
      points: track(10),
      origin: { kind: 'record' },
      conditions: snapshot,
      distanceUnit: 'mi',
    });
    expect(buildSessionObservation(withWeather.form, ctx).payload.conditions).toEqual(snapshot);

    const emptyFreeze = recordingSessionForm({
      activity: act('hike'),
      points: track(10),
      origin: { kind: 'record' },
      conditions: {} as ConditionsSnapshot, // all sub-fetches failed — stays absent
      distanceUnit: 'mi',
    });
    expect(buildSessionObservation(emptyFreeze.form, ctx).payload.conditions).toBeUndefined();
  });
});

describe('recordingSessionForm — import origin', () => {
  it('GPX import carries importMeta and lands at fileimport/0.9', () => {
    const { form } = recordingSessionForm({
      activity: act('run'),
      points: track(10),
      origin: { kind: 'import', format: 'gpx', filename: 'morning.gpx' },
      name: 'Morning loop',
      distanceM: 2500,
      durationMin: 24,
      startTime: '2026-07-04T14:00:00.000Z',
      distanceUnit: 'mi',
    });
    expect(form.endurance.importMeta).toEqual({
      format: 'gpx',
      filename: 'morning.gpx',
      startTime: '2026-07-04T14:00:00.000Z',
    });
    expect(form.endurance.captureMeta).toBeUndefined();
    expect(form.notes).toBe('Morning loop'); // <name> seeds empty notes
    expect(form.durationMin).toBe('24'); // parser's figure wins

    const obs = buildSessionObservation(form, ctx);
    expect(obs.fidelity).toBe(0.9);
    expect(obs.source).toEqual({ type: 'fileimport', format: 'gpx', filename: 'morning.gpx' });
    expect(obs.occurredAt).toBe('2026-07-04T14:00:00.000Z');
  });

  it('IGC import to a Sky activity lands as trackSource igc / 0.9', () => {
    const { form } = recordingSessionForm({
      activity: act('paragliding'),
      points: track(20, true),
      origin: { kind: 'import', format: 'igc' },
      distanceUnit: 'mi',
    });
    expect(form.sky.trackSource).toBe('igc');
    const obs = buildSessionObservation(form, ctx);
    expect(obs.fidelity).toBe(0.9);
    expect(obs.source).toEqual({ type: 'fileimport', format: 'igc' });
  });

  it('refuses the cross pairings the form cannot represent, in plain words', () => {
    expect(pairTrackFormat(act('run'), 'igc')).toMatch(/IGC flight log/);
    expect(pairTrackFormat(act('paragliding'), 'gpx')).toMatch(/GPX track/);
    expect(pairTrackFormat(act('run'), 'gpx')).toBeNull();
    expect(pairTrackFormat(act('paragliding'), 'igc')).toBeNull();
    expect(() =>
      recordingSessionForm({
        activity: act('run'),
        points: track(5),
        origin: { kind: 'import', format: 'igc' },
        distanceUnit: 'mi',
      })
    ).toThrow(/IGC flight log/);
  });

  it('an untimed track yields no duration — asked, never fabricated', () => {
    const untimed = track(5).map((p) => ({ ...p, tsSec: 0 }));
    const { form } = recordingSessionForm({
      activity: act('run'),
      points: untimed,
      origin: { kind: 'import', format: 'gpx' },
      distanceUnit: 'mi',
    });
    expect(form.durationMin).toBe('');
    expect(() => buildSessionObservation(form, ctx)).toThrow(/duration/i);
  });
});

describe('routing follows the logging surface (⚑6)', () => {
  it('gps + sky surfaces record on the map; climbing/swim/gym keep the log-session door', () => {
    expect(recordsOnMap(act('run'))).toBe(true);
    expect(recordsOnMap(act('kayak'))).toBe(true);
    expect(recordsOnMap(act('paragliding'))).toBe(true);
    expect(recordsOnMap(act('climb'))).toBe(false);
    expect(recordsOnMap(act('swim'))).toBe(false);
    expect(recordsOnMap(act('gym'))).toBe(false);
  });

  it('maps activities to buffer elements, and Body can never reach a map recording', () => {
    expect(recordingElementOf(act('run'))).toBe('earth');
    expect(recordingElementOf(act('kayak'))).toBe('water');
    expect(recordingElementOf(act('paragliding'))).toBe('sky');
    expect(() => recordingElementOf(act('gym'))).toThrow(/doesn't record on the map/);
  });
});
