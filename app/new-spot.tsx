/**
 * New spot — a minimal, honest spot-creation form (Dylan, 2026-07-12). Name
 * + an optional sport tag (which resolves the conditions feed automatically
 * via feedForSport) + optional manual lat/lng. The full map-pin picker stays
 * a later pass (pinned-spots-spec.md); this reuses SpotPicker's exact
 * createSpot/uuidv7 shape, so a spot made here is identical to one saved
 * from a Water/Wind session. `kind: 'place'` — nothing switches on kind for
 * generic spots (SpotCard/detail read `sport` + coords, not `kind`).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Field, Button, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { uuidv7 } from '@/lib/id';
import { createSpot } from '@/storage/spots';
import type { Spot } from '@core/spot';

// The sports that resolve a live conditions feed (feedForSport). '' = untagged
// — a named place with no conditions, still valid.
const SPORT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'kayak', label: 'Kayak' },
  { value: 'surf', label: 'Surf' },
  { value: 'wingfoil', label: 'Wingfoil' },
  { value: 'windsurf', label: 'Windsurf' },
  { value: 'kitesurf', label: 'Kitesurf' },
  { value: 'paragliding', label: 'Paragliding' },
];

export default function NewSpotScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && !busy;

  async function save() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    // Blank stays absent (null ≠ 0) — only a parsable coordinate is kept.
    const latN = Number(lat);
    const lngN = Number(lng);
    const spot: Spot = {
      id: uuidv7(),
      name: n,
      kind: 'place',
      ...(sport ? { sport } : {}),
      ...(lat.trim() !== '' && Number.isFinite(latN) ? { lat: latN } : {}),
      ...(lng.trim() !== '' && Number.isFinite(lngN) ? { lng: lngN } : {}),
      createdAt: new Date().toISOString(),
    };
    try {
      await createSpot(spot);
      router.back();
    } catch {
      // Keep the form open so nothing typed is lost — a silent failure reads
      // as "nothing happened".
      setError('Could not save spot. Try again.');
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        New spot
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Name it, and optionally tag a sport so live conditions follow.
        Coordinates are optional for now — the map-pin picker is a later pass.
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[5] }}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Hood River sandbar"
          keyboardType="default"
        />

        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Sport</Text>
          <ChipSelect options={SPORT_OPTIONS} value={sport} onChange={setSport} />
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Field label="Latitude" value={lat} onChangeText={setLat} placeholder="45.7087" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Longitude" value={lng} onChangeText={setLng} placeholder="-121.5150" />
          </View>
        </View>

        {error ? (
          <Text variant="bodySm" color={theme.colors.caution}>
            {error}
          </Text>
        ) : null}

        <Button label="Save spot" onPress={save} disabled={!canSave} loading={busy} />
      </View>
    </Screen>
  );
}
