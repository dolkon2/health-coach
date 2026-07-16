/**
 * RouteBuilderOverlay — the takeover chrome for the Explore route builder
 * (Explore-2, map-tab.md REFRAME AMENDMENT). Purely presentational: the map
 * screen owns the useRouteBuilder state and the MapSurface (which renders the
 * draft line + waypoints); this draws the top sport/snap strip and the bottom
 * action bar over the shared crosshair reticle.
 *
 * The crosshair itself is rendered by map.tsx (shared with Explore's browse
 * mode) — "Drop point" reads wherever it points via getCenter(), the same
 * placement model as Explore's "Pin this location" (no tap-gesture spike).
 *
 * Honesty labeling (routes-implementation.md §1, adopt #2): the distance readout
 * always says what it can and can't claim ("along trails" / "as plotted — trails
 * may be longer"); never an elevation number.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { iconFor } from './activityIcons';
import { Text } from './Text';
import { Card } from './Card';
import { Button } from './Button';
import { Field } from './Field';
import { SegmentedControl } from './SegmentedControl';

export type RouteBuilderOverlayProps = {
  sportLabel: string;
  sportIcon: string;
  isFreeline: boolean;
  /** Sport can only be free-line (paragliding / Sky) — the snap toggle is hidden. */
  freelineForced: boolean;
  /** Label for the snap option, by sport ("Snap to trails" / "Snap to river"). */
  snapLabel: string;
  waypointCount: number;
  /** Preformatted distance ("2.14 km"), or '' when there's nothing to show. */
  distanceLabel: string;
  honestyLabel: string;
  canSave: boolean;
  pending: boolean;
  onDropWaypoint: () => void;
  onUndo: () => void;
  onClear: () => void;
  onToggleFreeline: (freeline: boolean) => void;
  onChangeSport: () => void;
  onSave: (name: string) => void;
  onExit: () => void;
  topInset: number;
  bottomInset: number;
};

export function RouteBuilderOverlay({
  sportLabel,
  sportIcon,
  isFreeline,
  freelineForced,
  snapLabel,
  waypointCount,
  distanceLabel,
  honestyLabel,
  canSave,
  pending,
  onDropWaypoint,
  onUndo,
  onClear,
  onToggleFreeline,
  onChangeSport,
  onSave,
  onExit,
  topInset,
  bottomInset,
}: RouteBuilderOverlayProps) {
  const theme = useTheme();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const SportIcon = iconFor(sportIcon);
  const hasPoints = waypointCount > 0;

  function confirmSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setNaming(false);
    setName('');
  }

  return (
    <>
      {/* Top strip — sport + snap/free-line + exit */}
      <View
        style={{
          position: 'absolute',
          top: topInset + theme.spacing[3],
          left: theme.spacing[6],
          right: theme.spacing[6],
        }}
      >
        <Card style={{ gap: theme.spacing[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
            <Pressable
              onPress={onChangeSport}
              accessibilityRole="button"
              accessibilityLabel={`Route sport: ${sportLabel}. Tap to change.`}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flex: 1 }}
            >
              <SportIcon size={18} color={theme.colors.accent} strokeWidth={1.75} />
              <Text variant="label" color={theme.colors.text}>
                {sportLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel="Exit route builder"
              hitSlop={8}
              style={{ padding: theme.spacing[1] }}
            >
              <X size={18} color={theme.colors.textMuted} strokeWidth={1.75} />
            </Pressable>
          </View>
          {freelineForced ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Free-line — straight segments
            </Text>
          ) : (
            <SegmentedControl<'snap' | 'free'>
              options={[
                { value: 'snap', label: snapLabel },
                { value: 'free', label: 'Free-line' },
              ]}
              value={isFreeline ? 'free' : 'snap'}
              onChange={(v) => onToggleFreeline(v === 'free')}
            />
          )}
        </Card>
      </View>

      {/* Bottom action bar */}
      <View
        style={{
          position: 'absolute',
          left: theme.spacing[6],
          right: theme.spacing[6],
          bottom: bottomInset + theme.spacing[4],
        }}
      >
        <Card style={{ gap: theme.spacing[3] }}>
          <View style={{ gap: theme.spacing[1] }}>
            <Text variant="body" color={theme.colors.text}>
              {hasPoints
                ? `${waypointCount} ${waypointCount === 1 ? 'point' : 'points'}${distanceLabel ? ` · ${distanceLabel}` : ''}`
                : 'Pan so the crosshair marks your start, then drop a point.'}
            </Text>
            {hasPoints ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                {honestyLabel}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: theme.spacing[2] }}>
            <Button label="Undo" variant="outline" onPress={onUndo} disabled={!hasPoints} style={{ flex: 1 }} />
            <Button label="Clear" variant="outline" onPress={onClear} disabled={!hasPoints} style={{ flex: 1 }} />
            <Button
              label="Drop point"
              onPress={onDropWaypoint}
              loading={pending}
              style={{ flex: 1.4 }}
            />
          </View>

          {naming ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
              <Field
                value={name}
                onChangeText={setName}
                placeholder="Route name"
                keyboardType="default"
                style={{ flex: 1 }}
              />
              <Button label="Save" onPress={confirmSave} disabled={!name.trim()} />
              <Button label="Cancel" variant="outline" onPress={() => setNaming(false)} />
            </View>
          ) : (
            <Button
              label="Save route"
              variant="outline"
              onPress={() => setNaming(true)}
              disabled={!canSave}
            />
          )}
        </Card>
      </View>
    </>
  );
}
