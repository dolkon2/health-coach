/**
 * recordingSave.ts — turn a finished Map Record track (live recording or
 * imported file) into the SessionForm the proven save path already builds
 * from (map-tab.md §2 save state; built against gps-recording-expo.md §11).
 *
 * Pure translation, no new session shape: the sheet feeds the result to
 * buildSessionObservation exactly like log-session does, so a Map-saved
 * session is indistinguishable from one logged there — same payload slots
 * (endurance.gpsPath / sky.track), same provenance rules (captureMeta →
 * fidelity 0.7 manual; GPX importMeta / IGC trackSource → 0.9 fileimport),
 * same occurredAt (the track's start, not the save tap).
 *
 * Format ↔ surface pairing keeps log-session's parity exactly: GPX attaches
 * to gps-surface (Earth/Water) sessions, IGC to sky — the form types can't
 * represent the cross pairings (endurance.importMeta is literally
 * `format: 'gpx'`; sky.trackSource is `'igc' | 'liveGps'`), and inventing a
 * new provenance shape is not M2's call. pairTrackFormat() names the
 * mismatch plainly for the door to surface.
 */
import type { GeoPoint } from '@core/observation';
import type { ConditionsSnapshot } from '@core/conditions';
import { elementOf, type Activity } from '@/lib/activity';
import {
  emptySessionForm,
  enduranceWithRoute,
  numStr,
  type SessionForm,
} from '@/lib/session';
import { summarizeTrack, type TrackSummary } from '@/lib/gpsTrack';
import { metersToDisplay, type DistanceUnit } from '@/lib/units';
import { detectAutoSegments, type SkyDetectorActivity } from '@/lib/flightDetector';

export type TrackOrigin =
  | { kind: 'record' }
  | { kind: 'import'; format: 'gpx' | 'igc'; filename?: string };

export type RecordingSaveInput = {
  activity: Activity;
  /** Raw fixes, ≥ 2. Sky stores them whole (a track is never trimmed once
   *  attached); gps-surface stores the thinned copy via summarizeTrack. */
  points: GeoPoint[];
  origin: TrackOrigin;
  notes?: string;
  /** A parsed file's <name> — seeds notes when the user typed none
   *  (importGpxFile parity). */
  name?: string;
  /** The resolved silent conditions freeze — folded in on gps-surface only
   *  (the sky builder has no conditions slot today; parity, flagged). */
  conditions?: ConditionsSnapshot | null;
  distanceUnit: DistanceUnit;
  /** Parser-computed overrides for an imported file (a GPX's distance is
   *  summed per-segment and its gain may be honestly absent for a planned
   *  <rte>) — a live recording derives everything from the fixes. */
  distanceM?: number;
  elevationGainM?: number;
  elevationGainSource?: 'gps';
  durationMin?: number;
  startTime?: string;
  /** Set when Record was armed with a route to follow (routes-spec M4,
   *  Session 9) — tags the finished session's endurance/sky block. */
  routeId?: string;
};

/**
 * Which import format an armed activity's surface can honestly carry —
 * log-session parity: GPX → gps-surface (Earth/Water), IGC → sky. Null when
 * the pairing is fine; otherwise a plain sentence for the door to show.
 */
export function pairTrackFormat(activity: Activity, format: 'gpx' | 'igc'): string | null {
  if (format === 'gpx' && activity.surface !== 'gps') {
    return `That's a GPX track — arm an Earth or Water sport to import it (${activity.label} doesn't take one).`;
  }
  if (format === 'igc' && activity.surface !== 'sky') {
    return `That's an IGC flight log — arm a Sky sport to import it (${activity.label} doesn't take one).`;
  }
  return null;
}

/**
 * True when Record should capture GPS on the map for this activity —
 * routing follows the LOGGING SURFACE, not the dimension (map-tab ⚑6:
 * indoor climbing and pool swim are Earth/Water by element but their
 * logging surface is not a track). Everything else keeps M1's deep-link
 * to log-session.
 */
export function recordsOnMap(activity: Activity): boolean {
  return activity.surface === 'gps' || activity.surface === 'sky';
}

export type RecordingSaveDraft = {
  form: SessionForm;
  summary: TrackSummary;
};

/**
 * Whether a track needs the user ASKED for a duration (nothing derivable:
 * no parser figure, no fix-timestamp span). The single source of truth for
 * both the sheet's conditional Duration field and the form builder's
 * empty-duration branch — two independent derivations of this predicate
 * would drift (review finding).
 */
export function needsDurationAsk(input: { durationMin?: number; durationSec: number }): boolean {
  return input.durationMin == null && input.durationSec <= 0;
}

/**
 * Build the SessionForm for a finished track. Throws with a plain message
 * on inputs the sheet should have prevented (fewer than 2 fixes, an
 * activity that doesn't record on the map, an impossible format pairing) —
 * defence in depth, same posture as buildSessionObservation's re-validate.
 */
