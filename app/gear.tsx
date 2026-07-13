/**
 * Gear — the cross-sport quiver screen (P9, display-only rework). One quiver
 * spanning all sports, grouped by element (Earth / Water / Sky), over the
 * shared gear table (migration 014's canonical schema).
 *
 * Everything said about an item is a derived-on-read fact: totals from the
 * sessions that tag it (core/gear.ts, all three ref homes), "last used" off
 * the same accrual pass, wear against the user's own service mark, and a
 * reserve's repack date + days-elapsed as a date-keyed threshold
 * (src/lib/gearWear.ts). Nothing is a stored counter, nothing reminds —
 * these lines exist only while the quiver is open (profile spec §2; ⚑7
 * keeps notification mechanics unruled and unbuilt).
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
  type ParagliderSpec,
} from '@core/gear';
import { isKind, type Observation, type ObservationOf } from '@core/observation';
import { createGear, listGear, retireGear, type GearRecord } from '@/storage/gear';
import { listObservations } from '@/storage/observations';
import { paragliderWearLines, reserveRepackLine } from '@/lib/gearWear';
import { daysBetween, todayLocalDate } from '@/lib/date';
import { uuidv7 } from '@/lib/id';

// One arm-set per element — the same split core/gear.ts's category union
// draws. Order within an element is the order the arms shipped in.
const ELEMENTS: Array<{
  label: string;
  categories: Array<{ value: GearCategory; label: string }>;
}> = [
  {
    label: 'Earth',
    categories: [
      { value: 'shoes', label: 'Shoes' },
      { value: 'boots', label: 'Boots' },
      { value: 'bike', label: 'Bike' },
      { value: 'bike-component', label: 'Bike component' },
      { value: 'skis', label: 'Skis' },
    ],
  },
  {
    label: 'Water',
    categories: [
      { value: 'kayak', label: 'Kayak' },
      { value: 'wing', label: 'Wing' },
      { value: 'kite', label: 'Kite' },
      { value: 'board', label: 'Board' },
      { value: 'foil', label: 'Foil' },
      { value: 'parawing', label: 'Parawing' },
    ],
  },
  {
    label: 'Sky',
    categories: [
      { value: 'paraglider', label: 'Paraglider' },
      { value: 'harness', label: 'Harness' },
      { value: 'reserve', label: 'Reserve' },
    ],
  },
];

const PARAGLIDER_STYLES: Array<{ value: ParagliderSpec['style']; label: string }> = [
  { value: 'xc', label: 'XC' },
  { value: 'hikefly', label: 'Hike & fly' },
  { value: 'speed', label: 'Speed' },
  { value: 'parakite', label: 'Parakite' },
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

/** A real 'YYYY-MM-DD' from a raw text field, or undefined. */
function localDateOrUndefined(s: string): string | undefined {
  const t = s.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t)) ? t : undefined;
}

