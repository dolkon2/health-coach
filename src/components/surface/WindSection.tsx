/**
 * WindSection — the wind-sport inline section of the Log Session screen
 * (contract §8; wingfoil / windsurf / kitesurf / parawing / sail on the gps
 * surface — the activity id IS the sub-sport, no subSport field).
 *
 * Freeze-at-save semantics mirror WhitewaterSection:
 *   - Picking a launch with coords auto-fetches the wind snapshot FOR THE
 *     SESSION TIME (backdate-correct); an existing snapshot is IMMUTABLE —
 *     fetch button hidden, display read-only, never refetched on edit.
 *   - A failed fetch leaves the field absent with a quiet "conditions
 *     unavailable" — the manual fallback (speed + optional gust/direction,
 *     source 'manual') covers no-signal launches honestly.
 *   - Manual entry needs the launch's coords (WindSnapshot pins the reading to
 *     a place); a coord-less spot gets a quiet note, never a fabricated 0,0.
 *
 * Gear: picking a kit expands its gearIds onto the form and records kitId as
 * provenance; hand-toggling loose gear afterwards drops kitId (the loadout is
 * no longer exactly that kit — provenance stays truthful).
 *
 * BAREBONES functional UI (Dylan's redesign supersedes). Primitives are
 * imported directly, not via the '@/components' barrel — see SpotPicker.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../Text';
import { Card } from '../Card';
import { Field } from '../Field';
import { ChipSelect, type ChipOption } from '../ChipSelect';
import { Button } from '../Button';
import { Checkbox } from './GymExerciseEditor';
import { SpotPicker } from './SpotPicker';
import { useTheme } from '@/theme';
import type { Spot } from '@core/spot';
import type { GearCategory, GearItem, Kit } from '@core/gear';
import type { WindSnapshot } from '@core/conditions/snapshot';
import type { SessionForm } from '@/lib/session';
import { getSpot } from '@/storage/spots';
import { listGearItems, listKits } from '@/storage/gear';
import { fetchWindSnapshot } from '@/lib/conditions/openMeteoClient';

/**
 * A hand-entered wind reading frozen into the locked snapshot shape: the
 * spot's coords pin it to a place, observedAtUtc is the SESSION time,
 * fetchedAtUtc is when the user entered it, source 'manual'. Optional
 * gust/direction stay absent when unentered (omit-when-absent). Pure — the
 * flow tests drive it directly.
 */
export function manualWindSnapshot(input: {
  lat: number;
  lng: number;
  speedKts: number;
  gustKts?: number;
  directionDeg?: number;
  sessionTimeUtc: string;
  now: string;
}): WindSnapshot {
  return {
    lat: input.lat,
    lng: input.lng,
    speedKts: input.speedKts,
    ...(input.gustKts != null ? { gustKts: input.gustKts } : {}),
    ...(input.directionDeg != null ? { directionDeg: input.directionDeg } : {}),
    observedAtUtc: input.sessionTimeUtc,
    fetchedAtUtc: input.now,
    source: 'manual',
  };
}

/** Kit pick → form patch: expand the resolved gearIds, keep kitId as provenance. */
export function kitPickPatch(kit: Kit): Partial<SessionForm['wind']> {
  return { kitId: kit.id, gearIds: [...kit.gearIds] };
}

/** The wind-sport quiver — Water's loose-gear categories (contract §8). */
const WIND_GEAR_CATEGORIES: ReadonlyArray<GearCategory> = [
  'wing',
  'kite',
  'parawing',
  'board',
  'foil',
];

const SESSION_STYLES: ChipOption<'downwind' | 'back-and-forth'>[] = [
  { value: 'downwind', label: 'Downwind' },
  { value: 'back-and-forth', label: 'Back & forth' },
];

export type WindSectionProps = {
  value: SessionForm['wind'];
  onChange: (patch: Partial<SessionForm['wind']>) => void;
  /** Session time (edit: original occurredAt; new: route start or screen open) — what makes fetches backdate-correct. */
  sessionTimeUtc: string;
  /** True when the snapshot was already on the SAVED session — truly immutable.
   *  A draft-fetched snapshot may still be invalidated by re-picking the spot. */
  snapshotLocked?: boolean;
};

