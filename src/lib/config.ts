/**
 * config.ts — runtime config read from app.json `extra`.
 *
 * USDA FoodData Central: free key (register at fdc.nal.usda.gov for 1000 req/hr).
 * Drop it into app.json under `expo.extra.usdaApiKey`. Falls back to the public
 * DEMO_KEY (~30 req/hr) so the app still works in dev. Open Food Facts: no key.
 * Free-only food data layer (locked rule).
 *
 * Anthropic: optional. When set, the food logger's `described` parser runs
 * through Claude Haiku before resolving against USDA (multi-item meals, vague
 * portions). When null/missing, the regex parser handles it — the feature
 * gracefully degrades. Drop the key into app.json under
 * `expo.extra.anthropicApiKey`. NB: app.json ships in the bundle — this is the
 * solo-dev pattern; route through SecureStore or a backend proxy before
 * distribution.
 */
import Constants from 'expo-constants';

export const USDA_API_KEY: string =
  (Constants.expoConfig?.extra?.usdaApiKey as string | undefined) ?? 'DEMO_KEY';

export const ANTHROPIC_API_KEY: string | null =
  (Constants.expoConfig?.extra?.anthropicApiKey as string | null | undefined) ?? null;
