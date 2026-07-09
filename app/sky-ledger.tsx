/**
 * USHPA ledger — descriptive-only cumulative flight facts against the P3
 * (Intermediate) rating requirements. Reachable from Settings ("Sky pilot").
 *
 * DESCRIPTIVE ONLY (constitution clause 1, core/src/ushpaLedger.ts's own
 * doc): this reports what the logbook proves. It never nags, gates, or
 * implies the user should chase a rating — it's here for pilots who want to
 * see their numbers, same spirit as a paper logbook.
 */
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Text, Card } from '@/components';
import { useTheme } from '@/theme';
import { listObservations } from '@/storage/observations';
import { isKind, type ObservationOf } from '@core/observation';
import { computeUshpaLedger, ledgerAgainst, USHPA_P3, type RequirementFact } from '@core/ushpaLedger';
import { skyFlightFacts, SKY_ACTIVITY_IDS } from '@/lib/skyLedger';

function MetricRow({ label, fact }: { label: string; fact?: RequirementFact }) {
  const theme = useTheme();
  if (!fact) return null;
  const status = fact.met ? 'met' : fact.provable ? 'not yet' : 'unprovable (siteless flights)';
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant="body" color={theme.colors.textSecondary}>
        {label}
      </Text>
      <Text variant="dataSm" color={theme.colors.text}>
        {Math.round(fact.have * 10) / 10} / {fact.need} — {status}
      </Text>
    </View>
  );
}

export default function SkyLedgerScreen() {
  const theme = useTheme();
  const [sessions, setSessions] = useState<ObservationOf<'session'>[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listObservations({ kinds: ['session'] })
        .then((rows) => {
          if (cancelled) return;
          const sky = rows
            .filter((o): o is ObservationOf<'session'> => isKind(o, 'session'))
            .filter((o) => o.payload.activity != null && SKY_ACTIVITY_IDS.has(o.payload.activity));
          setSessions(sky);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const ledger = useMemo(() => computeUshpaLedger(skyFlightFacts(sessions)), [sessions]);
  const comparison = useMemo(() => ledgerAgainst(ledger, USHPA_P3), [ledger]);

  return (
    <Screen scroll>
      <Text variant="label" color={theme.colors.sandstone}>
        USHPA ledger
      </Text>
      <Text variant="displayMd" style={{ marginTop: theme.spacing[2] }}>
        Your numbers
      </Text>
      <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
        What the logbook proves — foot-launched free flight only (XC, hike & fly).
        Speedflying and parakiting sit outside USHPA scope.
      </Text>

      {loading ? null : ledger.totalFlights === 0 ? (
        <Card style={{ marginTop: theme.spacing[6] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            No countable flights logged yet.
          </Text>
        </Card>
      ) : (
        <>
          <Card style={{ marginTop: theme.spacing[6], gap: theme.spacing[2] }}>
            <Text variant="label">Cumulative</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Flights
              </Text>
              <Text variant="dataSm">{ledger.totalFlights}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Hours
              </Text>
              <Text variant="dataSm">{Math.round(ledger.totalHours * 10) / 10}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Flying days
              </Text>
              <Text variant="dataSm">{ledger.flyingDays}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" color={theme.colors.textSecondary}>
                Unique sites
              </Text>
              <Text variant="dataSm">{ledger.uniqueSites}</Text>
            </View>
            {ledger.flightsWithoutSite > 0 ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>
                {ledger.flightsWithoutSite} flight{ledger.flightsWithoutSite === 1 ? '' : 's'} logged
                with no site — counted above, but can't prove site diversity.
              </Text>
            ) : null}
          </Card>

          <Card style={{ marginTop: theme.spacing[4], gap: theme.spacing[2] }}>
            <Text variant="label">{USHPA_P3.rating} (Intermediate)</Text>
            <MetricRow label="Flights" fact={comparison.flights} />
            <MetricRow label="Hours" fact={comparison.hours} />
            <MetricRow label="Flying days" fact={comparison.flyingDays} />
            <MetricRow label="Sites" fact={comparison.sites} />
          </Card>
        </>
      )}

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
