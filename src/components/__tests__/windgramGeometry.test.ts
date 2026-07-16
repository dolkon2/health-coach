/**
 * WindgramChart pure-geometry tests — level→y mapping (incl. below-grid
 * clipping and degenerate domains), the barb speed steps at their exact
 * boundaries, arrow rotation, daylight slicing, and the composed
 * windgramGeometry builder (model boundary, BL/freezing lines with honest
 * breaks, null on undrawable input).
 */
import { describe, it, expect } from '@jest/globals';
import type { WindgramHour, WindgramSeries } from '@core/conditions/windgram';
import {
  levelY,
  barbStep,
  windArrowAngle,
  dayColumns,
  windgramGeometry,
  spotLocalHourLabel,
  spotLocalDayLabel,
  PLOT_HEIGHT,
} from '../WindgramChart';

const DOMAIN = { minM: 0, maxM: 4000 };

describe('levelY', () => {
  it('maps the domain linearly, top of domain at the top pad', () => {
    const top = levelY(4000, DOMAIN, 240, 16, 34)!;
    const bottom = levelY(0, DOMAIN, 240, 16, 34)!;
    const mid = levelY(2000, DOMAIN, 240, 16, 34)!;
    expect(top).toBe(16);
    expect(bottom).toBe(240 - 34);
    expect(mid).toBeCloseTo((top + bottom) / 2);
    expect(top).toBeLessThan(mid);
  });

  it('clips outside the domain instead of clamping to a false position', () => {
    expect(levelY(-10, DOMAIN)).toBeNull(); // below grid — underground
    expect(levelY(4001, DOMAIN)).toBeNull();
  });

  it('refuses a degenerate domain', () => {
    expect(levelY(100, { minM: 500, maxM: 500 })).toBeNull();
    expect(levelY(100, { minM: 500, maxM: 400 })).toBeNull();
  });
});

describe('barbStep', () => {
  it('steps at the documented 8/13/21 kt boundaries', () => {
    expect(barbStep(7)).toBe('light');
    expect(barbStep(8)).toBe('moderate');
    expect(barbStep(12)).toBe('moderate');
    expect(barbStep(13)).toBe('strong');
    expect(barbStep(20)).toBe('strong');
    expect(barbStep(21)).toBe('elevated');
  });
});

describe('spot-local labels', () => {
  // 2026-07-16T20:00:00Z. The label must follow the SPOT's offset, never
  // the device timezone (formatting pins timeZone:'UTC' after shifting).
  const T = 1784232000;

  it('renders hour and day at the spot offset, not the device zone', () => {
    expect(spotLocalHourLabel(T, 0)).toBe('8 PM');
    expect(spotLocalHourLabel(T, -7 * 3600)).toBe('1 PM'); // Gorge, PDT
    expect(spotLocalDayLabel(T, 0)).toContain('Jul 16');
    // 20:00Z + 10h (AEST) = 06:00 next day at the spot.
    expect(spotLocalHourLabel(T, 10 * 3600)).toBe('6 AM');
    expect(spotLocalDayLabel(T, 10 * 3600)).toContain('Jul 17');
  });
});

describe('windArrowAngle', () => {
  it('points where the air is going, not where it came from', () => {
    expect(windArrowAngle(0)).toBe(180); // northerly blows south
    expect(windArrowAngle(270)).toBe(90); // westerly blows east
    expect(windArrowAngle(180)).toBe(0);
  });
});

// ── Series builders ──────────────────────────────────────────────────────────

const HOUR = 3600;
const T0 = 1_784_376_000;

function mkHour(
  timeEpochSec: number,
  model: 'hrrr' | 'gfs',
  levels: Array<[heightM: number, tempC: number, windKts?: number, dirDeg?: number, cloud?: number]>,
  extras?: Partial<WindgramHour>
): WindgramHour {
  return {
    timeEpochSec,
    model,
    levels: levels.map(([heightM, tempC, windSpeedKts, windDirectionDeg, cloudCoverPct], i) => ({
      pressureHpa: 1000 - i * 100,
      heightM,
      tempC,
      ...(windSpeedKts !== undefined ? { windSpeedKts } : {}),
      ...(windDirectionDeg !== undefined ? { windDirectionDeg } : {}),
      ...(cloudCoverPct !== undefined ? { cloudCoverPct } : {}),
    })),
    ...extras,
  };
}

const STD_LEVELS: Array<[number, number, number?, number?, number?]> = [
  [100, 20, 5, 270, 0],
  [1100, 12, 10, 280, 40], // 8.0 C/km below → conditional
  [2100, 2, 15, 290, 80], // 10 C/km → unstable
  [3100, 4, 25, 300, 100], // -2 C/km → inverted
];

