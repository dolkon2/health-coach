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
import { RoutePreview } from './RoutePreview';

type SessionCardProps = {
  session: ObservationOf<'session'>;
  contribution: string;
};

export function SessionCard({ session, contribution }: SessionCardProps) {
  const theme = useTheme();
  const p = session.payload;

  const meta: string[] = [];
  if (p.durationMin != null) meta.push(`${Math.round(p.durationMin)} min`);
  if (p.perceivedEffort != null) meta.push(`RPE ${p.perceivedEffort}`);

  // Show the route only when one was actually recorded/imported — a routeless
  // session is complete, not broken (gps-mapping-spec.md: stats-only is a valid
  // state; never an empty map container). Sky sessions carry their track under
  // `sky.track` rather than `endurance.gpsPath` — same routeless-is-fine rule.
  const route = p.endurance?.gpsPath ?? p.sky?.track;

  return (
    <Card raised style={{ gap: theme.spacing[2] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="label" color={theme.colors.accent}>
          {p.modality}
        </Text>
        <Text variant="dataSm" color={theme.colors.textSecondary}>
          {meta.join('  ·  ')}
        </Text>
      </View>
      {route && route.length >= 2 ? <RoutePreview path={route} height={72} /> : null}
      <Text variant="body" color={theme.colors.text}>
        {contribution}
      </Text>
    </Card>
  );
}
