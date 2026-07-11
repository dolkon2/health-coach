/**
 * GymExerciseEditor — one exercise row in a gym log session.
 *
 * Extracted from app/log-session.tsx (Phase 6 Pass 1) so the gym set logger is
 * one component, not duplicated when the template editor wants its own gym
 * shape. Templates do NOT use this component directly — they use the bare
 * GymExerciseTargets editor (separate, see app/edit-template.tsx) because the
 * data shape differs: a template carries target sets/reps/weight per exercise,
 * not a live set list with timestamps + RIR + warmup flags.
 *
 * What lives here: the per-exercise name field with a library/ladder picker
 * (Body P3 — autocomplete over exercisePicker.ts's datasets), the required
 * movement-pattern picker, a reps/hold entry-mode toggle, and the set table
 * (weight/reps-or-hold/RIR/warmup/done). Ghost placeholders show the last
 * time this exercise was logged (Strong-style) — placeholder text only,
 * never prefilled into the draft. The suggestion SEARCH runs here (not in
 * the parent's exercise map) and is memoized on name/exerciseId, so typing
 * in one exercise row never re-scans the ~800-row picker dataset for every
 * OTHER exercise row on the screen. The rest timer + the per-set completion
 * timestamp belong to the parent screen — it owns the timer hook and decides
 * when to stamp completedAt. This component just calls back via onCompleteSet.
 */
import { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { Text, Card, Field, ChipSelect } from '@/components';
import { useTheme } from '@/theme';
import { PATTERNS } from '@/lib/sessionFormOptions';
import type { ExerciseDraft, SetDraft } from '@/lib/session';
import { searchExercises, type PickerEntry } from '@/lib/exercisePicker';
import type { MovementPattern } from '@core/observation';

const ENTRY_TYPES = [
  { value: 'reps' as const, label: 'Reps' },
  { value: 'duration' as const, label: 'Hold' },
];

export type GymExerciseEditorProps = {
  exercise: ExerciseDraft;
  onName: (name: string) => void;
  onPattern: (p: MovementPattern) => void;
  onSet: (setId: string, fn: (s: SetDraft) => SetDraft) => void;
  onCompleteSet: (setId: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
  /** The picker dataset for the current activity (memoized once by the parent). */
  pickerEntries?: PickerEntry[];
  onPick?: (entry: PickerEntry) => void;
  onEntryType?: (t: 'reps' | 'duration') => void;
  /** Last session's sets for this exercise, as display-ready placeholder strings. */
  ghosts?: Array<{ weight: string; reps: string; holdSec: string; rir: string }>;
};

export function GymExerciseEditor({
  exercise,
  onName,
  onPattern,
  onSet,
  onCompleteSet,
  onAddSet,
  onRemoveSet,
  onRemove,
  pickerEntries = [],
  onPick,
  onEntryType,
  ghosts = [],
}: GymExerciseEditorProps) {
  const theme = useTheme();
  const canRemoveSet = exercise.sets.length > 1; // always keep one row so the table isn't empty
  const isHold = exercise.entryType === 'duration';
  // Only re-scans the dataset when THIS row's name/pick state actually
  // changes — not on every keystroke in a sibling exercise's set fields.
  const suggestions = useMemo(
    () => (exercise.exerciseId ? [] : searchExercises(pickerEntries, exercise.name)),
    [pickerEntries, exercise.exerciseId, exercise.name]
  );
  return (
    <Card raised style={{ gap: theme.spacing[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[3] }}>
        <Field
          label="Exercise"
          value={exercise.name}
          onChangeText={onName}
          placeholder="e.g. barbell back squat"
          keyboardType="default"
          style={{ flex: 1 }}
        />
        <RemoveButton label="Remove exercise" onPress={onRemove} />
      </View>
      {suggestions.length > 0 ? (
        <View style={{ gap: theme.spacing[1] }}>
          {suggestions.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => onPick?.(entry)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${entry.name}`}
              style={{ paddingVertical: theme.spacing[1] }}
            >
              <Text variant="dataSm" color={theme.colors.accent}>
                {entry.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Movement pattern (required)</Text>
        <ChipSelect options={PATTERNS} value={exercise.movementPattern} onChange={onPattern} />
      </View>
      <View style={{ gap: theme.spacing[2] }}>
        <Text variant="label">Entry</Text>
        <ChipSelect
          options={ENTRY_TYPES}
          value={exercise.entryType ?? 'reps'}
          onChange={(t) => onEntryType?.(t)}
        />
      </View>

      {/* Sets table — trailing column reserved for the per-row remove control */}
      <View style={{ gap: theme.spacing[2] }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
          <Text variant="label" style={{ flex: 1 }}>
            Weight
          </Text>
          <Text variant="label" style={{ width: 56 }}>
            {isHold ? 'Hold s' : 'Reps'}
          </Text>
          <Text variant="label" style={{ width: 48 }}>
            RIR
          </Text>
          <Text variant="label" style={{ width: 44 }}>
            Warm
          </Text>
          <Text variant="label" style={{ width: 32 }}>
            Done
          </Text>
          <View style={{ width: 24 }} />
        </View>
        {exercise.sets.map((s, i) => {
          const ghost = ghosts[i];
          return (
            <View
              key={s.id}
              style={{ flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-end' }}
            >
              <Field
                value={s.weight}
                onChangeText={(weight) => onSet(s.id, (prev) => ({ ...prev, weight }))}
                placeholder={ghost?.weight || '0'}
                style={{ flex: 1 }}
              />
              {isHold ? (
                <Field
                  value={s.holdSec}
                  onChangeText={(holdSec) => onSet(s.id, (prev) => ({ ...prev, holdSec }))}
                  placeholder={ghost?.holdSec || '0'}
                  keyboardType="number-pad"
                  style={{ width: 56 }}
                />
              ) : (
                <Field
                  value={s.reps}
                  onChangeText={(reps) => onSet(s.id, (prev) => ({ ...prev, reps }))}
                  placeholder={ghost?.reps || '0'}
                  keyboardType="number-pad"
                  style={{ width: 56 }}
                />
              )}
              <Field
                value={s.rir}
                onChangeText={(rir) => onSet(s.id, (prev) => ({ ...prev, rir }))}
                placeholder={ghost?.rir || '—'}
                keyboardType="number-pad"
                style={{ width: 48 }}
              />
              <View style={{ width: 44, alignItems: 'center', paddingBottom: theme.spacing[2] }}>
                <Checkbox
                  checked={s.isWarmup}
                  onToggle={() =>
                    onSet(s.id, (prev) => ({ ...prev, isWarmup: !prev.isWarmup }))
                  }
                />
              </View>
              <View style={{ width: 32, alignItems: 'center', paddingBottom: theme.spacing[2] }}>
                <SetDoneButton done={!!s.completedAt} onPress={() => onCompleteSet(s.id)} />
              </View>
              <View style={{ width: 24, alignItems: 'center', paddingBottom: theme.spacing[2] }}>
                {canRemoveSet ? (
                  <RemoveButton label="Remove set" onPress={() => onRemoveSet(s.id)} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <AddSetLink onPress={onAddSet} />
    </Card>
  );
}

function AddSetLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add set"
      hitSlop={8}
      style={{ alignSelf: 'flex-start', paddingVertical: theme.spacing[1] }}
    >
      <Text variant="label" color={theme.colors.accent}>
        + Add set
      </Text>
    </Pressable>
  );
}

/** Small ✕ button for inline-remove actions; matches the prior local component. */
export function RemoveButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Remove'}
      hitSlop={8}
      style={{ paddingHorizontal: theme.spacing[1], paddingBottom: theme.spacing[2] }}
    >
      <Text variant="dataSm" color={theme.colors.textMuted}>
        ✕
      </Text>
    </Pressable>
  );
}

/** Per-set "done" toggle — stamps completedAt via the parent's callback. */
function SetDoneButton({ done, onPress }: { done: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={done ? 'Mark set not done' : 'Mark set done'}
      accessibilityState={{ checked: done }}
      hitSlop={8}
      style={{
        width: 26,
        height: 26,
        borderRadius: theme.radius.sm,
        borderWidth: 1.5,
        borderColor: done ? theme.colors.accent : theme.colors.borderStrong,
        backgroundColor: done ? theme.colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="dataSm" color={done ? theme.colors.bg : theme.colors.textMuted}>
        ✓
      </Text>
    </Pressable>
  );
}

/** Inline checkbox used by both warmup toggles and climbing "sent" markers. */
export function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: theme.radius.sm,
          borderWidth: 1.5,
          borderColor: checked ? theme.colors.accent : theme.colors.borderStrong,
          backgroundColor: checked ? theme.colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text variant="dataSm" color={theme.colors.bg}>
            ✓
          </Text>
        ) : null}
      </View>
      {label ? <Text variant="label">{label}</Text> : null}
    </Pressable>
  );
}
