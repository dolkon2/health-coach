/**
 * Profile — the identity + history surface (planning/rework/tabs/profile-settings.md).
 * This is the P1 stub: the persistent top-right avatar pushes here from every tab.
 *
 * What ships now: the identity header (avatar, name, blurb, element-identity
 * strip — mechanics only, locked #13) and an absent-not-empty placeholder where
 * the logbook will live. What does NOT ship here yet, by design:
 *   - Editing name/blurb/element identity and module removability — P5.
 *   - The real logbook (chronological list + calendar) — P2, which also
 *     unblocks Training's history relocation (T4).
 *   - Gear Quiver module, current-benchmarks card, Reflect tap-in — P5/P8.
 *
 * Constitution: Profile renders only things that exist in the world — no badge,
 * rank, score, streak-as-identity, or completion meter. No setup wizard; the
 * name/blurb affordances are a quiet pull, never a guilt-tripped empty state.
 * No identity fields are stored yet (that's P5's KV work) — the stub reads
 * nothing and fabricates nothing.
 */
import { View } from 'react-native';
import { User } from 'lucide-react-native';
import { Screen, Text, Card, DimensionTag } from '@/components';
import { useTheme } from '@/theme';
import { ELEMENT_ORDER } from '@/lib/activity';

export default function ProfileScreen() {
  const theme = useTheme();

  return (
    <Screen scroll>
      {/* ── Identity header ──────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', gap: theme.spacing[3], marginTop: theme.spacing[2] }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <User size={40} color={theme.colors.textMuted} strokeWidth={1.5} />
        </View>
        <Text variant="displayMd">You</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Add a blurb in your profile
        </Text>
      </View>

      {/* Element-identity strip — mechanics only (locked #13): names the four
          dimensions, tinted by the element token group. Not a claim, count, or
          badge; the tags describe the framework, not an achievement. */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing[2],
          marginTop: theme.spacing[4],
        }}
      >
        {ELEMENT_ORDER.map((element) => (
          <DimensionTag key={element} element={element} />
        ))}
      </View>

      {/* ── Logbook (placeholder) ────────────────────────────────────────── */}
      <View style={{ marginTop: theme.spacing[10] }}>
        <Text variant="label" color={theme.colors.textMuted}>
          Logbook
        </Text>
        <Card style={{ marginTop: theme.spacing[2] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            Your training history will live here — every session, across all four
            dimensions, chronological and on a calendar.
          </Text>
        </Card>
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
