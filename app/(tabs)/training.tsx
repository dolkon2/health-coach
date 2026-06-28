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
  Activity as ActivityIcon,
} from 'lucide-react-native';
import { Screen, Text, Card, SessionCard, SwipeToDelete } from '@/components';
import { useTheme } from '@/theme';
import { reveal } from '@core/stimulus';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { deleteObservation } from '@/storage/observations';
import { headlineActivities, moreActivities, type Activity } from '@/lib/activity';

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
};

export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { sessions, reload } = useSessionHistory();
  const [showMore, setShowMore] = useState(false);

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
      reload();
    },
    [reload]
  );

  function logActivity(a: Activity) {
    // Pass 1 routing: hand the logger the engine modality. It seeds the matching
    // form when it recognises one; surfaces without a form yet (swim, practice)
    // fall back to the logger's own picker. Identity-on-the-record lands in Pass 2.
    router.push({ pathname: '/log-session', params: { modality: a.modality } });
  }

  const headline = headlineActivities();
  const more = moreActivities();

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        Training
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        Log a session
      </Text>

      {/* Activity picker — headline row */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing[3],
          marginTop: theme.spacing[6],
        }}
      >
        {headline.map((a) => (
          <ActivityTile key={a.id} activity={a} onPress={() => logActivity(a)} />
        ))}
      </View>

      {/* Long tail */}
      <Pressable
        onPress={() => setShowMore((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={showMore ? 'Show fewer activities' : 'Show more activities'}
        style={{ marginTop: theme.spacing[4] }}
      >
        <Text variant="label" color={theme.colors.textMuted}>
          {showMore ? 'Less ▲' : 'More ▼'}
        </Text>
      </Pressable>
      {showMore ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing[3],
            marginTop: theme.spacing[3],
          }}
        >
          {more.map((a) => (
            <ActivityTile key={a.id} activity={a} onPress={() => logActivity(a)} />
          ))}
        </View>
      ) : null}

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
