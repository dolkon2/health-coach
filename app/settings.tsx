/**
 * Settings — a gear-icon screen, not a tab. Pass 1 ships a working theme toggle
 * (exercises the ThemeProvider) and placeholders for the rest. Units, modality
 * picker, and JSON export are wired in later passes.
 *
 * The Developer card (sample data) is a testing aid added in Pass 5 so a
 * populated Reflect can be previewed instantly. It writes tagged rows and clears
 * only those — never real logged data. Remove this card before any real release.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Button, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { seedSampleData, clearSampleData } from '@/lib/devSeed';
import { useSettings, useUpdateSettings } from '@/settings/useSettings';
import type { WeightUnit, DistanceUnit } from '@/lib/units';

const WEIGHT_UNITS: Array<{ value: WeightUnit; label: string }> = [
  { value: 'lb', label: 'lb' },
  { value: 'kg', label: 'kg' },
];
const DISTANCE_UNITS: Array<{ value: DistanceUnit; label: string }> = [
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'mi' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit, distanceUnit } = useSettings();
  const updateSettings = useUpdateSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSeed() {
    setBusy(true);
    setMsg(null);
    try {
      await seedSampleData();
      setMsg('Sample data loaded. Open Reflect to see the trend and ledger.');
    } catch {
      setMsg('Could not load sample data.');
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setBusy(true);
    setMsg(null);
    try {
      await clearSampleData();
      setMsg('Sample data cleared. Your real entries are untouched.');
    } catch {
      setMsg('Could not clear sample data.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Card style={{ gap: theme.spacing[3] }}>
        <Text variant="label">Theme</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Currently {theme.scheme}. Dark is the default.
        </Text>
        <Button
          label={theme.scheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          variant="outline"
          onPress={theme.toggleScheme}
        />
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Body stats</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Height, birth year, and how active you typically are — behind the
          predicted daily burn, until measurement takes over.
        </Text>
        <Button
          label="Edit body stats"
          variant="outline"
          onPress={() => router.push('/body-profile')}
        />
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Units</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          How weights and distances read. Storage stays kg and metres — this
          only changes what you see.
        </Text>
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            Weight
          </Text>
          <ChipSelect
            options={WEIGHT_UNITS}
            value={weightUnit}
            onChange={(u) => {
              void updateSettings({ weightUnit: u });
            }}
          />
        </View>
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            Distance
          </Text>
          <ChipSelect
            options={DISTANCE_UNITS}
            value={distanceUnit}
            onChange={(u) => {
              void updateSettings({ distanceUnit: u });
            }}
          />
        </View>
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
        <Text variant="label">Your data</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          One-button JSON export lands with the storage layer. You own your data.
        </Text>
      </Card>

      {/* Developer-only: sample data for previewing Reflect. Removed before release. */}
      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label" color={theme.colors.clay}>
          Developer · sample data
        </Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Loads ~2 weeks of example weigh-ins and sessions so you can see a
          populated trend chart and ledger. Clearing removes only this sample —
          your real entries stay.
        </Text>
        <Button label="Load sample data" variant="outline" onPress={onSeed} loading={busy} />
        <Button label="Clear sample data" variant="outline" onPress={onClear} disabled={busy} />
        {msg ? (
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            {msg}
          </Text>
        ) : null}
      </Card>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
