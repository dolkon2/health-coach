/**
 * mapTraces.ts — pure helper for My Map's "your own traces" layer
 * (map-tab.md REFRAME AMENDMENT). Kept free of native deps, same posture as
 * mapRecord.ts: unit-tested without expo-location/MapLibre.
 *
 * Body is excluded STRUCTURALLY, never by a filter flag: `isMapElement`'s
 * return-type guard is the only branch point, mirroring mapRecord.ts's
 * `isRecordableActivity` — there is no `includeBody`/`elements` parameter a
 * caller could flip. A Body session simply cannot produce a `SessionTrace`.
 */
import type { ObservationOf } from '@core/observation';
import type { LatLng } from '@core/geo';
import { activityById, elementOf, type Element } from './activity';

function isMapElement(x: Element | undefined): x is 'earth' | 'water' | 'sky' {
  return x === 'earth' || x === 'water' || x === 'sky';
}

export type SessionTrace = {
  id: string;
  element: 'earth' | 'water' | 'sky';
  points: LatLng[];
};

/**
 * A session's GPS track, wherever it lives — Earth/Water's `endurance.gpsPath`,
 * Water's bespoke `paddling.gpsPath` (rides alongside endurance, not instead
 * of it — a paddling session's track lives on `paddling`, not `endurance`),
 * or Sky's `sky.track`. Absent when none of the three carry one (a
 * hand-logged session has no track — never fabricated).
 */
function trackOf(payload: ObservationOf<'session'>['payload']): LatLng[] | undefined {
  return payload.endurance?.gpsPath ?? payload.paddling?.gpsPath ?? payload.sky?.track;
}

/**
 * Every E/S/W session with a usable track, for My Map's traces layer — "the
 * honest personal heatmap v1." A session with no track, or fewer than 2
 * points, is simply absent, never a fabricated single-point line.
 */
export function sessionTracks(
  sessions: ReadonlyArray<ObservationOf<'session'>>
): SessionTrace[] {
  const out: SessionTrace[] = [];
  for (const s of sessions) {
    const activity = s.payload.activity ? activityById(s.payload.activity) : undefined;
    if (!activity) continue;
    const element = elementOf(activity);
    if (!isMapElement(element)) continue; // Body (and anything unresolved) never reaches the map
    const track = trackOf(s.payload);
    if (!track || track.length < 2) continue;
    out.push({ id: s.id, element, points: track });
  }
  return out;
}
