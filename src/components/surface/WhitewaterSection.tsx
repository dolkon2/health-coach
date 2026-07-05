/**
 * WhitewaterSection — the whitewater/kayak inline section of the Log Session
 * screen (contract §8; gps surface, alongside the endurance envelope).
 *
 * Freeze-at-save semantics, in full:
 *   - Picking a river-section spot with a home gauge auto-fetches the gauge
 *     snapshot FOR THE SESSION TIME (`sessionTimeUtc` — the edit path passes the
 *     original occurredAt, so backdated fetches are honest), plus the 72h rain
 *     sum when the spot has coords.
 *   - An existing snapshot is IMMUTABLE: the fetch button renders only when the
 *     form has no snapshot yet; edit mode displays the frozen one read-only and
 *     never refetches.
 *   - A failed fetch leaves the field absent and says a quiet "conditions
 *     unavailable" — nothing prescriptive, no retry nagging (manual entry is
 *     the honest fallback for ungauged creeks and dead networks).
 *   - The fetch client omits siteName (known gap), so the section copies the
 *     picked gauge site's name onto the snapshot when it has one.
 *
 * BAREBONES functional UI (Dylan's redesign supersedes). Primitives are
 * imported directly, not via the '@/components' barrel — see SpotPicker.tsx.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../Text';
import { Card } from '../Card';
import { Field } from '../Field';
import { ChipSelect, type ChipOption } from '../ChipSelect';
import { Button } from '../Button';
import { SpotPicker } from './SpotPicker';
import { useTheme } from '@/theme';
import type { Spot } from '@core/spot';
import type { GearItem } from '@core/gear';
import type { GaugeReading, GaugeSnapshot } from '@core/conditions/snapshot';
import type { SessionForm } from '@/lib/session';
import { getSpot } from '@/storage/spots';
import { listGear } from '@/storage/gear';
import { fetchGaugeSnapshot } from '@/lib/conditions/usgsClient';
import { fetchPrecip72hMm } from '@/lib/conditions/openMeteoClient';

/**
 * A hand-entered gauge reading frozen into the locked snapshot shape:
 * observedAtUtc is the SESSION time (the reading describes the river then),
 * fetchedAtUtc is when the user entered it, source 'manual', no siteId/siteName
 * (absent, never fabricated). Pure — the flow tests drive it directly.
 */
export function manualGaugeSnapshot(input: {
  value: number;
  unit: string;
  parameter: GaugeReading['parameter'];
  sessionTimeUtc: string;
  now: string;
}): GaugeSnapshot {
  return {
    readings: [
      {
        parameter: input.parameter,
        value: input.value,
        unit: input.unit,
        timeUtc: input.sessionTimeUtc,
      },
    ],
    observedAtUtc: input.sessionTimeUtc,
    fetchedAtUtc: input.now,
    source: 'manual',
  };
}

const MANUAL_PARAMETERS: ChipOption<GaugeReading['parameter']>[] = [
  { value: 'discharge', label: 'Flow' },
  { value: 'gaugeHeight', label: 'Gauge height' },
];

export type WhitewaterSectionProps = {
  value: SessionForm['whitewater'];
  onChange: (patch: Partial<SessionForm['whitewater']>) => void;
  /** original?.occurredAt ?? screen-open time — what makes fetches backdate-correct. */
  sessionTimeUtc: string;
};

