/**
 * SwipeToDelete — swipe a row left to reveal a Delete action. Tapping it
 * confirms via the platform alert (no undo by design — Pass 6 contract), then
 * runs `onDelete`. Closes the swipe on cancel.
 *
 * The destructive surface uses theme.colors.negative (a muted clay, not bright
 * red) so it sits inside the brand palette instead of shouting.
 *
 * Built on react-native-gesture-handler's ReanimatedSwipeable so the gesture
 * feels native and the row springs back / snaps open the way iOS users expect.
 */
import React, { useRef } from 'react';
import { Alert, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Text } from './Text';
import { useTheme } from '@/theme';

type SwipeToDeleteProps = {
  children: React.ReactNode;
  onDelete: () => void | Promise<void>;
  confirmTitle?: string;
  confirmMessage?: string;
  style?: StyleProp<ViewStyle>;
};

const ACTION_WIDTH = 88;

export function SwipeToDelete({
  children,
  onDelete,
  confirmTitle = 'Delete?',
  confirmMessage = 'This is permanent.',
  style,
}: SwipeToDeleteProps) {
  const theme = useTheme();
  const ref = useRef<SwipeableMethods>(null);

  function ask() {
    Alert.alert(confirmTitle, confirmMessage, [
      { text: 'Cancel', style: 'cancel', onPress: () => ref.current?.close() },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await onDelete();
        },
      },
    ]);
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={32}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={ask}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          style={{
            width: ACTION_WIDTH,
            backgroundColor: theme.colors.negative,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: theme.radius.md,
            marginLeft: theme.spacing[2],
          }}
        >
          <Text variant="label" color={theme.colors.bg}>
            Delete
          </Text>
        </Pressable>
      )}
    >
      <View style={style}>{children}</View>
    </ReanimatedSwipeable>
  );
}
