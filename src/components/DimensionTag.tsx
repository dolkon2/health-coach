/**
 * DimensionTag — a small chip naming which of the four elements
 * (Earth/Sky/Water/Body) an activity, logbook entry, or feed card belongs to.
 * Description, never a score or badge: it labels a fact ("this was a Water
 * session"), carries no count, streak, or ranking, and never implies mastery.
 * Built ahead of its consumers (planning/rework/brand-integration.md Pass 2)
 * so Training/Home/Profile/Social — the surfaces the four-dimensions framework
 * touches — can mount it as each lands, rather than each hand-rolling its own.
 */
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { ELEMENT_LABELS, type Element } from '@/lib/activity';
import { Text } from './Text';

type DimensionTagProps = {
  element: Element;
  /** Override the label (e.g. an activity name) — defaults to the element name. */
  label?: string;
};

export function DimensionTag({ element, label }: DimensionTagProps) {
  const theme = useTheme();
  const tint = theme.colors.element[element];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingVertical: theme.spacing[1],
        paddingHorizontal: theme.spacing[2],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: tint,
      }}
    >
      <Text variant="elementTag" color={tint}>
        {label ?? ELEMENT_LABELS[element]}
      </Text>
    </View>
  );
}
