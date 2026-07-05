/**
 * GpsRecorderPanel — the in-app "record this route" control on the GPS logging
 * surface. Sits beside "Import GPX file": both hand the same GeoPoint[] to the
 * form, so a recorded route and an imported one converge on the identical
 * "Route attached" preview and the same buildSessionObservation path.
 *
 * Honest floor (gps-mapping-spec.md): a routeless session is complete, never
 * broken. If permission is off or this dev build predates the native module, the
 * panel says so plainly and the user just logs the session by hand — nothing is
 * fabricated, nothing is blocked.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from './Button';
import { Text } from './Text';
import { RoutePreview } from './RoutePreview';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { metersToDisplay, type DistanceUnit } from '@/lib/units';
import { summarizeTrack, type TrackSummary } from '@/lib/gpsTrack';
import { useGpsTracker } from '@/hooks/useGpsTracker';

type GpsRecorderPanelProps = {
  /** Called with the finished route once recording stops with ≥ 2 fixes. */
  onCapture: (summary: TrackSummary) => void;
};

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function formatDistance(distanceM: number, unit: DistanceUnit): string {
  return String(Math.round(metersToDisplay(distanceM, unit) * 100) / 100);
}

export function GpsRecorderPanel({ onCapture }: GpsRecorderPanelProps) {
  const theme = useTheme();
  const { distanceUnit } = useSettings();
  const tracker = useGpsTracker();

  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  // A wall clock ticks the elapsed time forward between GPS fixes; it resets
  // whenever we leave the tracking state.
  useEffect(() => {
    if (tracker.status !== 'tracking') {
      startedAtRef.current = null;
      setElapsedSec(0);
      return;
    }
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    const id = setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [tracker.status]);

  const liveDistanceM = useMemo(
    () => summarizeTrack(tracker.points).distanceM,
    [tracker.points]
  );

  function finish() {
    const captured = tracker.stop();
    // < 2 fixes yields nothing drawable or measurable — leave the session
    // routeless rather than attach a degenerate trace (the map never lies).
    if (captured.length >= 2) onCapture(summarizeTrack(captured));
  }

  if (tracker.status === 'tracking') {
    return (
      <View style={{ gap: theme.spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.clay }}
          />
          <Text variant="label" color={theme.colors.clay}>
            Recording
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ gap: theme.spacing[1] }}>
            <Text variant="label" color={theme.colors.textMuted}>
              Time
            </Text>
            <Text variant="dataLg">{formatElapsed(elapsedSec)}</Text>
          </View>
          <View style={{ gap: theme.spacing[1], alignItems: 'flex-end' }}>
            <Text variant="label" color={theme.colors.textMuted}>
              Distance
            </Text>
            <Text variant="dataLg">
              {tracker.points.length > 0
                ? `${formatDistance(liveDistanceM, distanceUnit)} ${distanceUnit}`
                : '—'}
            </Text>
          </View>
        </View>
        {tracker.points.length >= 2 ? (
          <RoutePreview path={tracker.points} color={theme.colors.clay} />
        ) : (
          <Text variant="bodySm" color={theme.colors.textMuted}>
            Acquiring GPS… keep the screen on and head outside for a clear signal.
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <Button label="Stop & use route" onPress={finish} style={{ flex: 1 }} />
          <Button label="Discard" variant="ghost" onPress={tracker.reset} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Button
        label={tracker.status === 'starting' ? 'Starting…' : '● Record route'}
        variant="secondary"
        onPress={tracker.start}
        disabled={tracker.status === 'starting'}
      />
      {tracker.status === 'denied' ? (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Location is off, so there's no route to record — log this session by hand, or turn on
          location for the app in Settings and try again.
        </Text>
      ) : null}
      {tracker.status === 'unavailable' || tracker.status === 'error' ? (
        <Text variant="bodySm" color={theme.colors.textMuted}>
          {tracker.errorMessage}
        </Text>
      ) : null}
    </View>
  );
}
