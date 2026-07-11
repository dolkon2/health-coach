/**
 * Templates — the library of saved training shapes (Phase 6 Pass 1).
 *
 * Reached from the Training tab. Lists every SessionTemplate the user has
 * created; tap a row to edit, swipe to delete. The header "+ New" pushes
 * /edit-template with no id (fresh create).
 *
 * Ships empty by design — constitution: no app-provided programs or starter
 * packs. The empty state describes what the screen is for, not what to do
 * next.
 *
 * Pass 1 doesn't *use* templates anywhere else yet. Pass 2 (week view) and
 * Pass 3 (placement → tap-to-log) wire them into the planning surface.
 */
import { useCallback, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Screen, Text, Card, Button, SwipeToDelete } from '@/components';
import { useTheme } from '@/theme';
import { listTemplates, deleteTemplate } from '@/storage/sessionTemplates';
import { activityById } from '@/lib/activity';
import { DAYS_OF_WEEK } from '@/lib/sessionFormOptions';
import type {
  SessionTemplate,
  GymTemplateShape,
  GpsTemplateShape,
  PracticeTemplateShape,
  ClimbingTemplateShape,
  SwimTemplateShape,
} from '@core/sessionTemplate';

export default function TemplatesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [templates, setTemplates] = useState<SessionTemplate[] | null>(null);

  const reload = useCallback(async () => {
    const list = await listTemplates();
    setTemplates(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteTemplate(id);
      reload();
    },
    [reload]
  );

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="label" color={theme.colors.accent}>
            Library
          </Text>
          <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
            Saved shapes
          </Text>
        </View>
        <Button
          label="+ New"
          variant="secondary"
          onPress={() => router.push('/edit-template')}
        />
      </View>

      <Text
        variant="bodySm"
        color={theme.colors.textMuted}
        style={{ marginTop: theme.spacing[3] }}
      >
        Shapes you've named — a Push Day, a Park run, a practice. Edit any time.
        Tap to view, swipe to delete.
      </Text>

      <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[3] }}>
        {templates === null ? null : templates.length === 0 ? (
          <Card>
            <Text variant="body" color={theme.colors.textMuted}>
              No templates yet. Tap "+ New" to save your first one.
            </Text>
          </Card>
        ) : (
          templates.map((t) => (
            <SwipeToDelete
              key={t.id}
              onDelete={() => remove(t.id)}
              confirmTitle="Delete template?"
              confirmMessage={`${t.name} — permanent.`}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/edit-template',
                    params: { templateId: t.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Edit ${t.name}`}
              >
                <TemplateRow template={t} />
              </Pressable>
            </SwipeToDelete>
          ))
        )}
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

function TemplateRow({ template }: { template: SessionTemplate }) {
  const theme = useTheme();
  const activity = activityById(template.activity);
  const day =
    template.dayAssignment != null
      ? DAYS_OF_WEEK.find((d) => d.value === template.dayAssignment)?.label
      : null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: theme.spacing[1] }}>
          <Text variant="body">{template.name}</Text>
          <Text variant="bodySm" color={theme.colors.textMuted}>
            {activity?.label ?? template.activity} · {describeShape(template)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: theme.spacing[1] }}>
          {day ? (
            <Text variant="label" color={theme.colors.textMuted}>
              {day}
            </Text>
          ) : null}
          {!template.isActive ? (
            <Text variant="dataSm" color={theme.colors.textMuted}>
              paused
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/** A one-line, descriptive (never prescriptive) summary of the template's shape. */
function describeShape(t: SessionTemplate): string {
  switch (t.shape.surface) {
    case 'gym': {
      const s = t.shape as GymTemplateShape;
      const n = s.exercises.length;
      return n === 1 ? '1 exercise' : `${n} exercises`;
    }
    case 'gps': {
      const s = t.shape as GpsTemplateShape;
      if (s.targetDistanceM != null) {
        const km = (s.targetDistanceM / 1000).toFixed(s.targetDistanceM % 1000 === 0 ? 0 : 1);
        return `${km} km · ${s.energySystem}`;
      }
      return s.energySystem;
    }
    case 'practice': {
      const s = t.shape as PracticeTemplateShape;
      const parts = [s.targetDurationMin != null ? `${s.targetDurationMin} min` : null, s.style];
      return parts.filter(Boolean).join(' · ') || 'practice';
    }
    case 'climbing': {
      const s = t.shape as ClimbingTemplateShape;
      const parts = [s.style, s.targetGradeRange, s.targetSends != null ? `${s.targetSends} sends` : null];
      return parts.filter(Boolean).join(' · ');
    }
    case 'swim': {
      const s = t.shape as SwimTemplateShape;
      if (s.mode === 'pool' && s.poolLengthM != null && s.targetLaps != null) {
        return `${s.targetLaps} × ${s.poolLengthM} m`;
      }
      if (s.targetDistanceM != null) {
        return `${s.targetDistanceM} m`;
      }
      return s.mode;
    }
  }
}
