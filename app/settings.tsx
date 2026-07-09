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
import { parseCsv } from '@/lib/csv';
import { looksLikeBoardLibCsv, parseBoardLibCsv } from '@/lib/climbImport/boardlib';
import { looksLike8aCsv, parse8aCsv } from '@/lib/climbImport/eightA';
import {
  buildImportedClimbingSessions,
  type ImportedSession,
} from '@/lib/climbImport/buildSessions';
import { createObservation, listObservations } from '@/storage/observations';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import { localDayOf } from '@core/timeline';
import { isKind } from '@core/observation';
import type { ObservationOf } from '@core/observation';

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

  // ─── Climbing CSV import (⚑ E-16, dimension/earth Pass E5) ─────────────────
  // BoardLib (Kilter/Tension/Moon boards) or 8a.nu's Logbook Export — both
  // client-side, gate-free (climbing-apps-research.md's import strategy).
  // Format is detected from a loose header-column match (⚑ review: this can
  // false-positive on an unrelated spreadsheet that happens to have "date"
  // and "grade" columns), so nothing is written until the user reviews a
  // summary and explicitly confirms — never a silent write on file pick.
  const [climbImporting, setClimbImporting] = useState(false);
  const [climbImportMsg, setClimbImportMsg] = useState<string | null>(null);
  const [pendingClimbImport, setPendingClimbImport] = useState<{
    platform: 'boardlib' | '8a.nu';
    observations: ObservationOf<'session'>[];
    skippedDates: number;
    skippedRows: number;
  } | null>(null);

  async function onPickClimbingCsv() {
    if (climbImporting) return;
    setClimbImporting(true);
    setClimbImportMsg(null);
    setPendingClimbImport(null);
    let DocumentPicker: typeof import('expo-document-picker');
    let FileSystem: typeof import('expo-file-system');
    try {
      DocumentPicker = await import('expo-document-picker');
      FileSystem = await import('expo-file-system');
    } catch {
      setClimbImporting(false);
      setClimbImportMsg('Import needs an updated dev build of the app — rebuild to enable it.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || res.assets.length === 0) return;
      const asset = res.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const { header } = parseCsv(text);

      let sessions: ImportedSession[];
      let skippedRows: number;
      let platform: 'boardlib' | '8a.nu';
      if (looksLikeBoardLibCsv(header)) {
        ({ sessions, skippedRows } = parseBoardLibCsv(text));
        platform = 'boardlib';
      } else if (looksLike8aCsv(header)) {
        ({ sessions, skippedRows } = parse8aCsv(text));
        platform = '8a.nu';
      } else {
        setClimbImportMsg("Didn't recognize this file as a BoardLib or 8a.nu logbook export.");
        return;
      }

      // Dedup by (platform, date) — NOT "any climbing session that day":
      // review caught that scoping this to any session would silently
      // discard a real hand-logged gym session on a day this platform's
      // import also covers. Scoping to this platform's own prior imports
      // still makes a same-file re-import a no-op.
      const existing = await listObservations({ kinds: ['session'] });
      const existingDates = new Set(
        existing
          .filter(
            (o) =>
              isKind(o, 'session') &&
              o.source.type === 'fileimport' &&
              o.source.format === 'csv' &&
              o.source.platform === platform
          )
          .map((o) => localDayOf(o.occurredAt, o.tz))
      );

      const { observations, skippedDates } = buildImportedClimbingSessions(sessions, platform, {
        now: new Date().toISOString(),
        tz: deviceTz(),
        filename: asset.name,
        idFactory: uuidv7,
        existingDates,
      });

      if (observations.length === 0) {
        setClimbImportMsg(
          skippedDates.length > 0
            ? `All ${skippedDates.length} session${skippedDates.length === 1 ? '' : 's'} in this file were already imported.`
            : "Didn't find any usable sessions in this file."
        );
        return;
      }
      setPendingClimbImport({
        platform,
        observations,
        skippedDates: skippedDates.length,
        skippedRows,
      });
    } catch (e) {
      setClimbImportMsg(e instanceof Error ? e.message : 'Could not read that file.');
    } finally {
      setClimbImporting(false);
    }
  }

  async function onConfirmClimbingImport() {
    if (!pendingClimbImport || climbImporting) return;
    setClimbImporting(true);
    try {
      for (const obs of pendingClimbImport.observations) await createObservation(obs);
      const { observations, skippedDates, skippedRows, platform } = pendingClimbImport;
      const parts = [
        `Imported ${observations.length} session${observations.length === 1 ? '' : 's'} from ${platform}`,
      ];
      if (skippedDates > 0) parts.push(`${skippedDates} already imported`);
      if (skippedRows > 0) parts.push(`${skippedRows} row${skippedRows === 1 ? '' : 's'} unrecognized`);
      setClimbImportMsg(parts.join(' · '));
    } catch (e) {
      setClimbImportMsg(e instanceof Error ? e.message : 'Could not save the imported sessions.');
    } finally {
      setPendingClimbImport(null);
      setClimbImporting(false);
    }
  }

  function onCancelClimbingImport() {
    setPendingClimbImport(null);
    setClimbImportMsg(null);
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
        <Text variant="label">Gear</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          The quiver — shoes, bikes, skis. Sessions tag gear; mileage and days
          are read from those tags, never stored.
        </Text>
        <Button label="Gear" variant="outline" onPress={() => router.push('/gear')} />
      </Card>

      <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
        <Text variant="label">Climbing history import</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          A BoardLib logbook CSV (Kilter/Tension/Moon boards — run{' '}
          <Text variant="body" style={{ fontFamily: 'monospace' }}>
            boardlib logbook
          </Text>{' '}
          on your computer first) or an 8a.nu Logbook Export CSV. Each day in the
          file becomes one session; a day this platform already imported is left
          alone.
        </Text>
        {pendingClimbImport ? (
          <>
            <Text variant="body">
              Found {pendingClimbImport.observations.length} session
              {pendingClimbImport.observations.length === 1 ? '' : 's'} from{' '}
              {pendingClimbImport.platform}
              {pendingClimbImport.skippedDates > 0
                ? ` (${pendingClimbImport.skippedDates} already imported)`
                : ''}
              {pendingClimbImport.skippedRows > 0
                ? ` (${pendingClimbImport.skippedRows} row${pendingClimbImport.skippedRows === 1 ? '' : 's'} unrecognized)`
                : ''}
              . Import them?
            </Text>
            <Button
              label={climbImporting ? 'Saving…' : 'Confirm import'}
              onPress={onConfirmClimbingImport}
              disabled={climbImporting}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onCancelClimbingImport}
              disabled={climbImporting}
            />
          </>
        ) : (
          <Button
            label={climbImporting ? 'Reading file…' : 'Choose file…'}
            variant="outline"
            onPress={onPickClimbingCsv}
            disabled={climbImporting}
          />
        )}
        {climbImportMsg ? (
          <Text variant="bodySm" color={theme.colors.textSecondary}>
            {climbImportMsg}
          </Text>
        ) : null}
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
