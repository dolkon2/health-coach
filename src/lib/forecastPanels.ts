/**
 * forecastPanels.ts — pure display derivations for the F1 Spot Forecast
 * dashboard's Wind and Rain/Shine cards (forecast-tab.md §2a/§4). Windowing
 * and formatting only; the fetch/parse layer (openMeteoForecast.ts,
 * core/conditions/forecast.ts) never fabricates a value, and neither does
 * this — every function here is a no-op pass-through on missing data, never
 * an interpolation.
 */
import type { HourlyForecastPoint, DailyForecastPoint } from '@core/conditions/forecast';
import type { ForecastPanel } from '@core/spot';
import { formatPrecipIn, mmToInches } from './units';

/**
 * The single source of truth for "which ForecastPanel values this pass
 * actually renders a card for." `ForecastPanel` itself also carries 'gauge'
 * — a spot's sport can default to it — but there's no gauge card here yet
 * (the existing live Conditions card already covers it). 'meteo' is F3's
 * windgram: renderable, opt-in only, never a default (E7 resolved
 * 2026-07-16 — the §8 meteo-panel-cost flag: opt-in everywhere stands).
 * Every site that needs to know "is this panel visible" (the spot-detail
 * screen, the picker's option list) reads this array rather than
 * re-listing the values by hand.
 */
export const RENDERABLE_FORECAST_PANELS: ForecastPanel[] = ['wind', 'rain-shine', 'meteo'];

// ─── Wind ───────────────────────────────────────────────────────────────────

export interface WindHeader {
  avgKts: number;
  gustKts?: number;
  directionDeg?: number;
  atEpochSec: number;
}

/**
 * The Wind card's header numbers — the NEAREST upcoming hour with a wind
 * reading (not a multi-hour average): "what's it about to do", the forecast
 * counterpart to current.ts's "what's it doing now". Null when no hourly
 * point carries a wind speed at all.
 */
export function windHeader(hourly: HourlyForecastPoint[]): WindHeader | null {
  const first = hourly.find((h) => h.windSpeedKts !== undefined);
  if (!first) return null;
  return {
    avgKts: first.windSpeedKts!,
    ...(first.windGustKts !== undefined ? { gustKts: first.windGustKts } : {}),
    ...(first.windDirectionDeg !== undefined ? { directionDeg: first.windDirectionDeg } : {}),
    atEpochSec: first.timeEpochSec,
  };
}

/** "gusting 22 kt from 289°" / "12 kt" when no gust reading exists. Direction
 *  spoken as FROM (community convention, forecast-tab.md §2a) — degrees only,
 *  matching WindSection's existing `from ${deg}°` convention (no compass-point
 *  table exists elsewhere in the app to stay consistent with). */
export function windHeaderLabel(header: WindHeader): string {
  const dir = header.directionDeg !== undefined ? ` from ${Math.round(header.directionDeg)}°` : '';
  if (header.gustKts === undefined) return `${Math.round(header.avgKts)} kt${dir}`;
  return `${Math.round(header.avgKts)} avg, gusting ${Math.round(header.gustKts)} kt${dir}`;
}

/**
 * Gust color-step threshold (Windy Bingen screenshot convention, research
 * doc §2d: "gust row color-coded green→amber (13→21)"). ⚑ The exact
 * kt values are read off that one reference screenshot, not a documented
 * app-wide rule — treat as a placeholder pending real design guidance.
 * Returns a step, not a color: this app's shipped design system is
 * deliberately monochrome with no green/red grading anywhere (tokens.ts,
 * BenchmarkStatusCard, StimulusLedger all say so explicitly) — the UI layer
 * renders 'elevated' as emphasis (bold/ink), never a new hue, so the
 * community convention survives without breaking that rule.
 */
export type GustStep = 'calm' | 'building' | 'elevated';

// Exported: the windgram's arrow-weight ramp (WindgramChart.barbStep)
// anchors on the same two values — one retune must reach both panels.
export const GUST_BUILDING_KT = 13;
export const GUST_ELEVATED_KT = 21;

