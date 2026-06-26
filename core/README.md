# core — the engine

Platform-agnostic TypeScript. No React, no React Native, no Expo imports — ever.
This is deliberate: the core is identical whether the app ships on Expo or
native, so the engine is never thrown away (see `planning/claude-md.md`).

## What's here

| Module            | Job                                                          | Built in |
| ----------------- | ----------------------------------------------------------- | -------- |
| `observation.ts`  | The one record type everything becomes. Tier + fidelity.    | ✅ Pass 1 |
| `benchmark.ts`    | User-authored goals (not Observations).                     | ✅ Pass 1 |
| `timeline.ts`     | Orders, windows, per-day buckets the observations.          | Pass 3   |
| `trend.ts`        | Noisy weigh-ins → smooth weight trend (tier 2).             | Pass 3   |
| `expenditure.ts`  | Trend + intake → measured TDEE (residual).                  | Phase 2  |
| `stimulus.ts`     | Sessions → weekly ledger + `reveal()`.                      | Pass 4   |

Modules not yet built export real types and honest signatures that **throw**
if called (`notImplemented.ts`). The constitution forbids fabricated numbers,
so an unbuilt engine fails loudly rather than returning a plausible lie.

## How the app imports it

Via the `@core/*` TypeScript path alias (configured in `tsconfig.json`), which
Expo's Metro bundler resolves automatically:

```ts
import { Observation, computeWeightTrend } from '@core/index';
```

## Import-style note (a deliberate deviation)

The constitution suggests `.js` extensions on relative imports for a standalone
Node ESM resolver. We use **extensionless** relative imports instead, because
core/ is bundled by Metro and tested with `jest-expo` — not run via standalone
Node ESM. If core/ is ever extracted to a standalone Node package, add the `.js`
extensions back at that point.
