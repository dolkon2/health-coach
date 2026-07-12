/**
 * MapSurface — the full-bleed basemap for the Map tab's Record pre-start
 * (map-tab.md M1). Centers on a given coordinate and drops a tappable sport-icon
 * pin for each spot that carries real coordinates.
 *
 * Honest degradations, never a fabricated or blank map frame:
 *   - No MapTiler key (mapStyleUrl() === null) → a neutral placeholder telling
 *     the truth ("map needs a key"). M0 (keyless OpenFreeMap default) is a
 *     separate pass; until then the map is the keyed upgrade.
 *   - Native MapLibre module absent (old dev build / jest / node) → the same
 *     neutral placeholder. The trace path (RouteMap) has its own SVG fallback;
 *     a live basemap has no honest still-image equivalent, so we say so plainly.
 *
 * The native module loads via the shared lazy `loadMapLibre` (mapLibre.ts), so
 * importing this file anywhere is safe — the require runs only on-device.
 *
 * `guidePath` (routes-spec M4, Session 9): an optional muted line for a route
 * Record was armed to follow — "line + self-position, user navigates
 * themselves," the watch-breadcrumb pattern (routes-implementation.md §1),
 * never a routed/snapped line. No off-route detection, no alerts, ever.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import type { Spot } from '@core/spot';
import type { LatLng } from '@core/geo';
import { useTheme } from '@/theme';
import { mapStyleUrl } from '@/lib/config';
import { loadMapLibre, type LngLat } from './mapLibre';
import { spotIcon } from './activityIcons';
import { Text } from './Text';
import { toLineString } from './geoJson';

type PinnableSpot = Spot & { lat: number; lng: number };

type MapSurfaceProps = {
  center?: LngLat;
  zoom?: number;
  pins: ReadonlyArray<PinnableSpot>;
  onPressPin: (spot: Spot) => void;
  guidePath?: LatLng[];
};

const GUIDE_SOURCE_ID = 'guide-route-source';
const GUIDE_LAYER_ID = 'guide-route-line';

function MapUnavailable({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[6],
        backgroundColor: theme.colors.surface,
      }}
    >
      <MapPin size={32} color={theme.colors.textMuted} strokeWidth={1.5} />
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

/** One spot's pin: a sport-icon badge that pushes to its detail on tap. */
function SpotPin({ spot, onPress }: { spot: PinnableSpot; onPress: () => void }) {
  const theme = useTheme();
  const Icon = spotIcon(spot);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Open ${spot.name}`}
      style={{
        width: 34,
        height: 34,
        borderRadius: theme.radius.full,
        borderWidth: 2,
        borderColor: theme.colors.accent,
        backgroundColor: theme.colors.surfaceRaised,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={18} color={theme.colors.accent} strokeWidth={1.75} />
    </Pressable>
  );
}

function MapSurfaceInner({ center, zoom, pins, onPressPin, guidePath }: MapSurfaceProps) {
  const theme = useTheme();
  const styleUrl = mapStyleUrl();
  if (!styleUrl) {
    return <MapUnavailable message="The map needs a MapTiler key to render. Recording still works." />;
  }

  const MapLibre = loadMapLibre();
  if (!MapLibre) {
    return <MapUnavailable message="The map needs an updated dev build to render. Recording still works." />;
  }
  const { MapView, Camera, MarkerView, ShapeSource, LineLayer } = MapLibre;
  const hasGuide = guidePath != null && guidePath.length >= 2;

  return (
    <View style={{ flex: 1 }}>
      <MapView mapStyle={styleUrl} style={{ flex: 1 }} logoEnabled={false}>
        {/* Omit the Camera entirely when we have no honest center — a bare zoom
            would park MapLibre at [0,0]; no Camera lets the style default hold. */}
        {center ? (
          <Camera centerCoordinate={center} zoomLevel={zoom} animationDuration={0} />
        ) : null}
        {hasGuide ? (
          <ShapeSource id={GUIDE_SOURCE_ID} shape={toLineString(guidePath)}>
            <LineLayer
              id={GUIDE_LAYER_ID}
              style={{
                lineColor: theme.colors.textMuted,
                lineWidth: 2.5,
                lineDasharray: [2, 2],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}
        {pins.map((spot) => (
          <MarkerView key={spot.id} coordinate={[spot.lng, spot.lat]} allowOverlap>
            <SpotPin spot={spot} onPress={() => onPressPin(spot)} />
          </MarkerView>
        ))}
      </MapView>
    </View>
  );
}

/**
 * Memoized: while a recording is live the Map screen re-renders every poll
 * tick (~2.5 s); with stable props the native MapView + marker tree must
 * not be reconciled each time (M2 review finding — a screen-on multi-hour
 * recording would otherwise churn the native bridge ~1,400 times for zero
 * visual change).
 */
export const MapSurface = React.memo(MapSurfaceInner);
