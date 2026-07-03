/**
 * ExpenditureCard — the daily-burn surface (expenditure build, Pass B).
 *
 * Pass B renders the cold-start baseline: predicted TDEE with its range,
 * explicitly labeled the weak kind, at LOW-fidelity visual treatment (rough
 * data looks rough — the opacity IS the label). Honest empty states before
 * body stats exist and before any weigh-in anchors a weight. Pass D layers
 * the measured residual on top; measured overwrites predicted.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { estimateBaselineTdee, type BaselineTdee } from '@core/baselineTdee';
import type { BodyProfile } from '@/lib/bodyProfile';
import { metricsFrom } from '@/lib/bodyProfile';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type ExpenditureCardProps = {
  profile: BodyProfile | null;
  /** Latest smoothed trend weight; null until a weigh-in exists. */
  weightKg: number | null;
  onEditProfile: () => void;
  onLogWeighIn: () => void;
};

const fmt = (n: number): string => n.toLocaleString('en-US');

export function ExpenditureCard({
  profile,
  weightKg,
  onEditProfile,
  onLogWeighIn,
}: ExpenditureCardProps) {
  const theme = useTheme();

  if (!profile) {
    return (
      <Card style={{ gap: theme.spacing[3] }}>
        <Text variant="label">Daily burn</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          No estimate yet. Add your body stats for a predicted starting point —
          the weak kind, replaced by measurement as your weigh-in trend builds.
        </Text>
        <Button label="Add body stats" variant="outline" onPress={onEditProfile} />
      </Card>
    );
  }

  if (weightKg == null) {
    return (
      <Card style={{ gap: theme.spacing[3] }}>
        <Text variant="label">Daily burn</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Log a weigh-in to anchor the estimate — weight comes from your scale,
          not a form.
        </Text>
        <Button label="Log weigh-in" variant="outline" onPress={onLogWeighIn} />
      </Card>
    );
  }

  const nowYear = new Date().getFullYear();
  const baseline: BaselineTdee = estimateBaselineTdee(
    metricsFrom(profile, weightKg, nowYear),
    profile.activityLevel
  );

  return (
    <Card style={{ gap: theme.spacing[2] }}>
      <Text variant="label">Daily burn · predicted</Text>

      {/* LOW-fidelity treatment on purpose: the predicted number looks rough. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: theme.spacing[2],
          opacity: theme.fidelity.low,
        }}
      >
        <Text variant="dataLg">~{fmt(baseline.tdeeKcal)}</Text>
        <Text variant="dataSm" color={theme.colors.textSecondary}>
          kcal/day
        </Text>
      </View>
      <Text variant="dataSm" color={theme.colors.textSecondary}>
        likely {fmt(baseline.range.low)} – {fmt(baseline.range.high)}
      </Text>

      <Text variant="bodySm" color={theme.colors.textMuted}>
        Predicted from your stats — the weak kind. Your weigh-in trend replaces
        this with measurement.
      </Text>

      {baseline.method === 'mifflin-st-jeor' ? (
        <Pressable onPress={onEditProfile} accessibilityRole="button">
          <Text variant="bodySm" color={theme.colors.sandstone}>
            Add body fat % to tighten the range
          </Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onEditProfile} accessibilityRole="button">
        <Text variant="bodySm" color={theme.colors.textSecondary}>
          Edit body stats
        </Text>
      </Pressable>
    </Card>
  );
}
