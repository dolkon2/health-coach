/**
 * ExpenditureCard — the daily-burn surface (expenditure build, Passes B + D).
 *
 * Two registers, one card. The cold-start baseline: predicted TDEE with its
 * range, explicitly labeled the weak kind, at LOW-fidelity visual treatment
 * (rough data looks rough — the opacity IS the label). And the measured
 * residual: once the engine yields a window (its own gates are the noise
 * floor — ≥5 fully-logged days, ≥3-day trend span), **measured overwrites
 * predicted** — the card switches registers entirely, with the band and the
 * logged-days completeness shown. Honest empty states before body stats
 * exist, before any weigh-in anchors a weight, and while measurement is
 * still building.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { estimateBaselineTdee, type BaselineTdee } from '@core/baselineTdee';
import type { ExpenditureWindow } from '@core/expenditure';
import type { BodyProfile } from '@/lib/bodyProfile';
import { metricsFrom } from '@/lib/bodyProfile';
import { fidelityTreatment } from '@/lib/foodLog';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type ExpenditureCardProps = {
  profile: BodyProfile | null;
  /** Latest smoothed trend weight; null until a weigh-in exists. */
  weightKg: number | null;
  /** The engine's latest measured window; null = not enough data yet. */
  measured: ExpenditureWindow | null;
  onEditProfile: () => void;
  onLogWeighIn: () => void;
};

const fmt = (n: number): string => n.toLocaleString('en-US');

const shortDate = (d: string): string =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const DAY_MS = 86_400_000;
const windowDayCount = (w: ExpenditureWindow): number =>
  Math.round((Date.parse(w.windowEnd) - Date.parse(w.windowStart)) / DAY_MS) + 1;

export function ExpenditureCard({
  profile,
  weightKg,
  measured,
  onEditProfile,
  onLogWeighIn,
}: ExpenditureCardProps) {
  const theme = useTheme();

  // Measured overwrites predicted — the moment the engine has an honest
  // residual, the prediction is gone, not footnoted.
  if (measured?.inferredTdeeKcal != null) {
    const treat = fidelityTreatment(measured.residualConfidence);
    const days = windowDayCount(measured);
    const loggedDays = Math.round(measured.logCompleteness * days);
    return (
      <Card style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Daily burn · measured</Text>

        {/* Confidence renders as the fidelity grammar: solid data looks solid. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: theme.spacing[2],
            opacity: treat.opacity,
          }}
        >
          <Text variant="dataLg">{fmt(measured.inferredTdeeKcal)}</Text>
          <Text variant="dataSm" color={theme.colors.textSecondary}>
            kcal/day
          </Text>
        </View>
        <Text variant="dataSm" color={theme.colors.textSecondary}>
          likely {fmt(measured.errorBandKcal.low)} – {fmt(measured.errorBandKcal.high)}
        </Text>
        <Text variant="dataSm" color={theme.colors.textMuted}>
          {shortDate(measured.windowStart)} – {shortDate(measured.windowEnd)} ·{' '}
          {loggedDays} of {days} days fully logged
        </Text>

        <Text variant="bodySm" color={theme.colors.textMuted}>
          Measured from your logged food and weigh-in trend — this replaces the
          predicted number.
        </Text>
        <Pressable onPress={onEditProfile} accessibilityRole="button">
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            Edit body stats
          </Text>
        </Pressable>
      </Card>
    );
  }

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
        Predicted from your stats — the weak kind. Not enough logged data to
        measure yet: once your food logs and weigh-in trend can carry it, the
        measured number takes over.
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
