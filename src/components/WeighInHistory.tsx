/**
 * WeighInHistory — the edit/delete surface for logged weigh-ins, on
 * Nutrition/Trend. The chart (WeightTrendChart) is read-only by design; this
 * is the list that gives a fat-fingered or duplicate weigh-in a real
 * correction path — tap a row to edit (routes to `log-weigh-in?editId=…`,
 * which already supports edit mode), swipe to delete. Mirrors the
 * SwipeToDelete + edit-route idiom Training's session history and
 * DayMealList already use.
 *
 * Shows the most recent entries only (newest first) — a full log isn't the
 * point, a correction path is.
 */
import { Pressable, View } from 'react-native';
import type { ObservationOf } from '@core/observation';
import { dayKey } from '@core/timeline';
import { Card } from './Card';
import { Text } from './Text';
import { SwipeToDelete } from './SwipeToDelete';
import { useTheme } from '@/theme';
import { kgToDisplay, type WeightUnit } from '@/lib/units';
import { shortLocalDate } from '@/lib/date';
import { deleteObservation } from '@/storage/observations';

const MAX_SHOWN = 5;

type WeighInHistoryProps = {
  raw: ReadonlyArray<ObservationOf<'weighIn'>>;
  weightUnit: WeightUnit;
  onReload: () => void;
  /** Caller owns navigation (so it can track "we're entering our own edit
   *  modal" and skip any reset-on-focus behavior that would otherwise fire
   *  when the modal is dismissed). */
  onEdit: (id: string) => void;
};

export function WeighInHistory({ raw, weightUnit, onReload, onEdit }: WeighInHistoryProps) {
  const theme = useTheme();

  if (raw.length === 0) return null;

  // raw is oldest-first (useWeightTrend contract) — slice the tail before
  // reversing so a 90-day history isn't spread+reversed just to keep 5.
  const recent = raw.slice(-MAX_SHOWN).reverse();

  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label">Recent weigh-ins</Text>
      <View style={{ gap: theme.spacing[2] }}>
        {recent.map((o) => (
          <SwipeToDelete
            key={o.id}
            onDelete={async () => {
              await deleteObservation(o.id);
              onReload();
            }}
            confirmTitle="Delete weigh-in?"
            confirmMessage="This is permanent."
          >
            <Pressable
              onPress={() => onEdit(o.id)}
              accessibilityRole="button"
              accessibilityLabel={`Edit weigh-in from ${shortLocalDate(dayKey(o.occurredAt))}`}
            >
              <Card
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text variant="body" color={theme.colors.textSecondary}>
                  {shortLocalDate(dayKey(o.occurredAt))}
                </Text>
                <Text variant="data">
                  {kgToDisplay(o.payload.weightKg, weightUnit).toFixed(1)} {weightUnit}
                </Text>
              </Card>
            </Pressable>
          </SwipeToDelete>
        ))}
      </View>
    </View>
  );
}
