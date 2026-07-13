/**
 * SegmentedControl — the top-level view switcher shared by every tab that
 * splits into modes (Nutrition's Intake | Trend, Training's Templates |
 * Routes). One inset "well" track holding equal-width segments; the active
 * segment lifts to a white chip (surface + a light shadow), the rest stay
 * quiet muted-caps text. Full-bleed: segments flex to fill the row.
 *
 * Deliberately its own component, not `ChipSelect`. ChipSelect's selected
 * state fills accent (ink) — right for the pattern/effort pickers deep in a
 * form, wrong for a page-level tab switch, where the mockup wants the grouped
 * iOS-style track (a raised chip inside a recessed well). One control, used
 * identically on both tabs so the switch reads the same everywhere.
 *
 * The track tint is a translucent ink wash (not a flat gray) so the recessed
 * well reads correctly over whatever sits behind it — including the basalt
 * background haze.
 *
 * Boxy, not a pill (Dylan, 2026-07-12): rounded-rectangle corners (radius.lg
 * track, radius.md chip) rather than full-radius, matching the mockup's
 * squarer switcher and the app's boxy button/card language.
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import type { ChipOption } from './ChipSelect';

type SegmentedControlProps<T extends string | number> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(15,22,24,0.06)',
        borderRadius: theme.radius.lg,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: theme.spacing[3],
                borderRadius: theme.radius.md,
                backgroundColor: selected ? theme.colors.surface : 'transparent',
              },
              selected ? theme.shadow.sm : null,
            ]}
          >
            <Text
              variant="label"
              color={selected ? theme.colors.text : theme.colors.textMuted}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
