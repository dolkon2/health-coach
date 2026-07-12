/**
 * activityGlyphs.tsx — the brand's own geometric icon vocabulary, one glyph
 * per activity, ported from the design system's `ui_kits/mobile-app/
 * activityIcons.jsx` (2026-07-12 makeover). Line strokes, dots, and simple
 * silhouettes grouped into shape families (terrain triangle, snowflake,
 * wave, wind sweep, flower/loop, diamond) — a small added mark distinguishes
 * activities within the same family so no two tiles render identically.
 * Monochrome only: every shape reads `color` from its caller — color is
 * reserved for the four elements, never iconography.
 *
 * `activityIcons.tsx` wraps this into the app's stable `iconFor()` lookup;
 * nothing else should import this file directly.
 */
import { cloneElement, type ReactElement } from 'react';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

type ShapeExtra = Partial<{ fill: string; stroke: string; strokeDasharray: string }>;

const P = (d: string, extra?: ShapeExtra): ReactElement => <Path d={d} {...extra} />;
const C = (cx: number, cy: number, r: number, extra?: ShapeExtra): ReactElement => (
  <Circle cx={cx} cy={cy} r={r} {...extra} />
);
const E = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rot?: number,
  extra?: ShapeExtra
): ReactElement => (
  <Ellipse
    cx={cx}
    cy={cy}
    rx={rx}
    ry={ry}
    {...(rot ? { rotation: rot, originX: cx, originY: cy } : {})}
    {...extra}
  />
);
const L = (x1: number, y1: number, x2: number, y2: number, extra?: ShapeExtra): ReactElement => (
  <Line x1={x1} y1={y1} x2={x2} y2={y2} {...extra} />
);
const wave = (y: number) => P(`M5 ${y} Q9 ${y - 3} 13 ${y} T21 ${y} T29 ${y}`);
const jag = (y: number) => P(`M5 ${y} L10 ${y - 4} L15 ${y} L20 ${y - 4} L25 ${y} L29 ${y - 4}`);

export const GLYPH_KEYS = [
  'gym', 'calisthenics', 'run', 'walk', 'ruck', 'ride', 'mountainBike', 'climb',
  'hike', 'trailRun', 'ski', 'snowboard', 'skiTouring', 'xcSki', 'snowshoe',
  'kayak', 'whitewater', 'swim', 'wingfoil', 'sail', 'windsurf', 'kitesurf',
  'parawing', 'breathwork', 'yoga', 'mobility', 'dance', 'pt',
] as const;

export type GlyphKey = (typeof GLYPH_KEYS)[number];

const GLYPH_KEY_SET: ReadonlySet<string> = new Set(GLYPH_KEYS);

export function isGlyphKey(name: string): name is GlyphKey {
  return GLYPH_KEY_SET.has(name);
}

type GlyphDef = (color: string) => ReactElement[];