function mkSeries(hours: WindgramHour[], overrides?: Partial<WindgramSeries>): WindgramSeries {
  const first = hours[0]?.timeEpochSec ?? T0;
  const last = hours[hours.length - 1]?.timeEpochSec ?? T0;
  return {
    hours,
    days: [{ sunriseEpochSec: first - HOUR, sunsetEpochSec: last + HOUR }],
    gridElevationM: 100,
    ...overrides,
  };
}

describe('dayColumns', () => {
  it('slices hours to daylight windows and drops empty days', () => {
    const hours = [0, 1, 2, 3, 4, 5].map((i) => mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS));
    const days = [
      { sunriseEpochSec: T0 + HOUR, sunsetEpochSec: T0 + 3 * HOUR }, // hrs 1..3
      { sunriseEpochSec: T0 + 100 * HOUR, sunsetEpochSec: T0 + 110 * HOUR }, // no data
    ];
    const out = dayColumns(hours, days);
    expect(out).toHaveLength(1);
    expect(out[0].hours.map((h) => h.timeEpochSec)).toEqual([
      T0 + HOUR,
      T0 + 2 * HOUR,
      T0 + 3 * HOUR,
    ]);
  });
});

describe('windgramGeometry', () => {
  it('returns null on fewer than 2 drawable hours', () => {
    expect(windgramGeometry(mkSeries([mkHour(T0, 'gfs', STD_LEVELS)]))).toBeNull();
    expect(windgramGeometry(mkSeries([]))).toBeNull();
  });

  it('lays out one column per daylight hour with lapse bands bucketed', () => {
    const hours = [0, 1, 2].map((i) => mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS));
    const geo = windgramGeometry(mkSeries(hours))!;
    expect(geo).not.toBeNull();
    expect(geo.columns).toHaveLength(3);
    expect(geo.svgHeight).toBe(PLOT_HEIGHT);
    // Columns advance left to right.
    expect(geo.columns[1].x).toBeGreaterThan(geo.columns[0].x);
    // Three adjacent-level bands, buckets from the crafted temps.
    expect(geo.columns[0].bands.map((b) => b.bucket)).toEqual([
      'conditional',
      'unstable',
      'inverted',
    ]);
    // Bands sit above one another (yTop of a higher band is smaller).
    const [b0, b1] = geo.columns[0].bands;
    expect(b1.yTop).toBeLessThan(b0.yTop);
    // One arrow per level with wind, one cloud sliver per level with cover.
    expect(geo.columns[0].arrows).toHaveLength(4);
    expect(geo.columns[0].clouds).toHaveLength(4);
  });

  it('clips levels below the grid elevation — no arrow, no false position', () => {
    const levels: Array<[number, number, number?, number?]> = [
      [50, 22, 6, 180], // below the 100 m grid floor → clipped
      [1100, 12, 10, 280],
      [2100, 2, 15, 290],
    ];
    const hours = [0, 1].map((i) => mkHour(T0 + i * HOUR, 'gfs', levels));
    const geo = windgramGeometry(mkSeries(hours, { gridElevationM: 100 }))!;
    expect(geo.domain.minM).toBe(100);
    expect(geo.columns[0].arrows).toHaveLength(2); // the underground level drew nothing
  });

  it('marks the HRRR→GFS boundary at the first column past hrrrEndEpochSec', () => {
    const hours = [
      mkHour(T0, 'hrrr', STD_LEVELS),
      mkHour(T0 + HOUR, 'hrrr', STD_LEVELS),
      mkHour(T0 + 2 * HOUR, 'gfs', STD_LEVELS),
    ];
    const geo = windgramGeometry(mkSeries(hours, { hrrrEndEpochSec: T0 + HOUR }))!;
    expect(geo.hrrrBoundaryX).not.toBeNull();
    expect(geo.hrrrBoundaryX).toBe(geo.columns[2].x - 1);
  });

  it('ignores a transient mid-run HRRR hole — the boundary is the horizon, not the first flip', () => {
    const hours = [
      mkHour(T0, 'hrrr', STD_LEVELS),
      mkHour(T0 + HOUR, 'gfs', STD_LEVELS), // one incomplete HRRR hour, demoted by the parser
      mkHour(T0 + 2 * HOUR, 'hrrr', STD_LEVELS),
      mkHour(T0 + 3 * HOUR, 'gfs', STD_LEVELS),
    ];
    const geo = windgramGeometry(mkSeries(hours, { hrrrEndEpochSec: T0 + 2 * HOUR }))!;
    // NOT at the transient hole (columns[1]) — at the real downgrade.
    expect(geo.hrrrBoundaryX).toBe(geo.columns[3].x - 1);
  });

  it('draws no boundary when a single model is visible', () => {
    const gfsOnly = [0, 1, 2].map((i) => mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS));
    expect(windgramGeometry(mkSeries(gfsOnly))!.hrrrBoundaryX).toBeNull();
    // All drawn columns inside the HRRR window → nothing beyond the horizon.
    const hrrrOnly = [0, 1, 2].map((i) => mkHour(T0 + i * HOUR, 'hrrr', STD_LEVELS));
    expect(
      windgramGeometry(mkSeries(hrrrOnly, { hrrrEndEpochSec: T0 + 5 * HOUR }))!.hrrrBoundaryX
    ).toBeNull();
  });

  it('builds BL and freezing lines that break on holes', () => {
    const withScalars = (i: number, extras: Partial<WindgramHour>) =>
      mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS, extras);
    const hours = [
      withScalars(0, { blHeightM: 800, freezingLevelM: 2500 }),
      withScalars(1, {}), // hole in both
      withScalars(2, { blHeightM: 1200, freezingLevelM: 2600 }),
    ];
    const geo = windgramGeometry(mkSeries(hours))!;
    // Two disconnected subpaths — a hole breaks the line, never bridges it.
    expect((geo.blLine!.match(/M/g) ?? []).length).toBe(2);
    expect((geo.freezingLine!.match(/M/g) ?? []).length).toBe(2);
  });

  it('omits the BL line entirely when grid elevation is unknown', () => {
    const hours = [0, 1].map((i) =>
      mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS, { blHeightM: 800, freezingLevelM: 2500 })
    );
    const geo = windgramGeometry(mkSeries(hours, { gridElevationM: undefined }))!;
    expect(geo.blLine).toBeNull(); // AGL height with no ground reference
    expect(geo.freezingLine).not.toBeNull(); // ASL — still honest
    expect(geo.gridY).toBeNull();
  });

  it('skips freezing-level points above the chart top rather than clamping', () => {
    const hours = [
      mkHour(T0, 'gfs', STD_LEVELS, { freezingLevelM: 2500 }),
      mkHour(T0 + HOUR, 'gfs', STD_LEVELS, { freezingLevelM: 9000 }), // above 3100 m top
      mkHour(T0 + 2 * HOUR, 'gfs', STD_LEVELS, { freezingLevelM: 2600 }),
    ];
    const geo = windgramGeometry(mkSeries(hours))!;
    expect((geo.freezingLine!.match(/M/g) ?? []).length).toBe(2);
  });

  it('breaks BL/freezing lines across the overnight day gap — no fabricated night trend', () => {
    const mk = (i: number) =>
      mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS, { blHeightM: 800, freezingLevelM: 2500 });
    const series = mkSeries([mk(0), mk(1), mk(24), mk(25)], {
      days: [
        { sunriseEpochSec: T0 - HOUR, sunsetEpochSec: T0 + 2 * HOUR },
        { sunriseEpochSec: T0 + 23 * HOUR, sunsetEpochSec: T0 + 26 * HOUR },
      ],
    });
    const geo = windgramGeometry(series)!;
    // One subpath per day — never a segment bridging undrawn night hours.
    expect((geo.blLine!.match(/M/g) ?? []).length).toBe(2);
    expect((geo.freezingLine!.match(/M/g) ?? []).length).toBe(2);
  });

  it('separates day groups and labels each day', () => {
    const day1 = [0, 1].map((i) => mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS));
    const day2 = [24, 25].map((i) => mkHour(T0 + i * HOUR, 'gfs', STD_LEVELS));
    const series = mkSeries([...day1, ...day2], {
      days: [
        { sunriseEpochSec: T0 - HOUR, sunsetEpochSec: T0 + 2 * HOUR },
        { sunriseEpochSec: T0 + 23 * HOUR, sunsetEpochSec: T0 + 26 * HOUR },
      ],
    });
    const geo = windgramGeometry(series)!;
    expect(geo.columns).toHaveLength(4);
    expect(geo.dayLabels).toHaveLength(2);
    expect(geo.daySeparators).toHaveLength(1);
    // The separator sits between the two day groups.
    expect(geo.daySeparators[0]).toBeGreaterThan(geo.columns[1].x);
    expect(geo.daySeparators[0]).toBeLessThan(geo.columns[2].x);
  });
});