/**
 * A stored track is canonical GeoPoint ONLY — the buffer's capture metadata
 * (accuracy/speed/mocked) stays in the buffer for M3's read-time
 * derivations and must never leak into a saved payload. Rebuilt key-by-key
 * (not rest-spread) so any future metadata key is excluded by default.
 */
function toCleanGeoPoint(p: GeoPoint): GeoPoint {
  return {
    lat: p.lat,
    lng: p.lng,
    tsSec: p.tsSec,
    ...(p.eleM != null ? { eleM: p.eleM, eleSource: p.eleSource ?? 'gps' } : {}),
  };
}

export function recordingSessionForm(input: RecordingSaveInput): RecordingSaveDraft {
  const { activity, origin } = input;
  const points = input.points.map(toCleanGeoPoint);
  if (points.length < 2) throw new Error('That recording has no usable track.');
  if (!recordsOnMap(activity)) {
    throw new Error(`${activity.label} doesn't log a GPS track.`);
  }
  if (origin.kind === 'import') {
    const mismatch = pairTrackFormat(activity, origin.format);
    if (mismatch) throw new Error(mismatch);
  }

  const summary = summarizeTrack(points);
  const startTime = input.startTime ?? summary.startTime;

  const base = emptySessionForm();
  const seeded: SessionForm = {
    ...base,
    activity: activity.id,
    modality: null,
    // Same seeding as log-session's seededFormForActivity: the activity's
    // default energy system is an editable starting point, not a claim.
    endurance: activity.defaultEnergySystem
      ? { ...base.endurance, energySystem: activity.defaultEnergySystem }
      : base.endurance,
  };

  // Duration: the parser's figure for an import, else the fix-timestamp span.
  // Sub-minute spans round up to the 1-minute floor validation requires; an
  // untimed track (a planned <rte> with no timestamps) yields NO duration —
  // the sheet asks the user rather than fabricating one (needsDurationAsk is
  // the shared predicate).
  const durationMin = needsDurationAsk({
    durationMin: input.durationMin,
    durationSec: summary.durationSec,
  })
    ? ''
    : input.durationMin != null
      ? String(Math.max(1, Math.round(input.durationMin)))
      : String(Math.max(1, Math.round(summary.durationSec / 60)));

  const notes = (input.notes ?? '').trim() || (input.name ?? '').trim();

  if (activity.surface === 'sky') {
    const trackSource = origin.kind === 'record' ? ('liveGps' as const) : ('igc' as const);
    return {
      form: {
        ...seeded,
        durationMin,
        notes,
        sky: {
          ...seeded.sky,
          track: points, // FULL resolution — a sky track is never thinned
          trackSource,
          segments: detectAutoSegments(points, activity.id as SkyDetectorActivity, trackSource),
          ...(input.routeId ? { routeId: input.routeId } : {}),
        },
      },
      summary,
    };
  }

  // gps surface (Earth/Water) — applyCapturedRoute / importGpxFile parity.
  const distanceM = input.distanceM ?? summary.distanceM;
  const gain =
    origin.kind === 'record'
      ? summary.elevationGainM != null
        ? { elevationGainM: summary.elevationGainM, elevationGainSource: 'gps' as const }
        : {}
      : input.elevationGainM != null
        ? {
            elevationGainM: input.elevationGainM,
            ...(input.elevationGainSource != null
              ? { elevationGainSource: input.elevationGainSource }
              : {}),
          }
        : {};
  const meta =
    origin.kind === 'record'
      ? { captureMeta: { startTime: startTime ?? new Date().toISOString() } }
      : {
          importMeta: {
            format: 'gpx' as const,
            ...(origin.filename ? { filename: origin.filename } : {}),
            ...(startTime ? { startTime } : {}),
          },
        };

  const endurance = enduranceWithRoute(
    seeded.endurance,
    {
      gpsPath: summary.points, // thinned for storage; stats are full-resolution
      ...(distanceM > 0 ? { distance: numStr(metersToDisplay(distanceM, input.distanceUnit), 2) } : {}),
      ...gain,
    },
    meta
  );

  return {
    form: {
      ...seeded,
      durationMin,
      notes,
      endurance: {
        ...endurance,
        // The silent freeze rides only when something actually landed — an
        // empty snapshot is never stored (freeze.ts contract).
        ...(input.conditions?.weather ? { conditionsMeta: input.conditions } : {}),
        ...(input.routeId ? { routeId: input.routeId } : {}),
      },
    },
    summary,
  };
}

/**
 * The element for a recording's buffer row — Body can never reach here
 * (recordsOnMap gates first; Body sessions never appear on any map surface).
 */
export function recordingElementOf(activity: Activity): 'earth' | 'sky' | 'water' {
  const el = elementOf(activity);
  if (el === 'body') throw new Error(`${activity.label} doesn't record on the map.`);
  return el;
}
