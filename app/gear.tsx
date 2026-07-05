/**
 * Gear — the quiver screen (dimension/earth, Pass E1). Deliberately spartan:
 * the UI redesign happens elsewhere; this is the working surface for the data.
 *
 * Lists active gear grouped by category, each with a derived status line —
 * computed on read from the sessions that tag it (core/gear.ts), never a
 * stored total. Retire stamps an end-of-service date and keeps the history;
 * every string stays descriptive (a mark is the user's own fact, not our
 * advice — constitution).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Card, Field, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import {
  deriveGearTotals,
  gearStatusLine,
  type BikeComponentType,
  type GearCategory,
} from '@core/gear';
import { isKind, type Observation } from '@core/observation';
import { createGear, listGear, retireGear, type GearRecord } from '@/storage/gear';
import { listObservations } from '@/storage/observations';
import { todayLocalDate } from '@/lib/date';
import { uuidv7 } from '@/lib/id';

const CATEGORIES: Array<{ value: GearCategory; label: string }> = [
  { value: 'shoes', label: 'Shoes' },
  { value: 'boots', label: 'Boots' },
  { value: 'bike', label: 'Bike' },
  { value: 'bike-component', label: 'Bike component' },
  { value: 'skis', label: 'Skis' },
];

const COMPONENT_TYPES: Array<{ value: BikeComponentType; label: string }> = [
  { value: 'chain', label: 'Chain' },
  { value: 'cassette', label: 'Cassette' },
  { value: 'tires', label: 'Tires' },
  { value: 'brake-pads', label: 'Brake pads' },
  { value: 'fork', label: 'Fork' },
  { value: 'shock', label: 'Shock' },
  { value: 'other', label: 'Other' },
];

/** Positive number from a raw text field, or undefined (never a fabricated 0). */
function posNum(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function GearScreen() {
  const theme = useTheme();
  const router = useRouter();

  // All gear (retired included) so a component can still resolve its parent
  // bike after the bike retires; the list itself shows the active quiver.
  const [allGear, setAllGear] = useState<GearRecord[]>([]);
  // null until the session read lands. An unread record is UNKNOWN, not zero —
  // rendering "0 sessions" off a failed (or still-loading) read would state a
  // fabricated fact about gear that may have hundreds of tagged sessions.
  const [sessions, setSessions] = useState<Observation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GearCategory | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [componentType, setComponentType] = useState<BikeComponentType>('other');
  const [markKm, setMarkKm] = useState(''); // shoes/boots targetKm, component serviceIntervalKm
  const [markHr, setMarkHr] = useState(''); // component serviceIntervalHr
  const [markDays, setMarkDays] = useState(''); // skis targetDays

  const reload = useCallback(() => {
    listGear({ includeRetired: true })
      .then(setAllGear)
      .catch(() => setError('Could not load gear.'));
  }, []);

  useEffect(() => {
    reload();
    listObservations({ kinds: ['session'] })
      .then(setSessions)
      // A failed read is not an empty record: say so and leave totals unsaid
      // (sessions stays null), never a fabricated "0 sessions".
      .catch(() => setError('Could not read session history — totals unavailable.'));
  }, [reload]);

  const active = useMemo(() => allGear.filter((g) => g.retiredAt == null), [allGear]);
  const bikes = useMemo(() => active.filter((g) => g.category === 'bike'), [active]);

  const sessionLikes = useMemo(
    () =>
      (sessions ?? [])
        .filter((o) => isKind(o, 'session'))
        // tz rides along: days + acquiredAt gating are civil-day questions in
        // the session's own zone (core/gear.ts GearSessionLike).
        .map((o) => ({ occurredAt: o.occurredAt, tz: o.tz, payload: o.payload })),
    [sessions]
  );

  // Empty until the record is actually read — a row without a status line is
  // absence, which is honest; a computed 0 from an unread record is not.
  const statusById = useMemo(() => {
    const m = new Map<string, string>();
    if (sessions == null) return m;
    for (const g of active) {
      m.set(g.id, gearStatusLine(g, deriveGearTotals(g, allGear, sessionLikes)));
    }
    return m;
  }, [active, allGear, sessionLikes, sessions]);

  const canSave = name.trim() !== '' && category != null;

  async function handleAdd() {
    if (!canSave || saving || category == null) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      // Only marks the user actually typed land in the spec — an empty spec
      // block is omitted entirely (absent, not {}), except a component's,
      // which always carries its required componentType.
      let spec: GearRecord['spec'];
      if (category === 'shoes' || category === 'boots') {
        const targetKm = posNum(markKm);
        spec = targetKm != null ? { targetKm } : undefined;
      } else if (category === 'bike-component') {
        spec = {
          componentType,
          ...(posNum(markKm) != null ? { serviceIntervalKm: posNum(markKm) } : {}),
          ...(posNum(markHr) != null ? { serviceIntervalHr: posNum(markHr) } : {}),
        };
      } else if (category === 'skis') {
        const targetDays = posNum(markDays);
        spec = targetDays != null ? { targetDays } : undefined;
      }
      await createGear({
        id: uuidv7(),
        name: name.trim(),
        category,
        ...(category === 'bike-component' && parentId ? { parentId } : {}),
        ...(spec !== undefined ? { spec } : {}),
        createdAt: new Date().toISOString(),
      } as GearRecord);
      setName('');
      setCategory(null);
      setParentId(null);
      setComponentType('other');
      setMarkKm('');
      setMarkHr('');
      setMarkDays('');
      reload();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire(id: string) {
    setError(null);
    try {
      // A civil date, not an instant — "when it left service" is a day fact,
      // in the user's local day (a 6pm retire is today, not UTC's tomorrow).
      await retireGear(id, todayLocalDate());
      reload();
    } catch {
      setError('Could not retire that item.');
    }
  }

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Gear
      </Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Your quiver. Totals are read from the sessions that tag each item —
        nothing here is a stored counter. Marks are yours; the line just says
        where the total stands.
      </Text>

      {active.length === 0 ? (
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            No gear yet. Anything added here becomes taggable on a session.
          </Text>
        </Card>
      ) : (
        CATEGORIES.filter((c) => active.some((g) => g.category === c.value)).map((c) => (
          <View key={c.value} style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
            <Text variant="label">{c.label}</Text>
            {active
              .filter((g) => g.category === c.value)
              .map((g) => (
                <Card key={g.id} style={{ gap: theme.spacing[2] }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text variant="body">{g.name}</Text>
                    <Button label="Retire" variant="ghost" onPress={() => handleRetire(g.id)} />
                  </View>
                  {statusById.has(g.id) ? (
                    <Text variant="bodySm" color={theme.colors.textSecondary}>
                      {statusById.get(g.id)}
                    </Text>
                  ) : null}
                  {g.parentId ? (
                    <Text variant="bodySm" color={theme.colors.textMuted}>
                      On {allGear.find((p) => p.id === g.parentId)?.name ?? 'a retired bike'}
                    </Text>
                  ) : null}
                </Card>
              ))}
          </View>
        ))
      )}

      {/* Add form */}
      <Card style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }}>
        <Text variant="label">New gear</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Speedgoat 5" />
        <View style={{ gap: theme.spacing[2] }}>
          <Text variant="label">Category</Text>
          <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} />
        </View>

        {category === 'shoes' || category === 'boots' ? (
          <Field
            label="Distance mark (optional)"
            value={markKm}
            onChangeText={setMarkKm}
            placeholder="—"
            suffix="km"
            keyboardType="number-pad"
          />
        ) : null}

        {category === 'bike-component' ? (
          <>
            <View style={{ gap: theme.spacing[2] }}>
              <Text variant="label">Part</Text>
              <ChipSelect
                options={COMPONENT_TYPES}
                value={componentType}
                onChange={setComponentType}
              />
            </View>
            <View style={{ gap: theme.spacing[2] }}>
              <Text variant="label">On which bike (optional)</Text>
              {bikes.length > 0 ? (
                <ChipSelect
                  options={bikes.map((b) => ({ value: b.id, label: b.name }))}
                  value={parentId}
                  onChange={(id) => setParentId(id === parentId ? null : id)}
                />
              ) : (
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  No bike in the quiver yet — a component tied to one accrues that
                  bike&apos;s rides from its install date.
                </Text>
              )}
            </View>
            <Field
              label="Service mark (optional)"
              value={markKm}
              onChangeText={setMarkKm}
              placeholder="—"
              suffix="km"
              keyboardType="number-pad"
            />
            <Field
              label="Service mark (optional)"
              value={markHr}
              onChangeText={setMarkHr}
              placeholder="—"
              suffix="hr"
              keyboardType="number-pad"
            />
          </>
        ) : null}

        {category === 'skis' ? (
          <Field
            label="Days mark (optional)"
            value={markDays}
            onChangeText={setMarkDays}
            placeholder="—"
            suffix="days"
            keyboardType="number-pad"
          />
        ) : null}

        <Button label="Add to quiver" onPress={handleAdd} disabled={!canSave} loading={saving} />
      </Card>

      {error ? (
        <Text variant="bodySm" color={theme.colors.negative} style={{ marginTop: theme.spacing[4] }}>
          {error}
        </Text>
      ) : null}

      <View style={{ height: theme.spacing[6] }} />
      <Button label="Done" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
