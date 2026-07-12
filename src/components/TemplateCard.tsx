/**
 * TemplateCard — the card for a saved SessionTemplate (rework Session 4,
 * training-tab.md § 3 B: "shared 3a/3b skeleton"). Title, activity icon
 * tinted by the template's element, a descriptive shape line, and a
 * "repeats <Day>" recurrence chip when the template has an active day
 * assignment. The Training tab's inline library section is its only caller
 * (the standalone /templates screen it was factored out of is gone — its
 * job is fully absorbed by Training's inline library now).
 *
 * No "last done" line yet — that needs a templateId backlink on logged
 * Observations, which training-tab.md marks as unbuilt (Pass 3/placement).
 */
import { View, Pressable } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { Card } from './Card';
import { iconFor } from './activityIcons';
import { activityById, elementOf } from '@/lib/activity';
import { describeTemplateShape } from '@/lib/describeTemplateShape';
import { DAYS_OF_WEEK } from '@/lib/sessionFormOptions';
import type { SessionTemplate } from '@core/sessionTemplate';

type TemplateCardProps = {
  template: SessionTemplate;
  onPress: () => void;
};

export function TemplateCard({ template, onPress }: TemplateCardProps) {
  const theme = useTheme();
  const activity = activityById(template.activity);
  const element = activity ? elementOf(activity) : 'body';
  const tint = theme.colors.element[element];
  const Icon = iconFor(activity?.icon ?? 'gym');
  const repeatsDay =
    template.isActive && template.dayAssignment != null
      ? DAYS_OF_WEEK.find((d) => d.value === template.dayAssignment)?.label
      : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${template.name}`}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
          <Icon size={20} color={tint} strokeWidth={1.5} />
          <View style={{ flex: 1, gap: theme.spacing[1] }}>
            <Text variant="body">{template.name}</Text>
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {activity?.label ?? template.activity} · {describeTemplateShape(template)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: theme.spacing[1] }}>
            {repeatsDay ? (
              <View
                style={{
                  paddingVertical: theme.spacing[1],
                  paddingHorizontal: theme.spacing[2],
                  borderRadius: theme.radius.full,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Text variant="label" color={theme.colors.textMuted}>
                  repeats {repeatsDay}
                </Text>
              </View>
            ) : null}
            {!template.isActive ? (
              <Text variant="dataSm" color={theme.colors.textMuted}>
                paused
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
