/**
 * SpotPicker — minimal shared spot chooser for the Water sections (contract §8).
 *
 * Lists saved spots of one kind (river-section for whitewater, launch for the
 * wind sports), tap to pick, plus an inline "new spot" creation path:
 *   - river-section: name + river/section + a USGS gauge search by name that
 *     attaches the home gauge id (and the gauge's coords — real coordinates on
 *     the same river, close enough for the 72h-rain fetch, never a fabricated
 *     0,0);
 *   - launch: name + manual lat/lng entry (v1 — a map-pin picker is redesign
 *     territory).
 *
 * Picking calls back with the full Spot, and with the picked GaugeSite when the
 * spot was just created from a search hit: the persisted Spot carries only the
 * gauge's ID, but the caller wants its NAME to copy onto the frozen snapshot
 * (the fetch client omits siteName — known gap).
 *
 * BAREBONES functional UI by design (Dylan's redesign supersedes the look).
 * Primitives are imported directly rather than via the '@/components' barrel so
 * the flow tests can import the Water sections without dragging every component
 * — and their native deps — into the jest module graph.
 */
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../Text';
import { Field } from '../Field';
import { Button } from '../Button';
import { useTheme } from '@/theme';
import { uuidv7 } from '@/lib/id';
import type { Spot } from '@core/spot';
import type { GaugeSite } from '@core/conditions/usgs';
import { createSpot, listSpots } from '@/storage/spots';
import { searchGaugeSitesByName } from '@/lib/conditions/usgsClient';

export type SpotPickerProps = {
  kind: Spot['kind'];
  label: string; // "Spot" / "Landing spot"
  /** Denormalized name already on the form — shown while collapsed. */
  selectedName?: string;
  /** River/section already typed on the form — only read when kind==='river-section'. */
  prefillRiverName?: string;
  prefillSectionName?: string;
  onPick: (spot: Spot, gaugeSite?: GaugeSite) => void;
};

/** Separator shared by the derived new-spot name and the saved-spot subtitle, so they read consistently. */
function joinRiverSection(riverName?: string, sectionName?: string): string {
  return [riverName, sectionName].filter(Boolean).join(' · ');
}

/** A river-section spot's name is derived from river/section, never typed separately. */
export function deriveRiverSectionSpot(
  riverName?: string,
  sectionName?: string
): { name: string; riverName?: string; sectionName?: string } {
  const r = riverName?.trim();
  const s = sectionName?.trim();
  return {
    name: joinRiverSection(r, s),
    ...(r ? { riverName: r } : {}),
    ...(s ? { sectionName: s } : {}),
  };
}

