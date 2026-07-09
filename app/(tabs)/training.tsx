/**
 * Training — the third tab (Phase 4, Pass 1).
 *
 * Two jobs: the activity picker (the identity layer of the three-layer model —
 * the user's headline activities one tap away, the rest under "More") and the
 * session history feed below it. Tapping an activity opens the logger; the
 * registry (lib/activity.ts) maps that identity to the engine modality the logger
 * seeds from. Today keeps its own quick-log shortcut for unplanned sessions — this
 * tab is the primary, identity-first entry plus the history of what's been logged.
 * It is NOT a planning surface (that's Phase 6).
 */
import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Dumbbell,
  Footprints,
  Bike,
  Mountain,
  Waves,
  Wind,
  Snowflake,
  Flower2,
  Backpack,
  HeartPulse,
  Activity as ActivityIcon,
} from 'lucide-react-native';
import { Screen, Text, Card, SessionCard, SwipeToDelete } from '@/components';
import { useTheme } from '@/theme';
import { reveal } from '@core/stimulus';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { deleteObservation } from '@/storage/observations';
import { deleteHealthKitExport } from '@/lib/healthkit/writer';
import {
  elementSections,
  moreDeprioritizedActivities,
  reviewPendingActivities,
  snowSportActivities,
  type Activity,
} from '@/lib/activity';

type IconCmp = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Registry `icon` names → lucide components, resolved here so lib/activity.ts
// stays platform-free. Unknown names fall back to a generic mark.
const ICONS: Record<string, IconCmp> = {
  dumbbell: Dumbbell,
  footprints: Footprints,
  bike: Bike,
  mountain: Mountain,
  waves: Waves,
  wind: Wind,
  snowflake: Snowflake,
  flower: Flower2,
  backpack: Backpack,
  'heart-pulse': HeartPulse,
};