export function gustStep(gustKts: number | undefined): GustStep {
  if (gustKts === undefined) return 'calm';
  if (gustKts >= GUST_ELEVATED_KT) return 'elevated';
  if (gustKts >= GUST_BUILDING_KT) return 'building';
  return 'calm';
}

/**
 * "8 lull / 12 avg / 18 gust kt from 290°" (F2, forecast-tab.md §3) — the
 * OBSERVED reading's label, deliberately phrased differently from
 * windHeaderLabel's "avg, gusting" (forecast) so the two registers read as
 * visually distinct even before styling. Shows only the numbers the station
 * actually reported — a station with no lull field never gets one invented
 * (windLullKts stays honest-undefined at the source, liveObservation.ts).
 */
export function liveWindLabel(observed: {
  windAvgKts?: number;
  windGustKts?: number;
  windLullKts?: number;
  windDirectionDeg?: number;
}): string {
  const dir = observed.windDirectionDeg !== undefined ? ` from ${Math.round(observed.windDirectionDeg)}°` : '';
  const nums: string[] = [];
  if (observed.windLullKts !== undefined) nums.push(`${Math.round(observed.windLullKts)} lull`);
  if (observed.windAvgKts !== undefined) nums.push(`${Math.round(observed.windAvgKts)} avg`);
  if (observed.windGustKts !== undefined) nums.push(`${Math.round(observed.windGustKts)} gust`);
  if (nums.length === 0) return 'No wind reading from this station';
  return `${nums.join(' / ')} kt${dir}`;
}

// ─── Rain/Shine ─────────────────────────────────────────────────────────────

/**
 * "0.6 in in the next 24 h" (forecast-tab.md §2a windowed headline). Sums
 * `precipMm` over the first `hoursAhead` hourly points; a missing hour in
 * that window makes the sum unknowable (null), same null-honest rule as
 * `sumHourlyPrecip` — never a partial total presented as complete.
 */
export function precipWindowHeadline(hourly: HourlyForecastPoint[], hoursAhead = 24): string | null {
  const window = hourly.slice(0, hoursAhead);
  if (window.length < hoursAhead) return null;
  let totalMm = 0;
  for (const h of window) {
    if (h.precipMm === undefined) return null;
    totalMm += h.precipMm;
  }
  return `${formatPrecipIn(totalMm)} in the next ${hoursAhead} h`;
}

export interface DailyRainShineRow {
  dateEpochSec: number;
  probabilityPct?: number;
  accumulationLabel?: string; // e.g. "0.20 in" — undefined when unrecorded
  tempMaxC?: number;
  tempMinC?: number;
}

/** Maps parsed daily points into display rows — probability and
 *  accumulation shown TOGETHER (Wunderground convention), never one without
 *  the other implied. */
export function dailyRainShineRows(daily: DailyForecastPoint[]): DailyRainShineRow[] {
  return daily.map((d) => ({
    dateEpochSec: d.dateEpochSec,
    ...(d.precipProbabilityMaxPct !== undefined ? { probabilityPct: d.precipProbabilityMaxPct } : {}),
    ...(d.precipSumMm !== undefined
      ? { accumulationLabel: `${mmToInches(d.precipSumMm).toFixed(2)} in` }
      : {}),
    ...(d.tempMaxC !== undefined ? { tempMaxC: d.tempMaxC } : {}),
    ...(d.tempMinC !== undefined ? { tempMinC: d.tempMinC } : {}),
  }));
}

// ─── Shared honesty rules ───────────────────────────────────────────────────

const FADE_CUTOFF_S = 72 * 3600;

/** Anything more than 72h out fades (forecast-tab.md §4) — the model's own
 *  users learn to distrust day 9 like day 1; we don't let it read that way. */
export function isBeyondFadeHorizon(timeEpochSec: number, nowEpochSec: number): boolean {
  return timeEpochSec - nowEpochSec > FADE_CUTOFF_S;
}
