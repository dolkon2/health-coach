/**
 * @health-coach/core — the platform-agnostic engine.
 *
 * Plain TypeScript, no platform dependencies. The core is identical whether the
 * app ships on Expo or native, so the engine is never thrown away. The app
 * imports from here (via the `@core/*` path alias); the engine never imports
 * from the app.
 */
export * from './observation';
export * from './gear';
export * from './benchmark';
export * from './sessionTemplate';
export * from './timeline';
export * from './trend';
export * from './expenditure';
export * from './baselineTdee';
export * from './stimulus';
export * from './nutrition/fidelity';
export * from './nutrition/captureTier';
export * from './nutrition/days';
export * from './nutrition/adapter';
export * from './nutrition/usda';
export * from './nutrition/openfoodfacts';
