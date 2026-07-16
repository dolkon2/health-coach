import { describe, it, expect } from '@jest/globals';
import {
  emptyBuilder,
  appendWaypoint,
  undoWaypoint,
  clearBuilder,
  retargetMode,
  builderRoutePoints,
  builderDistanceM,
  builderSource,
  builderHonestyLabel,
  canSaveBuilder,
  buildRoute,
  type BuilderSegment,
  type BuilderState,
} from '../routeBuilder';
import { routeDistanceM } from '@core/route';

const w0 = { lat: 45.0, lng: -121.0 };
const w1 = { lat: 45.01, lng: -121.01 };
const w2 = { lat: 45.02, lng: -121.0 };
const m01 = { lat: 45.005, lng: -121.008 };
const m12 = { lat: 45.015, lng: -121.005 };

const straight = (a: typeof w0, b: typeof w0): BuilderSegment => ({ coords: [a, b], fellBack: false });
const snapped = (coords: typeof w0[]): BuilderSegment => ({ coords, fellBack: false });

describe('emptyBuilder', () => {
  it('resolves the mode from the activity', () => {
    expect(emptyBuilder('run').mode).toBe('foot');
    expect(emptyBuilder('mtb').mode).toBe('bike');
    expect(emptyBuilder('kayak').mode).toBe('river');
    expect(emptyBuilder('paragliding').mode).toBe('freeline');
  });
  it('starts empty', () => {
    const s = emptyBuilder('run');
    expect(s.waypoints).toEqual([]);
    expect(s.segments).toEqual([]);
  });
});

describe('appendWaypoint / undo / clear', () => {
  it('adds the first waypoint with no segment', () => {
    const s = appendWaypoint(emptyBuilder('run'), w0, null);
    expect(s.waypoints).toEqual([w0]);
    expect(s.segments).toEqual([]);
  });

  it('adds a later waypoint with its segment', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, straight(w0, w1));
    expect(s.waypoints).toEqual([w0, w1]);
    expect(s.segments).toHaveLength(1);
  });

  it('ignores a non-first append with a null segment (invariant guard)', () => {
    const s0 = appendWaypoint(emptyBuilder('run'), w0, null);
    expect(appendWaypoint(s0, w1, null)).toBe(s0);
  });

  it('undo removes the last waypoint and its segment', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, straight(w0, w1));
    s = undoWaypoint(s);
    expect(s.waypoints).toEqual([w0]);
    expect(s.segments).toEqual([]);
  });

  it('undo on an empty builder is a no-op', () => {
    const s = emptyBuilder('run');
    expect(undoWaypoint(s)).toBe(s);
  });

  it('clear drops waypoints but keeps the mode', () => {
    let s = appendWaypoint(emptyBuilder('kayak'), w0, null);
    s = appendWaypoint(s, w1, straight(w0, w1));
    const cleared = clearBuilder(s);
    expect(cleared.waypoints).toEqual([]);
    expect(cleared.segments).toEqual([]);
    expect(cleared.mode).toBe('river');
  });
});

describe('retargetMode', () => {
  it('changes the mode and drops cached segments', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, straight(w0, w1));
    const r = retargetMode(s, 'freeline');
    expect(r.mode).toBe('freeline');
    expect(r.segments).toEqual([]);
    expect(r.waypoints).toEqual([w0, w1]);
  });
});

