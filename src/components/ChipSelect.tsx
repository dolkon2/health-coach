/**
 * ChipSelect — a row of selectable chips for small, fixed option sets
 * (movement pattern, energy system, climb style, perceived effort). The
 * selected chip fills accent; the rest stay quiet surface tiles. Used where a
 * native picker would feel heavier than the choice deserves.
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export type ChipOption<T extends string | number> = { value: T; label: string };

type ChipSelectProps<T extends string | number> = {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** When set, chips fill the row in an N-per-row grid (e.g. 2 → a 2×2 block for
   *  four options) instead of sizing to content, so a fixed option set never
   *  orphans a single chip onto its own wrapped line. */
  columns?: number;
};

export function ChipSelect<T extends string | number>({
  options,
  value,
  onChange,
  columns,
}: ChipSelectProps<T>) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              paddingVertical: theme.spacing[2],
              paddingHorizontal: theme.spacing[3],
              borderRadius: theme.radius.full,
              backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
              borderWidth: 1,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              alignItems: 'center',
              ...(columns ? { flexBasis: `${100 / columns - 3}%`, flexGrow: 1 } : null),
            }}
          >
            <Text
              variant="label"
              color={selected ? theme.colors.bg : theme.colors.textSecondary}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
