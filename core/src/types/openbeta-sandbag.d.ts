/**
 * Ambient shim for @openbeta/sandbag (dimension/earth, Pass E4).
 *
 * The package ships real .d.ts files, but its package.json "exports" map has
 * no "types" condition — moduleResolution:"bundler" resolves the "require"
 * condition to a runtime .js just fine but can't find declarations for the
 * bare specifier. A tsconfig `paths` remap "fixes" tsc but was verified to
 * also redirect Jest's runtime resolution (Expo's Metro/Jest preset reads
 * tsconfig paths too) straight at the .d.ts file, which then fails to
 * `require()` as executable JS. An ambient module declaration is compile-time
 * only — it can't touch runtime resolution — so it's the shim that can't
 * break Jest. Kept intentionally minimal: only the surface climbGrade.ts uses,
 * hand-verified against node_modules/@openbeta/sandbag/dist/index.d.ts and
 * GradeScale.d.ts for v0.0.55.
 */
declare module '@openbeta/sandbag' {
  export type GradeScalesTypes =
    | 'ai'
    | 'aid'
    | 'wi'
    | 'vscale'
    | 'yds'
    | 'font'
    | 'french'
    | 'uiaa'
    | 'ewbank'
    | 'saxon'
    | 'norwegian'
    | 'brazilian_crux';

  // getScore/getGrade deliberately omitted: climbGrade.ts classifies a grade's
  // scale via isType() only (see its own doc comment for why — getScore's
  // internal table lookup silently fabricates a score for some out-of-range,
  // regex-valid grades on more than one scale, verified against v0.0.55).
  export interface GradeScale {
    isType: (grade: string) => boolean;
    displayName: string;
    name: GradeScalesTypes;
  }

  export function getScale(gradeScaleType: GradeScalesTypes): GradeScale | null;
}