export function SpotPicker({
  kind,
  label,
  selectedName,
  prefillRiverName,
  prefillSectionName,
  onPick,
}: SpotPickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  // New-spot draft (string-typed, parsed at create).
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  // Gauge search (river-section only).
  const [gaugeQuery, setGaugeQuery] = useState('');
  const [gaugeResults, setGaugeResults] = useState<GaugeSite[] | null>(null);
  const [gaugeSite, setGaugeSite] = useState<GaugeSite | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openList() {
    setOpen(true);
    try {
      setSpots(await listSpots({ kind }));
    } catch {
      setSpots([]);
    }
  }

  function pick(spot: Spot, site?: GaugeSite) {
    setOpen(false);
    setCreating(false);
    onPick(spot, site);
  }

  async function searchGauges() {
    if (searching || gaugeQuery.trim() === '') return;
    setSearching(true);
    // The client returns [] on any miss — never throws.
    setGaugeResults(await searchGaugeSitesByName(gaugeQuery));
    setSearching(false);
  }

  const derivedRiverSection =
    kind === 'river-section' ? deriveRiverSectionSpot(prefillRiverName, prefillSectionName) : null;

  async function create() {
    const n = kind === 'river-section' ? derivedRiverSection!.name : name.trim();
    if (n === '' || busy) return;
    setBusy(true);
    setError(null);
    const latN = Number(lat);
    const lngN = Number(lng);
    const spot: Spot = {
      id: uuidv7(),
      name: n,
      kind,
      ...(kind === 'river-section'
        ? {
            ...(derivedRiverSection!.riverName ? { riverName: derivedRiverSection!.riverName } : {}),
            ...(derivedRiverSection!.sectionName ? { sectionName: derivedRiverSection!.sectionName } : {}),
            ...(gaugeSite ? { gaugeSiteId: gaugeSite.siteId } : {}),
            // The gauge's coords stand in for the section's (see header note).
            ...(gaugeSite?.lat != null ? { lat: gaugeSite.lat } : {}),
            ...(gaugeSite?.lng != null ? { lng: gaugeSite.lng } : {}),
          }
        : {
            // Blank stays absent (null ≠ 0); only a parsable entry is kept.
            ...(lat.trim() !== '' && Number.isFinite(latN) ? { lat: latN } : {}),
            ...(lng.trim() !== '' && Number.isFinite(lngN) ? { lng: lngN } : {}),
          }),
      createdAt: new Date().toISOString(),
    };
    try {
      await createSpot(spot);
      pick(spot, gaugeSite ?? undefined);
    } catch {
      // Leave the form open so nothing typed is lost, but say so — a silent
      // failure here reads as "nothing happened" and hides a real problem.
      setError('Could not create spot. Try again.');
    }
    setBusy(false);
  }

  function spotSubtitle(s: Spot): string {
    if (s.kind === 'river-section') {
      return joinRiverSection(s.riverName, s.sectionName);
    }
    return s.lat != null && s.lng != null ? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}` : '';
  }

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="label">{label}</Text>
        <Pressable
          onPress={() => (open ? setOpen(false) : void openList())}
          accessibilityRole="button"
          accessibilityLabel={open ? `Close ${label} picker` : `Choose ${label}`}
          hitSlop={8}
        >
          <Text variant="label" color={theme.colors.accent}>
            {open ? 'Close' : selectedName ? 'Change' : 'Choose'}
          </Text>
        </Pressable>
      </View>
      {!open && selectedName ? <Text variant="bodySm">{selectedName}</Text> : null}

      {open ? (
        <View style={{ gap: theme.spacing[2] }}>
          {spots === null ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Loading…
            </Text>
          ) : spots.length === 0 ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              No saved {kind === 'river-section' ? 'river sections' : 'launches'} yet.
            </Text>
          ) : (
            spots.map((s) => {
              const subtitle = spotSubtitle(s);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => pick(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pick ${s.name}`}
                  style={{ paddingVertical: theme.spacing[2] }}
                >
                  <Text variant="body">{s.name}</Text>
                  {subtitle ? (
                    <Text variant="dataSm" color={theme.colors.textMuted}>
                      {subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}

          {!creating ? (
            <Pressable
              onPress={() => setCreating(true)}
              accessibilityRole="button"
              accessibilityLabel="New spot"
              hitSlop={8}
              style={{ alignSelf: 'flex-start', paddingVertical: theme.spacing[1] }}
            >
              <Text variant="label" color={theme.colors.accent}>
                + New spot
              </Text>
            </Pressable>
          ) : (
            <View style={{ gap: theme.spacing[3] }}>
              {kind === 'river-section' ? (
                <>
                  <Text variant="bodySm" color={theme.colors.textMuted}>
                    {derivedRiverSection!.name
                      ? `Will save as "${derivedRiverSection!.name}".`
                      : 'Type a River or Section above first.'}
                  </Text>
                  <View style={{ gap: theme.spacing[2] }}>
                    <View style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-end' }}>
                      <Field
                        label="Home gauge (optional)"
                        value={gaugeQuery}
                        onChangeText={setGaugeQuery}
                        placeholder="search by river name"
                        keyboardType="default"
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={searching ? 'Searching…' : 'Search'}
                        variant="secondary"
                        onPress={searchGauges}
                        disabled={searching || gaugeQuery.trim() === ''}
                      />
                    </View>
                    {gaugeSite ? (
                      <Text variant="bodySm">Gauge: {gaugeSite.name} ✓</Text>
                    ) : null}
                    {gaugeResults !== null && !gaugeSite ? (
                      gaugeResults.length === 0 ? (
                        <Text variant="bodySm" color={theme.colors.textMuted}>
                          No gauges found.
                        </Text>
                      ) : (
                        gaugeResults.slice(0, 8).map((site) => (
                          <Pressable
                            key={site.siteId}
                            onPress={() => setGaugeSite(site)}
                            accessibilityRole="button"
                            accessibilityLabel={`Pick gauge ${site.name}`}
                            style={{ paddingVertical: theme.spacing[1] }}
                          >
                            <Text variant="bodySm">{site.name}</Text>
                          </Pressable>
                        ))
                      )
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <Field
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Hood River sandbar"
                    keyboardType="default"
                  />
                  <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
                    <Field
                      label="Lat"
                      value={lat}
                      onChangeText={setLat}
                      placeholder="45.7115"
                      keyboardType="numbers-and-punctuation"
                      style={{ flex: 1 }}
                    />
                    <Field
                      label="Lng"
                      value={lng}
                      onChangeText={setLng}
                      placeholder="-121.4977"
                      keyboardType="numbers-and-punctuation"
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              )}
              {error ? (
                <Text variant="bodySm" color={theme.colors.negative}>
                  {error}
                </Text>
              ) : null}
              <Button
                label="Create spot"
                variant="secondary"
                onPress={create}
                disabled={(kind === 'river-section' ? derivedRiverSection!.name : name).trim() === '' || busy}
                loading={busy}
              />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
