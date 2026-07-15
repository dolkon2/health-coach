/**
 * Social — the fifth tab (social-tab.md). This is S0: a quiet placeholder that
 * ships with the shell so the five-tab layout is real from day one, while the
 * feed + groups themselves (Ring 4, backend era) come later.
 *
 * Deliberately inert per ⚑2: one calm sentence describing what Social will be,
 * and nothing else — no waitlist, no "coming soon" hype, no notify-me toggle,
 * no counts. The tab exists; it makes no promises it can't keep and asks for
 * nothing.
 */
import { View } from 'react-native';
import { Users } from 'lucide-react-native';
import { Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export default function SocialScreen() {
  const theme = useTheme();
  return (
    <Screen headerTransparent>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing[4],
          paddingHorizontal: theme.spacing[6],
        }}
      >
        <Users size={40} color={theme.colors.textMuted} strokeWidth={1.5} />
        <Text
          variant="body"
          color={theme.colors.textSecondary}
          style={{ textAlign: 'center' }}
        >
          A feed of friends' shared logbook entries, and groups for planning
          things together.
        </Text>
      </View>
    </Screen>
  );
}
