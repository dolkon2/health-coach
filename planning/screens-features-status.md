# Screens & Features — live design status

*Last synced 2026-07-11. This file is a pointer + summary, not the source of truth — the source of truth is the Notion page below, which Dylan updates continuously as he iterates on the brand kit and screen designs. Check Notion before assuming a screen's current shape.*

**Live Notion page:** [📱 Screens & Features](https://app.notion.com/p/39412384a063815d93ecdc301b4d35ca) (child of the Health Coach hub, sibling to Data Map & Research). Two databases there:
- **Pages** — one row per screen/surface, hierarchical (Home/Training/Map/Nutrition/Groups/Settings are top-level; Reflect, Benchmarks, Templates & Sections, and Gear Quiver nest as sub-pages under their parent via a Parent Page/Sub-pages relation).
- **Features** — one row per individual feature/component, related to its Page, tagged Shipped on main / Built on branch (unmerged) / Designed in mockup only / Constitution-specced only / Needs placement decision / Not started, plus Earth/Sky/Water/Body dimension tags.

## Why this exists
Dylan is mid-redesign of the core screens around a new Columbia River Gorge brand kit, and the design is currently **ahead of the code in some places and behind it in others** — don't assume either direction without checking.

**Important:** the new brand kit's tokens (Archivo/Space Grotesk/Space Mono/DM Sans; Earth `#8A7049` / Sky `#5E84A6` / Water `#4C8E85` / Body `#C15A39`) are **NOT yet in `src/theme/tokens.ts`** — that file still holds an older placeholder system (sandstone/olive/clay/slate; BarlowCondensed/Inter/JetBrainsMono). `planning/brand-kit.md` may be stale against the live Notion mockups — check Notion, not that file, for the current visual direction.

## New nav direction (not yet built)
5 bottom tabs: **Home, Training, Map, Nutrition, Groups.** Reflect, Settings (+ the Ring 3b summoned coach), Benchmarks, Templates & Sections, and Gear Quiver are tap-in surfaces reached from those tabs, not tabs themselves. Current shipped tab bar on `main` is still **Today, Training, Nutrition, Reflect** (4 tabs, no Map, no Groups) — see `app/(tabs)/_layout.tsx`.

## Open decisions (check Notion for current status — these may resolve over time)
1. ~~Does tapping "Session" on the new Home log-bar open the activity picker directly?~~ **Resolved 2026-07-11:** element picker (Earth/Sky/Water/Body); E/S/W → Map Record with most-recent sport armed (pickable before start), Body → Training. See `home-tab-spec.md`.
2. Does GPS capture move to live on the Map tab (vs. inside the session logger)?
3. ~~Where do HealthKit steps/sleep live in the new Home layout?~~ **Resolved 2026-07-11:** on Home, non-headline. See `home-tab-spec.md`.
4. Does the condensed Stimulus Ledger stay on Home now that Reflect is a tap-in? (Home spec leans no — competes with Pinned Spots.)
5. Benchmarks need a new `type` field (Outcome / Compliance / Trend) — schema addition, not built in `src/storage/benchmarks.ts` yet.
6. Benchmarks list layout: grouped-by-domain vs. grouped-by-type — undecided.
7. Templates library layout: two lists (Templates vs. Sections) vs. one unified stream — undecided.

## Gear Quiver (new, tap-in from Settings)
Unified cross-sport gear/equipment tracker — zero code today. Currently gear is being designed bespoke per sport (Notion New Training Database) with no shared entity. Eventual goal: one quiver spanning all sports (item → hours/mileage → service/retire threshold → "what did I use last time"), per the already-researched "five shared primitives" work.
