/**
 * Protocols — the user's own home-exercise plan(s) (Body P7b, pt-model.md).
 * Define a plan (name + exercises with a target-per-week the user sets, never
 * generated), tick exercises done today (re-tap untoggles), see rolling-7d
 * adherence. FDA wellness naming rules are binding: descriptive copy only,
 * no rehab/rx/therapy/compliance wording. The app never suggests or modifies
 * a protocol's content — it's the notebook, not the clinician.
 */
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, Field, RemoveButton } from '@/components';
import { useTheme } from '@/theme';
import { getUserProtocols, setUserProtocols } from '@/storage/settings';
import { listProtocolTicks, toggleProtocolTick } from '@/storage/protocolTicks';
import { activeProtocols, validateProtocol, type UserProtocol } from '@/lib/protocols';
import { protocolAdherenceStatus, behaviorLine } from '@/lib/benchmarkStatus';
import { daysAgoUtc, localDayWindow } from '@/lib/date';
import { uuidv7 } from '@/lib/id';

type DraftExercise = { id: string; name: string; targetPerWeek: string };

export default function ProtocolsScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [protocols, setProtocols] = useState<UserProtocol[]>([]);
  const [weekTicks, setWeekTicks] = useState<Record<string, Record<string, number>>>({});
  const [todayTicked, setTodayTicked] = useState<Set<string>>(new Set()); // `${protocolId}::${exerciseId}`
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getUserProtocols();
      setProtocols(all);
      const weekRows = await listProtocolTicks({ from: daysAgoUtc(7) });
      const byProtocol: Record<string, Record<string, number>> = {};
      for (const tick of weekRows) {
        const { protocolId, exerciseId } = tick.payload;
        if (!protocolId || !exerciseId) continue;
        const byExercise = byProtocol[protocolId] ?? {};
        byExercise[exerciseId] = (byExercise[exerciseId] ?? 0) + 1;
        byProtocol[protocolId] = byExercise;
      }
      setWeekTicks(byProtocol);

      const { startUtc, endUtc } = localDayWindow();
      const todayRows = await listProtocolTicks({ from: startUtc, to: endUtc });
      setTodayTicked(
        new Set(
          todayRows
            .filter((t) => t.payload.protocolId && t.payload.exerciseId)
            .map((t) => `${t.payload.protocolId}::${t.payload.exerciseId}`)
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function onToggle(protocolId: string, exerciseId: string) {
    // toggleProtocolTick is read-then-write (list today's ticks, create if
    // absent) — a fast double-tap before reload() resolves could race two
    // concurrent calls that both see "no existing tick" and both insert one,
    // breaking the one-tick-per-day invariant. A per-exercise in-flight guard
    // (not a global one) keeps every OTHER row tappable while one is pending.
    const key = `${protocolId}::${exerciseId}`;
    if (togglingKey === key) return;
    setTogglingKey(key);
    try {
      await toggleProtocolTick({ protocolId, exerciseId, id: uuidv7() });
      await reload();
    } finally {
      setTogglingKey(null);
    }
  }

  function startNew() {
    setEditingId('new');
    setDraftName('');
    setDraftExercises([{ id: uuidv7(), name: '', targetPerWeek: '3' }]);
    setError(null);
  }

  function startEdit(p: UserProtocol) {
    setEditingId(p.id);
    setDraftName(p.name);
    setDraftExercises(p.exercises.map((e) => ({ ...e, targetPerWeek: String(e.targetPerWeek) })));
    setError(null);
  }

  function addDraftExercise() {
    setDraftExercises((rows) => [...rows, { id: uuidv7(), name: '', targetPerWeek: '3' }]);
  }

  function removeDraftExercise(id: string) {
    setDraftExercises((rows) => rows.filter((r) => r.id !== id));
  }

  function mutateDraftExercise(id: string, patch: Partial<DraftExercise>) {
    setDraftExercises((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function saveDraft() {
    if (saving || editingId == null) return;
    const exercises = draftExercises
      .filter((e) => e.name.trim() !== '')
      .map((e) => ({
        id: e.id,
        name: e.name.trim(),
        targetPerWeek: Math.round(Number(e.targetPerWeek)) || 0,
      }));
    const validationError = validateProtocol({ name: draftName, exercises });
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      if (editingId === 'new') {
        const p: UserProtocol = { id: uuidv7(), name: draftName.trim(), exercises, createdAt: now };
        await setUserProtocols([...protocols, p]);
      } else {
        await setUserProtocols(
          protocols.map((p) => (p.id === editingId ? { ...p, name: draftName.trim(), exercises } : p))
        );
      }
      setEditingId(null);
      await reload();
    } catch {
      setError('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmArchive(p: UserProtocol) {
    // Archiving is non-destructive in storage (protocols.ts: archived, never
    // deleted), but there's no unarchive/view-archived UI yet — a mis-tap
    // currently FEELS unrecoverable, so it gets the same confirm-before-act
    // treatment as the codebase's other destructive-feeling actions
    // (SwipeToDelete's Alert.alert pattern).
    Alert.alert(`Archive "${p.name}"?`, 'It leaves this list. Your history stays intact.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await setUserProtocols(
            protocols.map((row) => (row.id === p.id ? { ...row, archivedAt: new Date().toISOString() } : row))
          );
          setEditingId(null);
          reload();
        },
      },
    ]);
  }

  if (editingId != null) {
    return (
      <Screen scroll>
        <Text variant="displayLg">{editingId === 'new' ? 'New plan' : 'Edit plan'}</Text>
        <Field
          label="Name"
          value={draftName}
          onChangeText={setDraftName}
          placeholder="e.g. Knee routine from Sarah"
          keyboardType="default"
          style={{ marginTop: theme.spacing[6] }}
        />

        <Text variant="label" style={{ marginTop: theme.spacing[6], marginBottom: theme.spacing[2] }}>
          Exercises
        </Text>
        <View style={{ gap: theme.spacing[3] }}>
          {draftExercises.map((ex) => (
            <View key={ex.id} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] }}>
              <Field
                label="Exercise"
                value={ex.name}
                onChangeText={(name) => mutateDraftExercise(ex.id, { name })}
                placeholder="e.g. clamshells 3x15 each side"
                keyboardType="default"
                style={{ flex: 1 }}
              />
              <Field
                label="×/week"
                value={ex.targetPerWeek}
                onChangeText={(targetPerWeek) => mutateDraftExercise(ex.id, { targetPerWeek })}
                placeholder="3"
                keyboardType="number-pad"
                style={{ width: 64 }}
              />
              <RemoveButton label="Remove exercise" onPress={() => removeDraftExercise(ex.id)} />
            </View>
          ))}
        </View>
        <Button
          label="+ Add exercise"
          variant="secondary"
          onPress={addDraftExercise}
          style={{ marginTop: theme.spacing[3] }}
        />

        {error ? (
          <Text variant="bodySm" color={theme.colors.negative} style={{ marginTop: theme.spacing[4] }}>
            {error}
          </Text>
        ) : null}

        <View style={{ height: theme.spacing[8] }} />
        <Button label="Save plan" onPress={saveDraft} loading={saving} />
        <View style={{ height: theme.spacing[3] }} />
        {editingId !== 'new' ? (
          <>
            <Button
              label="Archive plan"
              variant="outline"
              onPress={() => {
                const p = protocols.find((row) => row.id === editingId);
                if (p) confirmArchive(p);
              }}
            />
            <View style={{ height: theme.spacing[3] }} />
          </>
        ) : null}
        <Button label="Cancel" variant="ghost" onPress={() => setEditingId(null)} />
        <View style={{ height: theme.spacing[6] }} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="displayLg">Plans</Text>
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        Your own home-exercise plan, in your own words — this app is the notebook, not the
        clinician. Nothing here is suggested or generated.
      </Text>

      {loading ? null : activeProtocols(protocols).length > 0 ? (
        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[4] }}>
          {activeProtocols(protocols).map((p) => {
            const status = protocolAdherenceStatus(p, weekTicks[p.id] ?? {});
            return (
              <Card key={p.id} style={{ gap: theme.spacing[3] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="label" color={theme.colors.sandstone}>
                    {p.name}
                  </Text>
                  <Text variant="dataSm" color={theme.colors.textMuted}>
                    {behaviorLine(status)}
                  </Text>
                </View>
                {p.exercises.map((ex) => {
                  const ticked = todayTicked.has(`${p.id}::${ex.id}`);
                  return (
                    <View
                      key={ex.id}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text variant="body">
                        {ex.name} · {ex.targetPerWeek}×/wk
                      </Text>
                      <Button
                        label={ticked ? 'Done today ✓' : 'Mark done'}
                        variant={ticked ? 'primary' : 'secondary'}
                        size="sm"
                        disabled={togglingKey === `${p.id}::${ex.id}`}
                        onPress={() => onToggle(p.id, ex.id)}
                      />
                    </View>
                  );
                })}
                <Button label="Edit plan" variant="outline" onPress={() => startEdit(p)} />
              </Card>
            );
          })}
        </View>
      ) : (
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            No plans yet.
          </Text>
        </Card>
      )}

      <View style={{ height: theme.spacing[6] }} />
      <Button label="+ New plan" onPress={startNew} />
      <View style={{ height: theme.spacing[3] }} />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
