/**
 * mapRoutes.ts — pure helper for My Map's saved-routes layer (map-tab.md
 * REFRAME AMENDMENT). Mirrors mapTraces.ts's shape: same activity→element
 * resolution, same "Body/unresolved excluded structurally via a type guard,
 * never a filter flag" pattern, kept free of native deps so it's
 * unit-tested without MapLibre.
 */
import type { Route } from '@core/route';
import { activityById, elementOf, type Element } from './activity';

function isMapElement(x: Element | undefined): x is 'earth' | 'water' | 'sky' {
  return x === 'earth' || x === 'water' || x === 'sky';
}

export type MapElement = 'earth' | 'water' | 'sky';
export type RouteForLayer = { id: string; points: Route['points']; element: MapElement };

/**
 * Every route whose activity resolves to Earth/Water/Sky and carries at
 * least one point, ready for MapSurface's `routes` prop. A route with no
 * points, or an unresolved/Body-mapped activity id, is simply absent.
 */
export function routesForLayer(routes: ReadonlyArray<Route>): RouteForLayer[] {
  const out: RouteForLayer[] = [];
  for (const r of routes) {
    if (r.points.length === 0) continue;
    const activity = activityById(r.activityId);
    const element = activity ? elementOf(activity) : undefined;
    if (!isMapElement(element)) continue;
    out.push({ id: r.id, points: r.points, element });
  }
  return out;
}
