/**
 * ElementPickerSheet — Home's "Log Session" entry point (H1,
 * planning/rework/tabs/home-tab.md § 3, locked routing decision #6).
 *
 * One sheet, four element rows: Earth / Sky / Water / Body. Earth/Sky/Water
 * lead with the most-recently-used activity in that element as the primary
 * tap target (archetype fallback with no history); an inline `⌄` expands the
 * row into that element's full activity list before anything launches. Body
 * has no most-recent/archetype resolution and no expand — it always routes to
 * Training's template/session selection (never a logger directly — Body never
 * routes to Map, constitution § four dimensions).
 *
 * Interim routing (home-tab.md § 5): every Earth/Sky/Water tap opens the
 * current session logger with that activity pre-selected. This is deliberate
 * and unconditional for now — Map Record doesn't exist yet (H6), so there is
 * no dimension → Map Record split to get wrong. Non-GPS-surface activities
 * (climbing, swim) already land on the logger today; Dylan's ruling on ⚑4
 * ("indoor climbing / pool swim route by logging surface, with a 'log without
 * GPS' escape on Map") is a note for H6's implementation, not a behavior
 * change here.
 */
import { useState } from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { iconFor } from './activityIcons';
import {
  activitiesForElement,
  ELEMENT_LABELS,
  type Activity,
} from '@/lib/activity';
import {
  defaultActivityForElement,
  type MapElement,
} from '@/lib/mostRecentActivity';

const MAP_ELEMENTS: readonly MapElement[] = ['earth', 'sky', 'water'];

type ElementPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Resolved most-recent activity per Earth/Water/Sky element (empty map is fine). */
  mostRecent: Partial<Record<MapElement, Activity>>;
  onPickActivity: (activity: Activity) => void;
  onPickBody: () => void;
};

export function ElementPickerSheet({
  visible,
  onClose,
  mostRecent,
  onPickActivity,
  onPickBody,
}: ElementPickerSheetProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<MapElement | null>(null);

  function close() {
    setExpanded(null);
    onClose();
  }

  function pick(activity: Activity) {
    setExpanded(null);
    onPickActivity(activity);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={close}
        accessibilityLabel="Close"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '80%',
        }}
      >
        <Text variant="label" color={theme.colors.textSecondary} style={{ marginBottom: theme.spacing[4] }}>
          Log a session
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: theme.spacing[3] }}>
            {MAP_ELEMENTS.map((element) => (
              <ElementRow
                key={element}
                element={element}
                primary={defaultActivityForElement(element, mostRecent)}
                expanded={expanded === element}
                onToggleExpand={() => setExpanded((e) => (e === element ? null : element))}
                onPrimaryPress={(a) => pick(a)}
                onPickActivity={pick}
              />
            ))}
            <BodyRow onPress={onPickBody} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ElementRow({
  element,
  primary,
  expanded,
  onToggleExpand,
  onPrimaryPress,
  onPickActivity,
}: {
  element: MapElement;
  primary: Activity;
  expanded: boolean;
  onToggleExpand: () => void;
  onPrimaryPress: (a: Activity) => void;
  onPickActivity: (a: Activity) => void;
}) {
  const theme = useTheme();
  const tint = theme.colors.element[element];
  const Icon = iconFor(primary.icon);
  const activities = activitiesForElement(element);

  return (
    <View
      style={{
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <Pressable
          onPress={() => onPrimaryPress(primary)}
          accessibilityRole="button"
          accessibilityLabel={`Log ${primary.label} (${ELEMENT_LABELS[element]})`}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing[3],
            padding: theme.spacing[4],
          }}
        >
          <Icon size={22} color={tint} strokeWidth={1.5} />
          <View>
            <Text variant="label" color={tint}>
              {ELEMENT_LABELS[element]}
            </Text>
            <Text variant="body">{primary.label}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={expanded ? `Hide ${ELEMENT_LABELS[element]} activities` : `More ${ELEMENT_LABELS[element]} activities`}
          hitSlop={8}
          style={{ justifyContent: 'center', paddingHorizontal: theme.spacing[4] }}
        >
          {expanded ? (
            <ChevronUp size={20} color={theme.colors.textMuted} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={20} color={theme.colors.textMuted} strokeWidth={1.5} />
          )}
        </Pressable>
      </View>
      {expanded ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[2],
            padding: theme.spacing[3],
            paddingTop: 0,
          }}
        >
          {activities.map((a) => {
            const ActivityIconCmp = iconFor(a.icon);
            const isPrimary = a.id === primary.id;
            return (
              <Pressable
                key={a.id}
                onPress={() => onPickActivity(a)}
                accessibilityRole="button"
                accessibilityLabel={`Log ${a.label}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing[1],
                  paddingVertical: theme.spacing[2],
                  paddingHorizontal: theme.spacing[3],
                  borderRadius: theme.radius.full,
                  backgroundColor: isPrimary ? theme.colors.surfaceRaised : 'transparent',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <ActivityIconCmp size={14} color={theme.colors.textSecondary} strokeWidth={1.5} />
                <Text variant="label" color={theme.colors.textSecondary}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Body never routes to a logger directly — it always hands off to Training's
 *  template/session selection (locked #6; Body never uses the GPS surface). */
function BodyRow({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const tint = theme.colors.element.body;
  const Icon = iconFor('dumbbell');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Body — templates and sessions"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        padding: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Icon size={22} color={tint} strokeWidth={1.5} />
      <View>
        <Text variant="label" color={tint}>
          {ELEMENT_LABELS.body}
        </Text>
        <Text variant="body">Templates / pick…</Text>
      </View>
    </Pressable>
  );
}
