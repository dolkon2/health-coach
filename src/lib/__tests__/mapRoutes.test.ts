import { describe, it, expect } from '@jest/globals';
import type { Route } from '@core/route';
import { routesForLayer } from '../mapRoutes';

function route(id: string, activityId: string, points: Route['points'] = []): Route {
  return {
    id,
    name: id,
    activityId,
    source: 'plotted',
    points,
    visibility: 'private',
  };
}

const P = [{ lat: 45.7, lng: -121.5 }];

describe('routesForLayer', () => {
  it('includes an Earth route, tagged with its element', () => {
    const out = routesForLayer([route('r1', 'trail-run', P)]);
    expect(out).toEqual([{ id: 'r1', points: P, element: 'earth' }]);
  });

  it('includes a Water route', () => {
    const out = routesForLayer([route('r2', 'kayak', P)]);
    expect(out).toEqual([{ id: 'r2', points: P, element: 'water' }]);
  });

  it('includes a Sky route', () => {
    const out = routesForLayer([route('r3', 'paragliding', P)]);
    expect(out).toEqual([{ id: 'r3', points: P, element: 'sky' }]);
  });

  it('structurally excludes a Body-mapped activity', () => {
    const out = routesForLayer([route('r4', 'gym', P)]);
    expect(out).toEqual([]);
  });

  it('omits a route with no points', () => {
    const out = routesForLayer([route('r5', 'trail-run', [])]);
    expect(out).toEqual([]);
  });

  it('omits a route whose activity id does not resolve', () => {
    const out = routesForLayer([route('r6', 'not-a-real-activity', P)]);
    expect(out).toEqual([]);
  });
});