const DEFS: Record<GlyphKey, GlyphDef> = {
  gym: () => [P('M9 12 L13 16 L9 20 L5 16 Z'), P('M23 12 L27 16 L23 20 L19 16 Z'), L(13, 16, 19, 16)],
  calisthenics: () => [
    P('M16 10 L21 16 L16 22 L11 16 Z'), C(8, 16, 2), C(24, 16, 2), L(10, 16, 11, 16), L(21, 16, 22, 16),
  ],
  run: () => [E(11, 21, 2.6, 4, -12), E(19, 13, 2.6, 4, 12), L(23, 9, 27, 7)],
  walk: () => [E(12, 20, 2.6, 4, -6), E(18, 13, 2.6, 4, 6)],
  ruck: () => [
    E(12, 21, 2.4, 3.6, -8), E(19, 15, 2.4, 3.6, 8),
    P('M12 4 h7 a1.4 1.4 0 0 1 1.4 1.4 v5.2 a1.4 1.4 0 0 1 -1.4 1.4 h-7 a1.4 1.4 0 0 1 -1.4 -1.4 v-5.2 a1.4 1.4 0 0 1 1.4 -1.4 Z'),
    L(14, 4, 14, 2), L(19, 4, 19, 2),
  ],
  ride: (c) => [C(9, 23, 4), C(23, 23, 4), P('M9 23 L14 12 L19 23 M14 12 L19 12'), C(19, 9, 1.4, { fill: c, stroke: 'none' })],
  mountainBike: () => [C(9, 24, 3.6), C(23, 24, 3.6), P('M9 24 L14 13 L19 24 M14 13 L19 13'), P('M12 9 L15 4 L18 9')],
  climb: (c) => [P('M16 9 L25 24 L7 24 Z'), L(16, 5, 16, 9), C(16, 9, 1.6, { fill: c, stroke: 'none' })],
  hike: () => [P('M16 9 L25 24 L7 24 Z')],
  trailRun: (c) => [
    P('M16 9 L25 24 L7 24 Z'), P('M9 21 L14 18 L19 21 L24 17'),
    C(9, 21, 1.1, { fill: c, stroke: 'none' }), C(14, 18, 1.1, { fill: c, stroke: 'none' }),
    C(19, 21, 1.1, { fill: c, stroke: 'none' }), C(24, 17, 1.1, { fill: c, stroke: 'none' }),
  ],
  ski: () => [L(16, 7, 16, 25), L(8.5, 11, 23.5, 21), L(8.5, 21, 23.5, 11)],
  snowboard: () => [L(16, 7, 16, 25), L(8.5, 11, 23.5, 21), L(8.5, 21, 23.5, 11), L(9, 27, 23, 27)],
  skiTouring: () => [
    L(16, 9, 16, 23), L(9.5, 12, 22.5, 20), L(9.5, 20, 22.5, 12),
    P('M6 27 L26 5', { strokeDasharray: '2.5 2.5' }),
  ],
  xcSki: () => [L(16, 9, 16, 23), L(9.5, 12, 22.5, 20), L(9.5, 20, 22.5, 12), L(9, 26, 14, 21), L(18, 26, 23, 21)],
  snowshoe: () => [E(16, 16, 7, 10), L(11, 12, 21, 12), L(11, 16, 21, 16), L(11, 20, 21, 20)],
  kayak: (c) => [wave(11), wave(17), wave(23), L(22, 4, 27, 2), C(27, 2, 1, { fill: c, stroke: 'none' })],
  whitewater: (c) => [jag(16), jag(24), P('M7 6 Q16 0 25 6 Q16 12 7 6 Z', { fill: c, stroke: 'none' })],
  swim: (c) => [wave(14), wave(20), wave(26), C(10, 7, 2, { fill: c, stroke: 'none' })],
  wingfoil: (c) => [wave(10), L(12, 24, 20, 24), C(16, 24, 1.3, { fill: c, stroke: 'none' })],
  sail: () => [wave(9), L(16, 14, 16, 26), P('M16 14 L22 26 L16 26 Z')],
  windsurf: () => [wave(9), L(16, 14, 16, 25), P('M16 14 L21 24 L16 24 Z'), E(16, 27, 6, 1.4)],
  kitesurf: () => [P('M9 7 Q16 2 23 7'), L(11, 8, 16, 15), L(21, 8, 16, 15), E(16, 27, 5, 1.3)],
  parawing: () => [P('M7 9 Q16 1 25 9'), L(10, 10, 16, 17), L(22, 10, 16, 17)],
  breathwork: () => [wave(11), wave(17), wave(23)],
  yoga: (c) => [C(16, 10, 3), C(22, 16, 3), C(16, 22, 3), C(10, 16, 3), C(16, 16, 1.3, { fill: c, stroke: 'none' })],
  mobility: () => [
    C(16, 10, 2.6), C(21, 16, 2.6), C(16, 22, 2.6), C(11, 16, 2.6),
    P('M16 3 A13 13 0 1 1 15.9 3', { strokeDasharray: '2.5 2.5' }),
  ],
  dance: (c) => [
    C(16, 10, 2.6), C(21, 16, 2.6), C(16, 22, 2.6), C(11, 16, 2.6),
    L(23, 22, 28, 27), C(28, 27, 1, { fill: c, stroke: 'none' }),
  ],
  pt: () => [P('M4 16 L9 16 L12 7 L15 25 L18 12 L21 16 L28 16')],
};

export type ActivityGlyphProps = {
  glyphKey: GlyphKey;
  color?: string;
  size?: number;
  strokeWidth?: number;
};

/** Renders one activity's glyph. `strokeWidth` defaults to the design
 *  system's 1.8 but stays overridable — existing call sites tune it per
 *  context (a Route card's icon reads slightly heavier than a Spot's). */
export function ActivityGlyph({ glyphKey, color = 'currentColor', size = 26, strokeWidth = 1.8 }: ActivityGlyphProps) {
  const def = DEFS[glyphKey] ?? DEFS.hike;
  const shapes = def(color);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map((shape, i) => cloneElement(shape, { key: i }))}
    </Svg>
  );
}