export function WindSection({
  value,
  onChange,
  sessionTimeUtc,
  snapshotLocked,
}: WindSectionProps) {
  const theme = useTheme();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [fetching, setFetching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  // Race guards mirroring WhitewaterSection: a manual entry or spot re-pick
  // while a fetch is airborne must win over the fetch's late result.
  const seqRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  // Manual wind fallback drafts.
  const [showManual, setShowManual] = useState(false);
  const [manualSpeed, setManualSpeed] = useState('');
  const [manualGust, setManualGust] = useState('');
  const [manualDirection, setManualDirection] = useState('');

  // Hydrate the picked launch on edit (the form carries only spotId) so the
  // fetch button and the manual fallback know its coords.
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

  // Kit + loose-gear options from the gear store (active quiver only).
  useEffect(() => {
    let cancelled = false;
    Promise.all([listKits(), listGearItems({})])
      .then(([k, g]) => {
        if (cancelled) return;
        setKits(k);
        setGear(g.filter((item) => WIND_GEAR_CATEGORIES.includes(item.category)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Freeze the wind for the session time — only while no snapshot exists. */
  async function fetchConditions(target: Spot, force = false) {
    // `force` bypasses the entry guard on a re-pick, where the clearing patch is
    // still in flight and the closure/ref both hold the previous spot's snapshot.
    if ((value.wind && !force) || fetching || target.lat == null || target.lng == null) return;
    const seq = ++seqRef.current;
    setFetching(true);
    setUnavailable(false);
    const snap = await fetchWindSnapshot(
      target.lat,
      target.lng,
      Math.floor(Date.parse(sessionTimeUtc) / 1000)
    );
    setFetching(false);
    // A newer pick or a manual entry happened while this fetch was airborne —
    // the user's action wins; the late result is dropped, never overwrites.
    if (seq !== seqRef.current) return;
    if (!force && valueRef.current.wind) return;
    if (snap) onChange({ wind: snap });
    else setUnavailable(true);
  }

  function handlePick(s: Spot) {
    setSpot(s);
    // Correcting a mis-tapped launch invalidates the DRAFT snapshot — spot A's
    // wind must not describe spot B. A saved session's snapshot stays locked.
    const repick = value.spotId != null && value.spotId !== s.id;
    const invalidate = repick && !snapshotLocked && value.wind != null;
    seqRef.current++;
    onChange({
      spotId: s.id,
      spotName: s.name,
      ...(invalidate ? { wind: undefined } : {}),
    });
    if (s.lat != null && s.lng != null && (invalidate || !value.wind)) {
      void fetchConditions(s, invalidate);
    }
  }

  function saveManualReading() {
    const speed = Number(manualSpeed);
    const coords = spot && spot.lat != null && spot.lng != null ? spot : null;
    if (value.wind || !coords || !Number.isFinite(speed)) return;
    // A manual entry outruns any in-flight auto-fetch (seq bump drops it).
    seqRef.current++;
    const gust = Number(manualGust);
    const direction = Number(manualDirection);
    onChange({
      wind: manualWindSnapshot({
        lat: coords.lat!,
        lng: coords.lng!,
        speedKts: speed,
        ...(manualGust.trim() !== '' && Number.isFinite(gust) ? { gustKts: gust } : {}),
        ...(manualDirection.trim() !== '' && Number.isFinite(direction)
          ? { directionDeg: direction }
          : {}),
        sessionTimeUtc,
        now: new Date().toISOString(),
      }),
    });
    setShowManual(false);
  }

  function toggleGear(id: string) {
    const current = value.gearIds ?? [];
    const next = current.includes(id) ? current.filter((g) => g !== id) : [...current, id];
    // A hand-tweaked loadout is no longer exactly the kit — drop the provenance.
    onChange({ gearIds: next, kitId: undefined });
  }

  const wind = value.wind;
  const canManual = spot != null && spot.lat != null && spot.lng != null;
  const kitOptions: ChipOption<string>[] = kits.map((k) => ({ value: k.id, label: k.name }));

  return (
    <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[4] }}>
      <Text variant="label" color={theme.colors.textSecondary}>
        Wind
      </Text>

      <SpotPicker
        kind="launch"
        label="Launch"
        selectedName={value.spotName}
        onPick={handlePick}
      />

      {/* Frozen snapshot — read-only once present, never refetched. */}
      {wind ? (
        <View style={{ gap: theme.spacing[1] }}>
          <Text variant="label">Wind{wind.source === 'manual' ? ' (manual)' : ''}</Text>
          <Text variant="dataSm">
            {[
              `${wind.speedKts} kt`,
              wind.gustKts != null ? `gusting ${wind.gustKts} kt` : null,
              wind.directionDeg != null ? `from ${wind.directionDeg}°` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text variant="dataSm" color={theme.colors.textMuted}>
            at {wind.observedAtUtc}
          </Text>
        </View>
      ) : (
        <View style={{ gap: theme.spacing[2] }}>
          {canManual ? (
            <Button
              label={fetching ? 'Fetching conditions…' : 'Fetch conditions'}
              variant="secondary"
              onPress={() => void fetchConditions(spot!)}
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
              label="Enter wind manually"
              variant="ghost"
              onPress={() => setShowManual(true)}
            />
          ) : canManual ? (
            <View style={{ gap: theme.spacing[3] }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                <Field
                  label="Wind"
                  value={manualSpeed}
                  onChangeText={setManualSpeed}
                  placeholder="—"
                  suffix="kt"
                  style={{ flex: 1 }}
                />
                <Field
                  label="Gust"
                  value={manualGust}
                  onChangeText={setManualGust}
                  placeholder="—"
                  suffix="kt"
                  style={{ flex: 1 }}
                />
                <Field
                  label="From"
                  value={manualDirection}
                  onChangeText={setManualDirection}
                  placeholder="—"
                  suffix="°"
                  keyboardType="number-pad"
                  style={{ flex: 1 }}
                />
              </View>
              <Button
                label="Save reading"
                variant="secondary"
                onPress={saveManualReading}
                disabled={manualSpeed.trim() === '' || !Number.isFinite(Number(manualSpeed))}
              />
            </View>
          ) : (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Manual wind needs a launch with coordinates.
            </Text>
          )}
        </View>
      )}

      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Session style (optional)</Text>
        <ChipSelect
          options={SESSION_STYLES}
          value={value.sessionStyle ?? null}
          // Tapping the selected style again clears it back to none.
          onChange={(style) =>
            onChange(
              style === value.sessionStyle
                ? { sessionStyle: undefined, endSpotId: undefined, endSpotName: undefined }
                : style === 'back-and-forth'
                  ? { sessionStyle: style, endSpotId: undefined, endSpotName: undefined }
                  : { sessionStyle: style }
            )
          }
        />
      </View>

      {value.sessionStyle === 'downwind' ? (
        <SpotPicker
          kind="launch"
          label="Landing spot"
          selectedName={value.endSpotName}
          onPick={(s) => onChange({ endSpotId: s.id, endSpotName: s.name })}
        />
      ) : null}

      {kitOptions.length > 0 ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Kit</Text>
          <ChipSelect
            options={kitOptions}
            value={value.kitId ?? null}
            onChange={(id) => {
              if (id === value.kitId) {
                // Tapping the picked kit again clears the whole loadout.
                onChange({ kitId: undefined, gearIds: undefined });
                return;
              }
              const kit = kits.find((k) => k.id === id);
              if (kit) onChange(kitPickPatch(kit));
            }}
          />
        </View>
      ) : null}

      {gear.length > 0 ? (
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Gear</Text>
          {gear.map((g) => (
            <Checkbox
              key={g.id}
              label={`${g.name} (${g.category})`}
              checked={(value.gearIds ?? []).includes(g.id)}
              onToggle={() => toggleGear(g.id)}
            />
          ))}
        </View>
      ) : null}

      <Field
        label="Session note (optional)"
        value={value.note}
        onChangeText={(note) => onChange({ note })}
        placeholder="lit on the 9m…"
        keyboardType="default"
      />
    </Card>
  );
}
