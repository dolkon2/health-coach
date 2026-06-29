/**
 * config.ts — runtime config read from app.json `extra`.
 *
 * The USDA FoodData Central key is free (register at fdc.nal.usda.gov for
 * 1000 req/hr). Drop it into app.json under `expo.extra.usdaApiKey` and it flows
 * to the food lookup service. Until then it falls back to the public DEMO_KEY
 * (~30 req/hr) so the app still works in dev. Open Food Facts needs no key.
 * Free-only, no paid tier (locked data-layer rule).
 */
import Constants from 'expo-constants';

export const USDA_API_KEY: string =
  (Constants.expoConfig?.extra?.usdaApiKey as string | undefined) ?? 'DEMO_KEY';
