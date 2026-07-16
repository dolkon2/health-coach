/**
 * ForecastPanelPicker — spot-detail affordance to add/remove Forecast
 * dashboard panels (F1, forecast-tab.md §2a/§4), writing
 * `spot.meta.forecastPanels`. Same visual chip language as ChipSelect, but
 * multi-select (each chip toggles independently) — ChipSelect itself is
 * single-select (`value: T | null`) so this is a small sibling rather than a
 * forced fit.
 *
 * Only offers panels with a real card (RENDERABLE_FORECAST_PANELS): Wind,
 * Rain/Shine, and — since F3 — Meteo (the windgram; opt-in per spot, never
 * a default). Gauge (the spot's existing live-conditions card already
 * covers it; no distinct forecast-style Gauge card exists yet) stays
 * deliberately left off — a toggle with no visible effect would read as
 * broken, not as a scope boundary. ⚑ A gauge-family spot's sport-derived
 * default still resolves to `['gauge']` (feedForSport.ts); its Forecast
 * section legitimately renders nothing extra this pass (absent, not empty —
 * the live Conditions card above already shows the gauge reading).
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { chipStyle } from './ChipSelect';
import { RENDERABLE_FORECAST_PANELS } from '@/lib/forecastPanels';
import type { ForecastPanel } from '@core/spot';

const PANEL_LABELS: Record<ForecastPanel, string> = {
  wind: 'Wind',
  'rain-shine': 'Rain / Shine',
  gauge: 'Gauge',
  meteo: 'Meteo',
};

const PANEL_OPTIONS: { value: ForecastPanel; label: string }[] = RENDERABLE_FORECAST_PANELS.map(
  (value) => ({ value, label: PANEL_LABELS[value] })
);

export type ForecastPanelPickerProps = {
  value: ForecastPanel[];
  onChange: (panels: ForecastPanel[]) => void;
};

export function ForecastPanelPicker({ value, onChange }: ForecastPanelPickerProps) {
  const theme = useTheme();

  function toggle(panel: ForecastPanel) {
    onChange(value.includes(panel) ? value.filter((p) => p !== panel) : [...value, panel]);
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
      {PANEL_OPTIONS.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={chipStyle(theme, selected)}
          >
            <Text variant="label" color={selected ? theme.colors.bg : theme.colors.textSecondary}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
