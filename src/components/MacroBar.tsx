/**
 * MacroBar — the shared protein/carb/fat visual. One stacked, proportional
 * bar; optionally a legend row of colored-dot / grams / label entries beneath
 * it. Used on Home's Nutrition glance card (bar only), Nutrition's Daily-total
 * card (bar + legend), and each meal row in DayMealList (compact bar only).
 *
 * Colors follow `chartSeries`' stated macro-breakdown order (tokens.ts:
 * "rust, teal, ochre") — protein → body, carb → water, fat → earth. Not
 * invented hues; the same three the app already uses for these macros.
 *
 * Honesty: the bar renders nothing when every macro is unknown or zero — no
 * bar is the truthful state, never a fabricated even split (food-logging-spec
 * § null ≠ 0). The legend, when shown, still lists each macro with an em-dash
 * for the unknown ones so the row structure stays stable.
 */
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type MacroBarProps = {
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Bar thickness in px. Home/meal rows use 6; the totals card uses 8. */
  height?: number;
  /** Show the colored-dot P/C/F breakdown row beneath the bar. */
  legend?: boolean;
};

const macroStr = (v: number | null | undefined): string =>
  v == null ? '—' : String(Math.round(v));

export function MacroBar({ proteinG, carbsG, fatG, height = 6, legend = false }: MacroBarProps) {
  const theme = useTheme();
  const macros = [
    { key: 'protein', label: 'protein', grams: proteinG, color: theme.colors.element.body },
    { key: 'carb', label: 'carb', grams: carbsG, color: theme.colors.element.water },
    { key: 'fat', label: 'fat', grams: fatG, color: theme.colors.element.earth },
  ] as const;

  const hasAny = macros.some((m) => (m.grams ?? 0) > 0);

  const bar = hasAny ? (
    <View
      style={{
        flexDirection: 'row',
        height,
        borderRadius: theme.radius.sm,
        overflow: 'hidden',
        gap: 2,
      }}
    >
      {macros.map((m) =>
        (m.grams ?? 0) > 0 ? (
          <View key={m.key} style={{ flex: m.grams as number, backgroundColor: m.color }} />
        ) : null
      )}
    </View>
  ) : null;

  if (!legend) return bar;

  return (
    <View style={{ gap: theme.spacing[3] }}>
      {bar}
      <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
        {macros.map((m) => (
          <View
            key={m.key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
            <Text variant="data" color={theme.colors.text}>
              {macroStr(m.grams)}
            </Text>
            <Text variant="bodySm" color={theme.colors.textSecondary}>
              {m.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
