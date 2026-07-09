/**
 * Import CSV — Strong/Hevy training-history import (Body P5).
 * Reached from the Training tab's "Import →" link. Functional only.
 *
 * Flow: pick a file -> detect Strong vs Hevy from its header -> (Strong
 * Variant A only) confirm the file's weight unit, prefilled by heuristic,
 * never applied silently -> review report (sessions/sets found, cardio
 * skipped, ambiguous/unmatched exercise names) -> write to storage
 * (idempotent — a re-import of an overlapping file only writes new rows).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Button, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { deviceTz } from '@/lib/date';
import { uuidv7 } from '@/lib/id';
import { colIndex, parseCsv } from '@/lib/csv';
import { parseStrongCsv, type StrongParseResult } from '@/lib/strongImport';
import { parseHevyCsv, type HevyParseResult } from '@/lib/hevyImport';
import { applyCsvImport, type ImportedSession, type ImportReport, type ImportWriteResult } from '@/lib/csvImport';
import type { WeightUnit } from '@/lib/units';

type Detected =
  | { format: 'strong-csv'; result: StrongParseResult }
  | { format: 'hevy-csv'; result: HevyParseResult }
  | { format: 'unrecognized' };

function detectFormat(raw: string, weightUnit: WeightUnit, confirmedUnit?: WeightUnit): Detected {
  const { headers } = parseCsv(raw);
  const isHevy = colIndex(headers, 'title') !== -1 && colIndex(headers, 'start_time') !== -1 && colIndex(headers, 'exercise_title') !== -1;
  if (isHevy) return { format: 'hevy-csv', result: parseHevyCsv(raw) };

  const isStrong = colIndex(headers, 'date') !== -1 && colIndex(headers, 'exercise name') !== -1;
  if (isStrong) {
    return {
      format: 'strong-csv',
      result: parseStrongCsv(raw, { appDefaultWeightUnit: weightUnit, weightUnit: confirmedUnit }),
    };
  }
  return { format: 'unrecognized' };
}

export default function ImportCsvScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const [rawText, setRawText] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [detected, setDetected] = useState<Detected | null>(null);
  const [unitChoice, setUnitChoice] = useState<WeightUnit>(weightUnit);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeResult, setWriteResult] = useState<ImportWriteResult | null>(null);
  const [applying, setApplying] = useState(false);

  async function pickFile() {
    if (picking) return;
    setPicking(true);
    setError(null);
    let DocumentPicker: typeof import('expo-document-picker');
    let FileSystem: typeof import('expo-file-system');
    try {
      DocumentPicker = await import('expo-document-picker');
      FileSystem = await import('expo-file-system');
    } catch {
      setPicking(false);
      setError('File import needs an updated dev build of the app — rebuild to enable it.');
      return;
    }
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || res.assets.length === 0) return;
      const asset = res.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      setRawText(text);
      setFilename(asset.name);
      setWriteResult(null);
      setDetected(detectFormat(text, weightUnit));
    } catch {
      setError('Could not read that file.');
    } finally {
      setPicking(false);
    }
  }

  function confirmUnit() {
    if (!rawText || detected?.format !== 'strong-csv') return;
    setDetected(detectFormat(rawText, weightUnit, unitChoice));
  }

  async function doImport(sessions: ImportedSession[], format: 'strong-csv' | 'hevy-csv') {
    if (applying) return;
    setApplying(true);
    try {
      const result = await applyCsvImport(sessions, format, filename, {
        idFactory: uuidv7,
        tz: deviceTz(),
      });
      setWriteResult(result);
    } catch {
      setError('Import failed while writing to storage.');
    } finally {
      setApplying(false);
    }
  }

  function reportCard(report: ImportReport) {
    return (
      <Card style={{ gap: theme.spacing[2] }}>
        <Text variant="body">
          {report.sessionsFound} session{report.sessionsFound === 1 ? '' : 's'}, {report.setsImported} sets
          found
        </Text>
        {report.cardioSkipped > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {report.cardioSkipped} cardio-in-workout row{report.cardioSkipped === 1 ? '' : 's'} not imported
            (out of scope for a lifting session)
          </Text>
        ) : null}
        {report.restTimerSkipped > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {report.restTimerSkipped} rest-timer row{report.restTimerSkipped === 1 ? '' : 's'} skipped
          </Text>
        ) : null}
        {report.allZeroSkipped > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {report.allZeroSkipped} empty placeholder row{report.allZeroSkipped === 1 ? '' : 's'} skipped
          </Text>
        ) : null}
        {report.rirDerivedFromRpeCount > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            RIR derived from RPE (10 − RPE) on {report.rirDerivedFromRpeCount} set
            {report.rirDerivedFromRpeCount === 1 ? '' : 's'}
          </Text>
        ) : null}
        {report.unmatchedExercises.length > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            Imported as custom (no library match): {report.unmatchedExercises.join(', ')}
          </Text>
        ) : null}
        {report.ambiguousExercises.length > 0 ? (
          <Text variant="dataSm" color={theme.colors.textMuted}>
            Uncertain library match, imported as custom for now: {report.ambiguousExercises.join(', ')}
          </Text>
        ) : null}
      </Card>
    );
  }

  return (
    <Screen scroll>
      <Text variant="displayLg">Import training history</Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Bring over a Strong or Hevy CSV export. Re-importing the same file is
        safe — rows already imported are skipped.
      </Text>

      {!rawText ? (
        <Button
          label={picking ? 'Reading file…' : 'Choose file'}
          onPress={pickFile}
          style={{ marginTop: theme.spacing[6] }}
        />
      ) : null}

      {error ? (
        <Card style={{ marginTop: theme.spacing[4] }}>
          <Text variant="body" color={theme.colors.sandstone}>
            {error}
          </Text>
        </Card>
      ) : null}

      {detected?.format === 'unrecognized' ? (
        <Card style={{ marginTop: theme.spacing[4] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            Couldn't recognize this file as a Strong or Hevy export.
          </Text>
        </Card>
      ) : null}

      {detected?.format === 'strong-csv' && detected.result.status === 'localized-header-error' ? (
        <Card style={{ marginTop: theme.spacing[4] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            This file's headers aren't in English — re-export from Strong
            with the app language set to English and try again.
          </Text>
        </Card>
      ) : null}

      {detected?.format === 'strong-csv' && detected.result.status === 'needs-unit-confirm' ? (
        <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[3] }}>
          <Text variant="body">
            This export has no weight-unit column. Weights in this file are:
          </Text>
          <ChipSelect
            options={[
              { value: 'kg' as const, label: 'kg' },
              { value: 'lb' as const, label: 'lb' },
            ]}
            value={unitChoice}
            onChange={setUnitChoice}
          />
          <Button label="Confirm" onPress={confirmUnit} />
        </Card>
      ) : null}

      {detected?.format === 'hevy-csv' && detected.result.status === 'header-error' ? (
        <Card style={{ marginTop: theme.spacing[4] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            This doesn't look like a Hevy export (missing title/start
            time/exercise columns).
          </Text>
        </Card>
      ) : null}

      {detected != null &&
      detected.format !== 'unrecognized' &&
      detected.result.status === 'ok' &&
      !writeResult ? (
        <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[3] }}>
          {reportCard(detected.result.report)}
          <Button
            label={applying ? 'Importing…' : 'Import'}
            onPress={() => doImport(detected.result.status === 'ok' ? detected.result.sessions : [], detected.format)}
          />
        </View>
      ) : null}

      {writeResult ? (
        <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[2] }}>
          <Text variant="body">
            Imported {writeResult.sessionsWritten} session{writeResult.sessionsWritten === 1 ? '' : 's'} (
            {writeResult.setsWritten} sets).
          </Text>
          {writeResult.sessionsSkippedAsFullDuplicate > 0 ? (
            <Text variant="dataSm" color={theme.colors.textMuted}>
              {writeResult.sessionsSkippedAsFullDuplicate} session
              {writeResult.sessionsSkippedAsFullDuplicate === 1 ? '' : 's'} already imported, skipped.
            </Text>
          ) : null}
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
        </Card>
      ) : null}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
