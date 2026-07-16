/**
 * Spot detail — name, sport, notes, live conditions (weather always, gauge
 * when the sport resolves one), and the F1 Forecast dashboard (a card stack
 * per `spotForecastPanels`, kept visually distinct from the live-conditions
 * Card above it — live = now, forecast = ahead, never merged into one
 * number). F2 adds a nearby-station "live reading" line inside the Wind
 * card itself (forecast-tab.md §3) — a THIRD register, distinct from both
 * the Conditions card and the model forecast, never blended into either.
 * Full P3 (session log beneath, edit/rename/re-tag, gauge-link search
 * affordance) is a later pass — this stub exists so the list's and Home's
 * "tap → spot detail" routing (pinned-spots-spec.md, home-tab.md §5) has
 * somewhere real to land rather than a dead route.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import {
  Screen,
  Text,
  Card,
  Button,
  WindForecastCard,
  RainShineForecastCard,
  MeteoForecastCard,
  ForecastPanelPicker,
} from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { getSpot, updateSpot } from '@/storage/spots';
import { fetchCurrentForSpot, type CurrentConditions } from '@/lib/conditions/current';
import { fetchForecast, type ForecastResult } from '@/lib/conditions/openMeteoForecast';
import { fetchLiveObservationForSpot, type LiveObservation } from '@/lib/conditions/liveObservation';
import { fetchWindgram, type WindgramResult } from '@/lib/conditions/openMeteoWindgram';
import { RENDERABLE_FORECAST_PANELS } from '@/lib/forecastPanels';
import { spotHeadlineReading, updatedAtLabel } from '@/lib/spotHeadline';
import { feedForSport } from '@core/conditions/feedForSport';
import { activityById } from '@/lib/activity';
import { spotForecastPanels, type Spot, type ForecastPanel } from '@core/spot';

export default function SpotDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<Spot | null | undefined>(undefined);
  const [current, setCurrent] = useState<CurrentConditions | undefined>(undefined);
  const [forecast, setForecast] = useState<ForecastResult | null | undefined>(undefined);
  const [observed, setObserved] = useState<LiveObservation | null | undefined>(undefined);
  const [windgram, setWindgram] = useState<WindgramResult | null | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const s = await getSpot(id);
    setSpot(s);
    if (s) {
      const hasCoords = s.lat != null && s.lng != null;
      // The windgram is the dashboard's heaviest call (dual-model
      // pressure-level payload) — fetched ONLY when the spot has opted into
      // the Meteo panel, never speculatively (forecast-tab.md §2a).
      const wantsMeteo = spotForecastPanels(s).includes('meteo');
      // Independent network calls — run concurrently rather than doubling
      // the screen's worst-case load latency by awaiting them in series.
      const [c, f, o, w] = await Promise.all([
        fetchCurrentForSpot(s),
        hasCoords ? fetchForecast(s.lat!, s.lng!) : Promise.resolve(null),
        fetchLiveObservationForSpot(s),
        wantsMeteo && hasCoords ? fetchWindgram(s.lat!, s.lng!) : Promise.resolve(null),
      ]);
      setCurrent(c);
      setForecast(f);
      setObserved(o);
      setWindgram(w);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handlePanelsChange(panels: ForecastPanel[]) {
    if (!spot) return;
    const updated = await updateSpot(spot.id, { meta: { ...spot.meta, forecastPanels: panels } });
    setSpot(updated);
    // Enabling Meteo mid-visit fetches just the windgram (the screen's
    // other data is already loaded); disabling drops it without a refetch.
    if (panels.includes('meteo') && windgram == null && spot.lat != null && spot.lng != null) {
      setWindgram(await fetchWindgram(spot.lat, spot.lng));
    }
  }

  if (spot === undefined) return <Screen scroll>{null}</Screen>;
  if (spot === null) {
    return (
      <Screen scroll>
        <Text variant="body" color={theme.colors.textMuted}>
          This spot no longer exists.
        </Text>
      </Screen>
    );
  }

  const activity = spot.sport ? activityById(spot.sport) : undefined;
  const Icon = activity ? iconFor(activity.icon) : MapPin;
  const feed = feedForSport(spot.sport);
  const headline = spotHeadlineReading(feed, current);
  const stamp = updatedAtLabel(current, Date.now());

  const panels = spotForecastPanels(spot);
  const renderablePanels = panels.filter((p) => RENDERABLE_FORECAST_PANELS.includes(p));
  const forecastCards = [];
  if (forecast) {
    if (panels.includes('wind')) {
      forecastCards.push(
        <WindForecastCard
          key="wind"
          hourly={forecast.hourly}
          model={forecast.model}
          fetchedAtUtc={forecast.fetchedAtUtc}
          observed={observed}
        />
      );
    }
    if (panels.includes('rain-shine')) {
      forecastCards.push(
        <RainShineForecastCard
          key="rain-shine"
          hourly={forecast.hourly}
          daily={forecast.daily}
          model={forecast.model}
          fetchedAtUtc={forecast.fetchedAtUtc}
        />
      );
    }
  }
  // The Meteo card rides its own fetch — a failed surface forecast must not
  // swallow a valid windgram (and vice versa; same independence rule as the
  // F2 observed reading). Undefined = still loading, handled below.
  if (panels.includes('meteo') && windgram !== undefined) {
    forecastCards.push(<MeteoForecastCard key="meteo" windgram={windgram} />);
  }

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
        <Icon size={24} color={theme.colors.accent} strokeWidth={1.5} />
        <View style={{ flex: 1 }}>
          <Text variant="displayMd">{spot.name}</Text>
          {activity ? (
            <Text variant="label" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
              {activity.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: theme.spacing[6] }}>
        <Card style={{ gap: theme.spacing[1] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Conditions
          </Text>
          <Text variant="dataLg">{headline}</Text>
          {stamp ? (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              {stamp}
            </Text>
          ) : null}
          {feed === 'gauge' && !spot.gaugeSiteId ? (
            <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[1] }}>
              No gauge linked yet.
            </Text>
          ) : null}
        </Card>
      </View>

      <View style={{ marginTop: theme.spacing[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Forecast
          </Text>
          <Button
            label={pickerOpen ? 'Done' : 'Configure'}
            variant="ghost"
            size="sm"
            onPress={() => setPickerOpen((v) => !v)}
          />
        </View>
        {pickerOpen ? (
          <View style={{ marginTop: theme.spacing[2] }}>
            <ForecastPanelPicker value={panels} onChange={handlePanelsChange} />
          </View>
        ) : null}
        {renderablePanels.length === 0 ? (
          <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
            No forecast panels configured for this spot.
          </Text>
        ) : forecastCards.length > 0 ? (
          <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>{forecastCards}</View>
        ) : forecast === undefined ? (
          <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
            Loading forecast…
          </Text>
        ) : (
          <Text variant="bodySm" color={theme.colors.textMuted} style={{ marginTop: theme.spacing[2] }}>
            Forecast unavailable.
          </Text>
        )}
      </View>

      {spot.notes ? (
        <View style={{ marginTop: theme.spacing[6] }}>
          <Text variant="label" color={theme.colors.textSecondary}>
            Notes
          </Text>
          <Text variant="body" style={{ marginTop: theme.spacing[2] }}>
            {spot.notes}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing[8] }}>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          Session history and editing for this spot are coming in a later pass.
        </Text>
      </View>

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}