export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { sessions, reload } = useSessionHistory();
  const [showSnow, setShowSnow] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showReview, setShowReview] = useState(false);

  // Re-fetch whenever the tab regains focus — after the logger saves or a delete.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  // The engine's "what this contributed" line per session (same source as Today).
  const contributions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of sessions) out[s.id] = reveal(s);
    return out;
  }, [sessions]);

  const removeAndReload = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      // Fire-and-forget: propagates the delete to Apple Health if this
      // session was ever exported; never blocks the local delete.
      void deleteHealthKitExport(id).catch(() => {});
      reload();
    },
    [reload]
  );

  function logActivity(a: Activity) {
    // Hand the logger the chosen identity; it resolves the surface from the registry
    // and stores the activity on the session. Swim/practice open a "coming next"
    // stub (still a duration log) until their surfaces land (Passes 5–6).
    router.push({ pathname: '/log-session', params: { activity: a.id } });
  }

  // Body → Earth → Water → Sky (replaces the old headline/"More" flat
  // outdoor grouping), plus two closeable trays carved out of Earth/Water
  // (Snow Sports, More) and the pending-delete Review tail (2026-07-09).
  const sections = elementSections();
  const snowSports = snowSportActivities();
  const moreActivitiesList = moreDeprioritizedActivities();
  const reviewPending = reviewPendingActivities();

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text variant="label" color={theme.colors.sandstone}>
          Training
        </Text>
        <View style={{ alignItems: 'flex-end', gap: theme.spacing[1] }}>
          <Pressable
            onPress={() => router.push('/benchmarks')}
            accessibilityRole="button"
            accessibilityLabel="Open benchmarks"
            hitSlop={8}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Benchmarks →
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/templates')}
            accessibilityRole="button"
            accessibilityLabel="Open template library"
            hitSlop={8}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Library →
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/training-progress')}
            accessibilityRole="button"
            accessibilityLabel="Open training progress"
            hitSlop={8}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Progress →
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/import-csv')}
            accessibilityRole="button"
            accessibilityLabel="Import training history"
            hitSlop={8}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Import →
            </Text>
          </Pressable>
        </View>
      </View>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        Log a session
      </Text>

      {/* Activity picker — one section per element, fixed order */}
      {sections.map((section) =>
        section.activities.length > 0 ? (
          <View key={section.element}>
            <Text variant="label" style={{ marginTop: theme.spacing[6] }}>
              {section.title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing[3],
                marginTop: theme.spacing[3],
              }}
            >
              {section.activities.map((a) => (
                <ActivityTile key={a.id} activity={a} onPress={() => logActivity(a)} />
              ))}
            </View>
          </View>
        ) : null
      )}

      {/* Snow Sports — carved out of Earth's flat list into its own closeable
          tray (Dylan, 2026-07-09): Ski, Snowboard, XC Ski, Snowshoe, Ski-touring. */}
      <CollapsibleTray
        title="Snow Sports"
        activities={snowSports}
        expanded={showSnow}
        onToggle={() => setShowSnow((v) => !v)}
        onLogActivity={logActivity}
      />

      {/* More — Ruck and Sail, decluttered from Earth/Water's main lists but
          still fully loggable and dimension-built (Dylan, 2026-07-09). NOT a
          delete-review tray — unlike Review below, nothing here is queued
          for removal. */}
      <CollapsibleTray
        title="More"
        activities={moreActivitiesList}
        expanded={showMore}
        onToggle={() => setShowMore((v) => !v)}
        onLogActivity={logActivity}
      />

      {/* Pending-delete review (2026-07-09 prune): activities not in the
          Training Database and untouched by the dimension builds. Collapsed
          by default; they can still be logged from here until the delete is
          confirmed — nothing is removed silently. */}
      <CollapsibleTray
        title="Review — pending removal"
        caption="Not in the Training Database — queued for deletion once you confirm."
        activities={reviewPending}
        expanded={showReview}
        onToggle={() => setShowReview((v) => !v)}
        onLogActivity={logActivity}
      />

      {/* History */}
      <Text
        variant="label"
        style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}
      >
        History
      </Text>
      {sessions.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          {sessions.map((session) => (
            <SwipeToDelete
              key={session.id}
              onDelete={() => removeAndReload(session.id)}
              confirmTitle="Delete session?"
              confirmMessage={`${session.payload.modality} — permanent.`}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/log-session',
                    params: { editId: session.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Edit ${session.payload.modality} session`}
              >
                <SessionCard session={session} contribution={contributions[session.id]} />
              </Pressable>
            </SwipeToDelete>
          ))}
        </View>
      ) : (
        <Card>
          <Text variant="body" color={theme.colors.textMuted}>
            No sessions logged yet.
          </Text>
        </Card>
      )}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

/**
 * A closeable activity tray — a toggle line plus, when expanded, an optional
 * caption and the tile grid. Backs Snow Sports / More / Review on the
 * Training tab (2026-07-09); renders nothing when there's nothing to show.
 */
function CollapsibleTray({
  title,
  caption,
  activities,
  expanded,
  onToggle,
  onLogActivity,
}: {
  title: string;
  caption?: string;
  activities: Activity[];
  expanded: boolean;
  onToggle: () => void;
  onLogActivity: (a: Activity) => void;
}) {
  const theme = useTheme();
  if (activities.length === 0) return null;
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Hide ${title}` : `Show ${title}`}
        style={{ marginTop: theme.spacing[6] }}
      >
        <Text variant="label" color={theme.colors.textMuted}>
          {title} {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>
      {expanded ? (
        <>
          {caption ? (
            <Text
              variant="bodySm"
              color={theme.colors.textMuted}
              style={{ marginTop: theme.spacing[2] }}
            >
              {caption}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing[3],
              marginTop: theme.spacing[3],
            }}
          >
            {activities.map((a) => (
              <ActivityTile key={a.id} activity={a} onPress={() => onLogActivity(a)} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function ActivityTile({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const theme = useTheme();
  const Icon = ICONS[activity.icon] ?? ActivityIcon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${activity.label}`}
      style={{
        width: '30%',
        aspectRatio: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
      }}
    >
      <Icon size={24} color={theme.colors.sandstone} strokeWidth={1.5} />
      <Text variant="label" color={theme.colors.text}>
        {activity.label}
      </Text>
    </Pressable>
  );
}
