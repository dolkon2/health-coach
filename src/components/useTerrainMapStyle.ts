/**
 * useTerrainMapStyle — fetches a MapTiler style URL once and layers v11
 * terrain/sky onto it (mapTerrain.ts), so `Map`'s `mapStyle` gets the richer
 * object once ready. Terrain is presentation-only polish, never a reason to
 * blank the basemap: any fetch/parse failure just leaves the return value at
 * the plain style URL string, which renders the flat 2D basemap exactly as
 * before this pass. `styleUrl` is a pure function of a build-time env var
 * (config.ts), so it never changes within a session — the module-level cache
 * only needs to dedupe the one-time fetch across RouteMap/MapSurface mounts.
 */
import { useEffect, useState } from 'react';
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { withTerrain } from '@/lib/mapTerrain';

const cache = new Map<string, StyleSpecification>();

export function useTerrainMapStyle(styleUrl: string | null): string | StyleSpecification | null {
  const [augmented, setAugmented] = useState<StyleSpecification | null>(
    styleUrl ? (cache.get(styleUrl) ?? null) : null
  );

  useEffect(() => {
    if (!styleUrl || cache.has(styleUrl)) return;
    let cancelled = false;
    fetch(styleUrl)
      .then((res) => res.json())
      .then((json: StyleSpecification) => {
        if (cancelled) return;
        const terrainStyle = withTerrain(json);
        cache.set(styleUrl, terrainStyle);
        setAugmented(terrainStyle);
      })
      .catch(() => {
        // Network hiccup or malformed style JSON — stay on the plain URL string.
      });
    return () => {
      cancelled = true;
    };
  }, [styleUrl]);

  if (!styleUrl) return null;
  return augmented ?? styleUrl;
}
