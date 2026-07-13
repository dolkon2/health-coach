/**
 * TerrainHillshade — the terrain-RGB source + hillshade layer shared by every
 * terrain-enabled map surface (RouteMap, MapSurface). `terrainReady` is the
 * same flag useTerrainMapStyle used to decide whether the style's `terrain`
 * field was set — rendering this only when that flag is true keeps the style
 * field and the actual DEM source from ever disagreeing (a `terrain` field
 * with no matching source is a MapLibre style error, not a graceful no-op).
 */
import type { MapLibreModule } from './mapLibre';
import { TERRAIN_SOURCE_ID } from '@/lib/mapTerrain';

type TerrainHillshadeProps = {
  MapLibre: MapLibreModule;
  terrainReady: boolean;
  terrainTileUrl: string | null;
  layerId: string;
};

export function TerrainHillshade({
  MapLibre,
  terrainReady,
  terrainTileUrl,
  layerId,
}: TerrainHillshadeProps) {
  if (!terrainReady || !terrainTileUrl) return null;
  const { RasterDEMSource, Layer } = MapLibre;
  return (
    <RasterDEMSource id={TERRAIN_SOURCE_ID} url={terrainTileUrl} encoding="mapbox">
      <Layer type="hillshade" id={layerId} />
    </RasterDEMSource>
  );
}
