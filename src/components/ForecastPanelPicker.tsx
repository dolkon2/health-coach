/**
 * ForecastPanelPicker — spot-detail affordance to add/remove Forecast
 * dashboard panels (F1, forecast-tab.md §2a/§4), writing
 * `spot.meta.forecastPanels`. Same visual chip language as ChipSelect, but
 * multi-select (each chip toggles independently) — ChipSelect itself is
 * single-select (`value: T | null`) so this is a small sibling rather than a
 * forced fit.
 *
 * Only offers panels this pass actually renders (Wind, Rain/Shine). Meteo
 * (the windgram, F3) and Gauge (the spot's existing live-conditions card
 * already covers it; no distinct forecast-style Gauge card exists yet) are
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
import type { ForecastPanel } from '@core/spot';

const PANEL_OPTIONS: { value: ForecastPanel; label: string }[] = [
  { value: 'wind', label: 'Wind' },
  { value: 'rain-shine', label: 'Rain / Shine' },
];

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
            style={{
              paddingVertical: theme.spacing[2],
              paddingHorizontal: theme.spacing[3],
              borderRadius: theme.radius.full,
              backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
              borderWidth: 1,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
            }}
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
