/**
 * BenchmarkGroupSheet — create/edit a benchmark group (Phase 4 P4-3 / B4).
 *
 * Mounts from Profile's group-management module (⚑5 — interim placement,
 * Dylan's call: Profile). `groupId` is `'new'` to create, an id to edit, or
 * `null` to stay closed — the same "controlled by id" idiom
 * BenchmarkDetailSheet uses. Pause/resume applies immediately (mirrors the
 * benchmark detail sheet's own lifecycle buttons); title + membership changes
 * batch behind "Save". No celebration on resume — this is bookkeeping.
 */
import { useEffect, useState } from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';
import { Field } from './Field';
import { Checkbox } from './surface/GymExerciseEditor';
import { uuidv7 } from '@/lib/id';
import {
  createBenchmarkGroup,
  getBenchmarkGroupById,
  updateBenchmarkGroup,
  deleteBenchmarkGroup,
  listGroupMemberIds,
  addBenchmarkToGroup,
  removeBenchmarkFromGroup,
} from '@/storage/benchmarkGroups';
import type { Benchmark } from '@core/benchmark';

type BenchmarkGroupSheetProps = {
  groupId: string | 'new' | null;
  /** Active benchmarks offered as members — Profile already loads these. */
  benchmarks: Benchmark[];
  onClose: () => void;
  onChanged: () => void;
};

export function BenchmarkGroupSheet({
  groupId,
  benchmarks,
  onClose,
  onChanged,
}: BenchmarkGroupSheetProps) {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [paused, setPaused] = useState(false);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = groupId != null;
  const creating = groupId === 'new';

  useEffect(() => {
    if (!visible) return;
    if (creating) {
      setTitle('');
      setPaused(false);
      setMemberIds(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [group, memberIdList] = await Promise.all([
        getBenchmarkGroupById(groupId),
        listGroupMemberIds(groupId),
      ]);
      if (cancelled) return;
      setTitle(group?.title ?? '');
      setPaused(group?.paused ?? false);
      setMemberIds(new Set(memberIdList));
    })()
      .catch(() => {
        if (!cancelled) {
          setTitle('');
          setPaused(false);
          setMemberIds(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // groupId alone determines what to load; creating/visible derive from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  function toggleMember(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function togglePaused() {
    if (creating || saving) {
      // Not yet persisted — just flip the local flag, Save writes it.
      setPaused((p) => !p);
      return;
    }
    setSaving(true);
    try {
      const next = !paused;
      await updateBenchmarkGroup(groupId as string, { paused: next });
      setPaused(next);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (creating) {
        const id = uuidv7();
        await createBenchmarkGroup({
          id,
          createdAt: new Date().toISOString(),
          title: trimmed,
          paused,
        });
        await Promise.all([...memberIds].map((bId) => addBenchmarkToGroup(id, bId)));
      } else {
        const id = groupId as string;
        await updateBenchmarkGroup(id, { title: trimmed, paused });
        const existing = new Set(await listGroupMemberIds(id));
        const toAdd = [...memberIds].filter((bId) => !existing.has(bId));
        const toRemove = [...existing].filter((bId) => !memberIds.has(bId));
        await Promise.all([
          ...toAdd.map((bId) => addBenchmarkToGroup(id, bId)),
          ...toRemove.map((bId) => removeBenchmarkFromGroup(id, bId)),
        ]);
      }
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (creating || saving) return;
    setSaving(true);
    try {
      await deleteBenchmarkGroup(groupId as string);
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '85%',
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={{ height: 120 }} />
          ) : (
            <>
              <Text variant="label" color={theme.colors.textMuted}>
                {creating ? 'New group' : 'Edit group'}
              </Text>
              <Field
                value={title}
                onChangeText={setTitle}
                placeholder="Group name"
                keyboardType="default"
                style={{ marginTop: theme.spacing[3] }}
              />

              <Text
                variant="bodySm"
                color={theme.colors.textMuted}
                style={{ marginTop: theme.spacing[4] }}
              >
                {benchmarks.length === 0
                  ? 'No active benchmarks to add yet.'
                  : 'Members — paused groups drop these from Home and Reflect, without changing any of their own status.'}
              </Text>
              <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[2] }}>
                {benchmarks.map((b) => (
                  <Checkbox
                    key={b.id}
                    checked={memberIds.has(b.id)}
                    onToggle={() => toggleMember(b.id)}
                    label={b.title}
                  />
                ))}
              </View>

              <View style={{ marginTop: theme.spacing[8], gap: theme.spacing[2] }}>
                <Button
                  label={paused ? 'Resume' : 'Pause'}
                  variant="secondary"
                  onPress={togglePaused}
                  loading={saving}
                />
                <Button label="Save" variant="ghost" onPress={save} loading={saving} />
                {!creating ? (
                  <Button
                    label="Delete group"
                    variant="ghost"
                    onPress={remove}
                    loading={saving}
                  />
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
