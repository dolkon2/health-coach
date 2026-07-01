/**
 * config.ts — runtime config read from environment variables.
 *
 * Keys live in a gitignored `.env.local` (see `.env.example`) for local dev, and
 * as EAS environment variables for cloud builds. Anything prefixed
 * `EXPO_PUBLIC_` is inlined into the app at build time — so these are NOT secret
 * in a shipped binary; route Anthropic through a backend proxy before public
 * distribution. Keeping them out of `app.json`/git is the immediate win.
 *
 * USDA FoodData Central: free key (register at fdc.nal.usda.gov for 1000 req/hr).
 * Falls back to the public DEMO_KEY (~30 req/hr) so the app still works with no
 * key set. Open Food Facts: no key. Free-only food data layer (locked rule).
 *
 * Anthropic: optional. When set, the food logger's `described` parser runs
 * through Claude before resolving against USDA (multi-item meals, vague
 * portions). When unset, the regex parser handles it — the feature gracefully
 * degrades.
 */

export const USDA_API_KEY: string =
  process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

export const ANTHROPIC_API_KEY: string | null =
  process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || null;