export function WhitewaterSection({ value, onChange, sessionTimeUtc }: WhitewaterSectionProps) {
  const theme = useTheme();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [boats, setBoats] = useState<GearItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // Manual gauge fallback drafts.
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');
  const [manualParam, setManualParam] = useState<GaugeReading['parameter']>('discharge');

  // Hydrate the picked spot on edit (the form carries only spotId) so the
  // fetch button knows whether a home gauge exists.
  useEffect(() => {
    if (!value.spotId || spot?.id === value.spotId) return;
    let cancelled = false;
    getSpot(value.spotId)
      .then((s) => {
        if (!cancelled && s) setSpot(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.spotId]);

  // Boat picker options: active kayaks from the gear store.
  useEffect(() => {
    let cancelled = false;
    listGear({})
      .then((items) => {
        if (!cancelled) setBoats(items.filter((g) => g.category === 'kayak'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Freeze conditions for the session time. Guarded by the immutability rule:
   * once a snapshot is on the form this never runs again (the button is hidden
   * too). Precip rides alongside when the spot has coords; either half failing
   * simply leaves its field absent.
   */
  async function fetchConditions(target: Spot, siteName?: string) {
    if (value.gauge || fetching) return;
    setFetching(true);
    setUnavailable(false);
    const whenSec = Math.floor(Date.parse(sessionTimeUtc) / 1000);
    const [gauge, precip] = await Promise.all([
      target.gaugeSiteId
        ? fetchGaugeSnapshot(target.gaugeSiteId, whenSec)
        : Promise.resolve(null),
      target.lat != null && target.lng != null
        ? fetchPrecip72hMm(target.lat, target.lng, whenSec)
        : Promise.resolve<number | null>(null),
    ]);
    const patch: Partial<SessionForm['whitewater']> = {};
    // COPY the picked site's name — the client omits it (known gap).
    if (gauge) patch.gauge = { ...gauge, ...(siteName ? { siteName } : {}) };
    if (precip != null) patch.precip72hMm = precip;
    if (Object.keys(patch).length > 0) onChange(patch);
    if (!gauge && target.gaugeSiteId) setUnavailable(true);
    setFetching(false);
  }

  function handlePick(s: Spot, site?: { name: string }) {
    setSpot(s);
    onChange({
      spotId: s.id,
      riverName: s.riverName ?? '',
      sectionName: s.sectionName ?? s.name,
    });
    if (!value.gauge && (s.gaugeSiteId || (s.lat != null && s.lng != null))) {
      void fetchConditions(s, site?.name);
    }
  }

  function saveManualReading() {
    const v = Number(manualValue);
    if (value.gauge || !Number.isFinite(v) || manualUnit.trim() === '') return;
    onChange({
      gauge: manualGaugeSnapshot({
        value: v,
        unit: manualUnit.trim(),
        parameter: manualParam,
        sessionTimeUtc,
        now: new Date().toISOString(),
      }),
    });
    setShowManual(false);
  }

  const gauge = value.gauge;
  const boatOptions: ChipOption<string>[] = boats.map((b) => ({ value: b.id, label: b.name }));

  return (
    <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[4] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Whitewater
      </Text>

      <SpotPicker
        kind="river-section"
        label="Spot"
        selectedName={
          value.sectionName || value.riverName
            ? [value.riverName, value.sectionName].filter(Boolean).join(' — ')
            : undefined
        }
        onPick={handlePick}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <Field
          label="River"
          value={value.riverName}
          onChangeText={(riverName) => onChange({ riverName })}
          placeholder="—"
          keyboardType="default"
          style={{ flex: 1 }}
        />
        <Field
          label="Section"
          value={value.sectionName}
          onChangeText={(sectionName) => onChange({ sectionName })}
          placeholder="—"
          keyboardType="default"
          style={{ flex: 1 }}
        />
      </View>

      {/* Frozen snapshot — read-only once present, never refetched. */}
      {gauge ? (
        <View style={{ gap: theme.spacing[1] }}>
          <Text variant="label">
            River conditions{gauge.source === 'manual' ? ' (manual)' : ''}
          </Text>
          {gauge.siteName ? <Text variant="bodySm">{gauge.siteName}</Text> : null}
          {gauge.readings.map((r, i) => (
            <Text key={`${r.parameter}-${i}`} variant="dataSm">
              {r.parameter === 'discharge' ? 'Flow' : 'Gauge height'} {r.value} {r.unit}
            </Text>
          ))}
          <Text variant="dataSm" color={theme.colors.textMuted}>
            {[gauge.trend, gauge.approvalStatus, `at ${gauge.observedAtUtc}`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: theme.spacing[2] }}>
          {spot?.gaugeSiteId ? (
            <Button
              label={fetching ? 'Fetching conditions…' : 'Fetch conditions'}
              variant="secondary"
              onPress={() => void fetchConditions(spot)}
              disabled={fetching}
            />
          ) : null}
          {unavailable ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Conditions unavailable.
            </Text>
          ) : null}
          {!showManual ? (
            <Button
              label="Enter gauge manually"
              variant="ghost"
              onPress={() => setShowManual(true)}
            />
          ) : (
            <View style={{ gap: theme.spacing[3] }}>
              <ChipSelect
                options={MANUAL_PARAMETERS}
                value={manualParam}
                onChange={setManualParam}
              />
              <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                <Field
                  label="Reading"
                  value={manualValue}
                  onChangeText={setManualValue}
                  placeholder="—"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Unit"
                  value={manualUnit}
                  onChangeText={setManualUnit}
                  placeholder={manualParam === 'discharge' ? 'cfs' : 'ft'}
                  keyboardType="default"
                  style={{ flex: 1 }}
                />
              </View>
              <Button
                label="Save reading"
                variant="secondary"
                onPress={saveManualReading}
                disabled={!Number.isFinite(Number(manualValue)) || manualValue.trim() === '' || manualUnit.trim() === ''}
              />
            </View>
          )}
        </View>
      )}
      {value.precip72hMm != null ? (
        <Text variant="dataSm" color={theme.colors.textMuted}>
          Rain, prior 72h: {value.precip72hMm} mm
        </Text>
      ) : null}

      {boatOptions.length > 0 ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Boat</Text>
          <ChipSelect
            options={boatOptions}
            value={value.boatGearId ?? null}
            // Tapping the selected boat again clears it (optional field).
            onChange={(id) =>
              onChange({ boatGearId: id === value.boatGearId ? undefined : id })
            }
          />
        </View>
      ) : null}

      <Field
        label="Class"
        value={value.sectionClass}
        onChangeText={(sectionClass) => onChange({ sectionClass })}
        placeholder="IV-V, III(IV)…"
        keyboardType="default"
      />
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <Field
          label="Water temp"
          value={value.waterTempC}
          onChangeText={(waterTempC) => onChange({ waterTempC })}
          placeholder="—"
          suffix="°C"
          style={{ flex: 1 }}
        />
        <Field
          label="Swims"
          value={value.swims}
          onChangeText={(swims) => onChange({ swims })}
          placeholder="—"
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
        <Field
          label="Rolls"
          value={value.rolls}
          onChangeText={(rolls) => onChange({ rolls })}
          placeholder="—"
          keyboardType="number-pad"
          style={{ flex: 1 }}
        />
      </View>
      <Field
        label="Hazards (private)"
        value={value.hazards}
        onChangeText={(hazards) => onChange({ hazards })}
        placeholder="—"
        keyboardType="default"
      />
    </Card>
  );
}