/** "today" / "yesterday" / "N days ago" — the last-used clause. */
function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
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
  const [gliderStyle, setGliderStyle] = useState<ParagliderSpec['style'] | null>(null);
  const [hoursBaseline, setHoursBaseline] = useState(''); // paraglider pre-app hours
  const [repackDate, setRepackDate] = useState(''); // reserve lastRepackAt (YYYY-MM-DD)
  const [repackMonths, setRepackMonths] = useState(''); // reserve repackIntervalMonths

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

  const active = useMemo(() => allGear.filter((g) => g.retiredOn == null), [allGear]);
  const bikes = useMemo(() => active.filter((g) => g.category === 'bike'), [active]);

  const sessionObs = useMemo(
    () => (sessions ?? []).filter((o): o is ObservationOf<'session'> => isKind(o, 'session')),
    [sessions]
  );

  const sessionLikes = useMemo(
    () =>
      // tz rides along: days + acquiredOn gating are civil-day questions in
      // the session's own zone (core/gear.ts GearSessionLike).
      sessionObs.map((o) => ({ occurredAt: o.occurredAt, tz: o.tz, payload: o.payload })),
    [sessionObs]
  );

  // Empty until the record is actually read — a row without its lines is
  // absence, which is honest; a computed 0 from an unread record is not.
  const linesById = useMemo(() => {
    const m = new Map<string, string[]>();
    if (sessions == null) return m;
    const today = todayLocalDate();
    for (const g of active) {
      const totals = deriveGearTotals(g, allGear, sessionLikes);
      const lines = [gearStatusLine(g, totals)];
      if (totals.lastUsed != null) {
        lines.push(`Last used ${totals.lastUsed.day} — ${agoLabel(daysBetween(totals.lastUsed.day, today))}`);
      }
      if (g.category === 'paraglider') {
        lines.push(...paragliderWearLines(g.id, g.spec, sessionObs));
      }
      if (g.category === 'reserve') {
        const repack = reserveRepackLine(g.spec, today);
        if (repack != null) lines.push(repack);
      }
      m.set(g.id, lines);
    }
    return m;
  }, [active, allGear, sessionLikes, sessionObs, sessions]);

  const canSave = name.trim() !== '' && category != null;

  async function handleAdd() {
    if (!canSave || saving || category == null) return;
    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    try {
      // Only marks the user actually typed land in the spec — an empty spec
      // block is omitted entirely (absent, not {}), except a component's,
      // which always carries its required componentType, and a paraglider's,
      // which exists only once a style names what kind of wing this is.
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
      } else if (category === 'paraglider') {
        spec =
          gliderStyle != null
            ? {
                style: gliderStyle,
                ...(posNum(hoursBaseline) != null ? { hoursBaseline: posNum(hoursBaseline) } : {}),
              }
            : undefined;
      } else if (category === 'reserve') {
        const lastRepackAt = localDateOrUndefined(repackDate);
        const repackIntervalMonths = posNum(repackMonths);
        spec =
          lastRepackAt != null || repackIntervalMonths != null
            ? {
                ...(lastRepackAt != null ? { lastRepackAt } : {}),
                ...(repackIntervalMonths != null ? { repackIntervalMonths } : {}),
              }
            : undefined;
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
      setGliderStyle(null);
      setHoursBaseline('');
      setRepackDate('');
      setRepackMonths('');
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
      <Text variant="label" color={theme.colors.accent}>
        Gear
      </Text>
      <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Your quiver, every sport. Totals are read from the sessions that tag
        each item — nothing here is a stored counter. Marks are yours; the
        lines just say where things stand.
      </Text>

      {active.length === 0 ? (
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            No gear yet. Anything added here becomes taggable on a session.
          </Text>
        </Card>
      ) : (
        ELEMENTS.filter((el) =>
          el.categories.some((c) => active.some((g) => g.category === c.value))
        ).map((el) => (
          <View key={el.label} style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }}>
            <Text variant="label" color={theme.colors.textMuted}>
              {el.label}
            </Text>
            {el.categories
              .filter((c) => active.some((g) => g.category === c.value))
              .map((c) => (
                <View key={c.value} style={{ gap: theme.spacing[3] }}>
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
                          <Button
                            label="Retire"
                            variant="ghost"
                            onPress={() => handleRetire(g.id)}
                          />
                        </View>
                        {(linesById.get(g.id) ?? []).map((line, i) => (
                          <Text key={i} variant="bodySm" color={theme.colors.textSecondary}>
                            {line}
                          </Text>
                        ))}
                        {g.parentId ? (
                          <Text variant="bodySm" color={theme.colors.textMuted}>
                            On {allGear.find((p) => p.id === g.parentId)?.name ?? 'a retired bike'}
                          </Text>
                        ) : null}
                      </Card>
                    ))}
                </View>
              ))}
          </View>
        ))
      )}

      {/* Add form */}
      <Card style={{ marginTop: theme.spacing[8], gap: theme.spacing[4] }}>
        <Text variant="label">New gear</Text>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Speedgoat 5"
          keyboardType="default"
        />
        {ELEMENTS.map((el) => (
          <View key={el.label} style={{ gap: theme.spacing[2] }}>
            <Text variant="label">{el.label}</Text>
            <ChipSelect
              options={el.categories}
              value={category}
              onChange={(next) => {
                setCategory(next);
                setParentId(null);
              }}
            />
          </View>
        ))}

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

        {category === 'paraglider' ? (
          <>
            <View style={{ gap: theme.spacing[2] }}>
              <Text variant="label">Style (optional)</Text>
              <ChipSelect
                options={PARAGLIDER_STYLES}
                value={gliderStyle}
                onChange={(s) => setGliderStyle(s === gliderStyle ? null : s)}
              />
            </View>
            {gliderStyle != null ? (
              <Field
                label="Hours flown before tracking (optional)"
                value={hoursBaseline}
                onChangeText={setHoursBaseline}
                placeholder="—"
                suffix="hr"
                keyboardType="number-pad"
              />
            ) : null}
          </>
        ) : null}

        {category === 'reserve' ? (
          <>
            <Field
              label="Last repacked (optional)"
              value={repackDate}
              onChangeText={setRepackDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <Field
              label="Repack interval (optional)"
              value={repackMonths}
              onChangeText={setRepackMonths}
              placeholder="—"
              suffix="months"
              keyboardType="number-pad"
            />
          </>
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
