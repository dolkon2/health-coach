/**
 * PointForecastSheet — Explore's "View forecast" (map-tab.md REFRAME
 * AMENDMENT). An ephemeral bottom sheet for a bare {lat, lng} — no Spot, no
 * `spot.meta.forecastPanels` config, no live-observation match (there's no
 * saved spot to attach one to). Renders the same Wind + Rain/Shine cards as
 * the F1 spot dashboard, via the exact same `fetchForecast({lat,lng})` call
 * spot/[id].tsx uses — "one fetch path, two entry points" (forecast-tab.md
 * §2b). Fixed default panel set (Wind + Rain/Shine): no sport tag to derive
 * a smarter default from, and Meteo/windgram is too heavy for tap-and-glance.
 *
 * Nothing is written here — "Pin this location" hands off to new-spot.tsx
 * (via the caller's `onPin`) rather than calling `createSpot` itself, so
 * there's one spot-creation code path in the whole app, not two.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { WindForecastCard } from './ForecastPanelCard';
import { RainShineForecastCard } from './ForecastPanelCard';
import { useTheme } from '@/theme';
import { fetchForecast, type ForecastResult } from '@/lib/conditions/openMeteoForecast';
import type { LngLat } from './mapLibre';

type PointForecastSheetProps = {
  visible: boolean;
  /** [lng, lat] — the crosshair's coordinate at the moment "View forecast" was tapped. */
  coord: LngLat | null;
  onClose: () => void;
  onPin: (coord: LngLat) => void;
};

export function PointForecastSheet({ visible, coord, onClose, onPin }: PointForecastSheetProps) {
  const theme = useTheme();
  // undefined = loading, null = unavailable — same three-state convention as
  // spot/[id].tsx's forecast card stack.
  const [forecast, setForecast] = useState<ForecastResult | null | undefined>(undefined);

  const lng = coord?.[0];
  const lat = coord?.[1];

  useEffect(() => {
    if (!visible || lng == null || lat == null) return;
    let cancelled = false;
    setForecast(undefined);
    fetchForecast(lat, lng).then((f) => {
      if (!cancelled) setForecast(f);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, lat, lng]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close forecast"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '85%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: theme.spacing[4] }}>
            <View>
              <Text variant="label" color={theme.colors.textSecondary}>
                Forecast
              </Text>
              {/* The raw coordinate — never a fabricated place name; there is
                  no spot here to name it after. */}
              <Text variant="displayMd">
                {lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : ''}
              </Text>
            </View>

            {forecast ? (
              <View style={{ gap: theme.spacing[3] }}>
                <WindForecastCard
                  hourly={forecast.hourly}
                  model={forecast.model}
                  fetchedAtUtc={forecast.fetchedAtUtc}
                />
                <RainShineForecastCard
                  hourly={forecast.hourly}
                  daily={forecast.daily}
                  model={forecast.model}
                  fetchedAtUtc={forecast.fetchedAtUtc}
                />
              </View>
            ) : forecast === undefined ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                Loading forecast…
              </Text>
            ) : (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                Forecast unavailable.
              </Text>
            )}

            <Button
              label="Pin this location"
              variant="outline"
              onPress={() => {
                if (coord) onPin(coord);
              }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
