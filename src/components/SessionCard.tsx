/**
 * SessionCard — one logged session on Today: modality + duration + RPE on top,
 * and the "what this contributed" line underneath.
 *
 * That contribution line is *passed in*, computed by stimulus.reveal() upstream —
 * never assembled here. The card renders the engine's words; it doesn't author
 * its own description of the session (constitution: the engine speaks, the UI shows).
 */
import React from 'react';
import { View } from 'react-native';
import type { ObservationOf } from '@core/observation';
import { useTheme } from '@/theme';
import { Card } from './Card';
import { Text } from './Text';

type SessionCardProps = {
  session: ObservationOf<'session'>;
  contribution: string;
};

export function SessionCard({ session, contribution }: SessionCardProps) {
  const theme = useTheme();
  const p = session.payload;

  const meta: string[] = [`${Math.round(p.durationMin)} min`];
  if (p.perceivedEffort != null) meta.push(`RPE ${p.perceivedEffort}`);

  return (
    <Card raised style={{ gap: theme.spacing[2] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="label" color={theme.colors.sandstone}>
          {p.modality}
        </Text>
        <Text variant="dataSm" color={theme.colors.textSecondary}>
          {meta.join('  ·  ')}
        </Text>
      </View>
      <Text variant="body" color={theme.colors.text}>
        {contribution}
      </Text>
    </Card>
  );
}