describe('builderRoutePoints — kind tagging', () => {
  it('is empty for no waypoints', () => {
    expect(builderRoutePoints(emptyBuilder('run'))).toEqual([]);
  });

  it('tags a single placed waypoint', () => {
    const s = appendWaypoint(emptyBuilder('run'), w0, null);
    expect(builderRoutePoints(s)).toEqual([{ lat: w0.lat, lng: w0.lng, kind: 'waypoint' }]);
  });

  it('free-line: points === waypoints, both tagged waypoint', () => {
    let s = appendWaypoint(emptyBuilder('paragliding'), w0, null);
    s = appendWaypoint(s, w1, straight(w0, w1));
    const pts = builderRoutePoints(s);
    expect(pts).toHaveLength(2);
    expect(pts.every((p) => p.kind === 'waypoint')).toBe(true);
  });

  it('snapped: endpoints are waypoints, in-between are derived, joins deduped', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, snapped([w0, m01, w1]));
    s = appendWaypoint(s, w2, snapped([w1, m12, w2]));
    const pts = builderRoutePoints(s);
    // w0(wp), m01(derived), w1(wp), m12(derived), w2(wp) — join w1 not doubled
    expect(pts.map((p) => p.kind)).toEqual(['waypoint', 'derived', 'waypoint', 'derived', 'waypoint']);
    expect(pts).toHaveLength(5);
  });
});

describe('builderDistanceM', () => {
  it('is the honest haversine fold over the flattened geometry', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, snapped([w0, m01, w1]));
    expect(builderDistanceM(s)).toBeCloseTo(routeDistanceM(builderRoutePoints(s)), 6);
  });
  it('is 0 with fewer than two points', () => {
    expect(builderDistanceM(appendWaypoint(emptyBuilder('run'), w0, null))).toBe(0);
  });
});

describe('builderSource', () => {
  it('maps mode → source', () => {
    expect(builderSource('foot')).toBe('snapped');
    expect(builderSource('bike')).toBe('snapped');
    expect(builderSource('river')).toBe('river');
    expect(builderSource('freeline')).toBe('plotted');
  });
});

describe('builderHonestyLabel', () => {
  const two = (mode: BuilderState['mode'], fellBack: boolean): BuilderState => ({
    activityId: 'x',
    mode,
    waypoints: [w0, w1],
    segments: [{ coords: [w0, w1], fellBack }],
  });

  it('snapped: along trails, with a caveat when a segment fell back', () => {
    expect(builderHonestyLabel(two('foot', false))).toBe('along trails');
    expect(builderHonestyLabel(two('foot', true))).toContain('plotted straight');
  });
  it('river: along the waterway, with a caveat on fallback', () => {
    expect(builderHonestyLabel(two('river', false))).toBe('along the waterway');
    expect(builderHonestyLabel(two('river', true))).toContain('no river found');
  });
  it('free-line: as plotted, trails may be longer', () => {
    expect(builderHonestyLabel(two('freeline', false))).toBe('as plotted — trails may be longer');
  });
  it('never mentions elevation', () => {
    for (const mode of ['foot', 'bike', 'river', 'freeline'] as const) {
      expect(builderHonestyLabel(two(mode, true)).toLowerCase()).not.toContain('elev');
    }
  });
});

describe('canSaveBuilder / buildRoute', () => {
  it('cannot save with fewer than two points', () => {
    const s = appendWaypoint(emptyBuilder('run'), w0, null);
    expect(canSaveBuilder(s)).toBe(false);
    expect(buildRoute(s, 'x', 'id-1')).toBeNull();
  });

  it('builds a private route with source-by-mode and kind-tagged points', () => {
    let s = appendWaypoint(emptyBuilder('run'), w0, null);
    s = appendWaypoint(s, w1, snapped([w0, m01, w1]));
    expect(canSaveBuilder(s)).toBe(true);
    const route = buildRoute(s, '  Dawn loop  ', 'id-1');
    expect(route).not.toBeNull();
    expect(route!.id).toBe('id-1');
    expect(route!.name).toBe('  Dawn loop  '); // hook trims; buildRoute stores as given
    expect(route!.activityId).toBe('run');
    expect(route!.source).toBe('snapped');
    expect(route!.visibility).toBe('private');
    expect(route!.points.map((p) => p.kind)).toEqual(['waypoint', 'derived', 'waypoint']);
  });

  it('tags a river build as source river', () => {
    let s = appendWaypoint(emptyBuilder('kayak'), w0, null);
    s = appendWaypoint(s, w1, snapped([w0, m01, w1]));
    expect(buildRoute(s, 'Run the gorge', 'id-2')!.source).toBe('river');
  });
});
