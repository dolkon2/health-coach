/**
 * Settings — the gear-icon screen (profile-settings.md P3). Sectioned private
 * configuration and parked machinery: preferences, connections, imports, engine
 * inputs, and the Views tenant section where deferred surfaces live.
 *
 * The restructure is presentation-only — every handler (HealthKit toggles, units,
 * deficit, climbing import, sample data, sky-pilot fields) is unchanged from the
 * flat version; the cards are just grouped under section headers. Empty sections
 * (Thresholds, Account, Coach) don't render until their feature lands — naming a
 * section before it has content would be an empty promise (§3 empty-section rule).
 *
 * The Views section carries the **Stimulus Ledger** (locked #2 — parked here,
 * highly deferred by design; Dylan 2026-07-11 confirmed parked-under-Settings,
 * not archived) and the USHPA ledger. Reflect's temporary door retired with P8:
 * the residual benchmark tap-in is now reached from Profile only. The gear link
 * is kept but marked moving to Profile.
 *
 * The Developer card (sample data) is a testing aid: it writes tagged rows and
 * clears only those — never real logged data. Remove it before any real release.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Card, Button, ChipSelect, Field } from '@/components';
import { useTheme } from '@/theme';
import { seedSampleData, clearSampleData } from '@/lib/devSeed';
import { useSettings, useUpdateSettings } from '@/settings/useSettings';
import { requestWritePermissions } from '@/lib/healthkit/writer';
import { useWearableSync } from '@/hooks/useWearableSync';
import type { WeightUnit, DistanceUnit } from '@/lib/units';
import { parseCsv } from '@/lib/climbImport/csv';
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
  const {
    weightUnit,
    distanceUnit,
    healthkitWriteEnabled,
    ushpaNumber,
    ushpaRating,
    deficitKcal,
  } = useSettings();
  const updateSettings = useUpdateSettings();
  // Read-side HealthKit connection (steps/sleep) — moved here from Home
  // (home-tab.md H3): Home only reads `connected` to decide whether its
  // steps/sleep strip renders; the CTA to connect lives here now.
  const wearable = useWearableSync();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hkBusy, setHkBusy] = useState(false);

  async function onToggleHealthkitWrite() {
    if (hkBusy) return;
    if (healthkitWriteEnabled) {
      // Turning off never needs the auth sheet — just stop writing.
      await updateSettings({ healthkitWriteEnabled: false });
      return;
    }
    // Turning ON is the ONLY place the auth sheet appears — never mid-log
    // (binding doc: "trigger the auth sheet only from the toggle").
    setHkBusy(true);
    try {
      const granted = await requestWritePermissions();
      await updateSettings({ healthkitWriteEnabled: granted });
    } finally {
      setHkBusy(false);
    }
  }

  // Local draft state, committed on Save — matches body-profile.tsx's pattern
  // for free-text settings. Binding onChangeText straight to updateSettings
  // would fire one SQLite write per keystroke, with no ordering guarantee
  // against the next one.
  const [skyDraft, setSkyDraft] = useState({
    ushpaNumber: ushpaNumber ?? '',
    ushpaRating: ushpaRating ?? '',
  });
  const skyDraftDirty =
    skyDraft.ushpaNumber !== (ushpaNumber ?? '') || skyDraft.ushpaRating !== (ushpaRating ?? '');

  function saveSkyDraft() {
    void updateSettings({
      ushpaNumber: skyDraft.ushpaNumber,
      ushpaRating: skyDraft.ushpaRating,
    });
  }

  // Local buffer so the field doesn't fight the user's own typing — synced
  // once from the persisted value (which loads async), then left alone.
  const [deficitText, setDeficitText] = useState(String(deficitKcal));
  const [deficitTouched, setDeficitTouched] = useState(false);
  useEffect(() => {
    if (!deficitTouched) setDeficitText(String(deficitKcal));
  }, [deficitKcal, deficitTouched]);

  async function onSeed() {
    setBusy(true);
    setMsg(null);
    try {
      await seedSampleData();
      setMsg('Sample data loaded. See the trend on Nutrition and the Stimulus ledger.');
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
      {/* ═══ Preferences ═══════════════════════════════════════════════════ */}
      <SectionHeader first>Preferences</SectionHeader>

      <Section>
        <Text variant="label">Theme</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Currently {theme.scheme}. Dark is the default.
        </Text>
        <Button
          label={theme.scheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          variant="outline"
          onPress={theme.toggleScheme}
        />
      </Section>

      <Section>
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
      </Section>

      <Section>
        <Text variant="label">Deficit target</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Used to suggest a "stay under" calorie ceiling: your current burn
          estimate minus this number. 300 is a reasonable reference point —
          yours to change; every benchmark's calorie field stays editable
          either way.
        </Text>
        <Field
          value={deficitText}
          onChangeText={(t) => {
            setDeficitTouched(true);
            setDeficitText(t);
            const n = parseInt(t, 10);
            if (Number.isFinite(n) && n >= 0) void updateSettings({ deficitKcal: n });
          }}
          placeholder="300"
          suffix="cal/day"
          keyboardType="number-pad"
        />
      </Section>

      {/* ═══ Connections ═══════════════════════════════════════════════════ */}
      <SectionHeader>Connections</SectionHeader>

      <Section>
        <Text variant="label">Steps & sleep</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          {wearable.connected
            ? 'Connected. Steps and sleep hours import automatically — tier-1 facts only, no readiness score.'
            : 'Connect Apple Health to bring in steps and sleep automatically.'}
        </Text>
        <Button
          label={wearable.connected ? 'Connected' : wearable.syncing ? 'Connecting…' : 'Connect Apple Health'}
          variant="outline"
          disabled={wearable.connected}
          onPress={() => {
            void wearable.connect();
          }}
        />
      </Section>

      <Section>
        <Text variant="label">Apple Health export</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Off by default. When on, sessions you log here export to Health as
          activity type and start/end time only — never a modeled calorie
          estimate.
        </Text>
        <Button
          label={healthkitWriteEnabled ? 'Turn off Health export' : 'Turn on Health export'}
          variant="outline"
          onPress={onToggleHealthkitWrite}
          loading={hkBusy}
        />
      </Section>

      {/* ═══ Privacy & sharing ═════════════════════════════════════════════ */}
      {/* Present from day one even though it's placeholder-only: visibility must
          be a permission change, not a schema migration (profile-settings.md §2). */}
      <SectionHeader>Privacy & sharing</SectionHeader>

      <Section>
        <Text variant="label">Default audience</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Private. Nothing you log is shared with anyone. Sharing controls arrive
          with the social features — until then, everything stays on this device.
        </Text>
      </Section>

      {/* ═══ Imports ═══════════════════════════════════════════════════════ */}
      <SectionHeader>Imports</SectionHeader>

      <Section>
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
      </Section>

      {/* ═══ Protocols ═════════════════════════════════════════════════════ */}
      <SectionHeader>Protocols</SectionHeader>

      <Section>
        <Text variant="label">Plans</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Your own home-exercise plans — define them here, tick them off daily
          from the same screen.
        </Text>
        <Button label="Open plans" variant="outline" onPress={() => router.push('/protocols')} />
      </Section>

      {/* ═══ Body profile ══════════════════════════════════════════════════ */}
      <SectionHeader>Body profile</SectionHeader>

      <Section>
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
      </Section>

      {/* ═══ Gear (moving to Profile) ══════════════════════════════════════ */}
      <SectionHeader>Gear</SectionHeader>

      <Section>
        <Text variant="label">Gear</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          The quiver — shoes, bikes, skis. Sessions tag gear; mileage and days
          are read from those tags, never stored. Moving to your profile.
        </Text>
        <Button label="Gear" variant="outline" onPress={() => router.push('/gear')} />
      </Section>

      {/* ═══ Sky pilot ═════════════════════════════════════════════════════ */}
      <SectionHeader>Sky pilot</SectionHeader>

      <Section>
        <Text variant="label">USHPA</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Descriptive only — never checked against your logged flights, never
          enforced. See your actual numbers on the USHPA ledger below.
        </Text>
        <Field
          label="USHPA number (optional)"
          value={skyDraft.ushpaNumber}
          onChangeText={(v) => setSkyDraft((d) => ({ ...d, ushpaNumber: v }))}
          placeholder="—"
          keyboardType="default"
        />
        <Field
          label="Current rating (optional)"
          value={skyDraft.ushpaRating}
          onChangeText={(v) => setSkyDraft((d) => ({ ...d, ushpaRating: v }))}
          placeholder="e.g. P2, P3"
          keyboardType="default"
        />
        {skyDraftDirty ? (
          <Button label="Save" variant="secondary" onPress={saveSkyDraft} />
        ) : null}
      </Section>

      {/* ═══ Views — the tenant section for parked/deferred surfaces ═══════ */}
      <SectionHeader>Views</SectionHeader>

      <Section>
        <Text variant="label">Stimulus ledger</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          A week-by-week read of the training you logged, grouped by pattern.
          Highly deferred — it lives here rather than on the bar.
        </Text>
        <Button
          label="Open stimulus ledger"
          variant="outline"
          onPress={() => router.push('/stimulus-ledger')}
        />
      </Section>

      <Section>
        <Text variant="label">USHPA ledger</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Your logged flights against the USHPA rating requirements — a private
          compliance record, descriptive only.
        </Text>
        <Button
          label="Open USHPA ledger"
          variant="outline"
          onPress={() => router.push('/sky-ledger')}
        />
      </Section>

      {/* ═══ Data ══════════════════════════════════════════════════════════ */}
      <SectionHeader>Data</SectionHeader>

      <Section>
        <Text variant="label">Your data</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          One-button JSON export lands with the storage layer. You own your data.
        </Text>
      </Section>

      {/* Developer-only: sample data. Removed before release. */}
      <Section>
        <Text variant="label" color={theme.colors.caution}>
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
      </Section>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

/** A section divider label. `first` drops the top margin for the leading one. */
function SectionHeader({ children, first }: { children: string; first?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      variant="label"
      color={theme.colors.accent}
      style={{ marginTop: first ? 0 : theme.spacing[8], marginBottom: theme.spacing[1] }}
    >
      {children}
    </Text>
  );
}

/** A settings card — the standard spacing every row shares. */
function Section({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>{children}</Card>;
}
