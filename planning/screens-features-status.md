# Screens & Features — live design status

*Last synced 2026-07-10. This file is a pointer + summary, not the source of truth — the source of truth is the Notion page below, which Dylan updates continuously as he iterates on the brand kit and screen designs. Check Notion before assuming a screen's current shape.*

*2026-07-10 update — tab-by-tab nav planning is underway (Map done, Training done). Each tab gets a Notion page with a Map-style body (Game plan → Vision → MVP build order → Post-MVP → Coming soon → Key questions) and Feature rows tagged `MVP #N` / `POST-MVP` / `FUTURE` in their Notes. See the sections below for what those sessions decided.*

**Live Notion page:** [📱 Screens & Features](https://app.notion.com/p/39412384a063815d93ecdc301b4d35ca) (child of the Health Coach hub, sibling to Data Map & Research). Two databases there:
- **Pages** — one row per screen/surface, hierarchical (Home/Training/Map/Nutrition/Groups/Settings are top-level; Reflect, Benchmarks, Templates & Sections, and Gear Quiver nest as sub-pages under their parent via a Parent Page/Sub-pages relation).
- **Features** — one row per individual feature/component, related to its Page, tagged Shipped on main / Built on branch (unmerged) / Designed in mockup only / Constitution-specced only / Needs placement decision / Not started, plus Earth/Sky/Water/Body dimension tags.

## Why this exists
Dylan is mid-redesign of the core screens around a new Columbia River Gorge brand kit, and the design is currently **ahead of the code in some places and behind it in others** — don't assume either direction without checking.

**Important:** the new brand kit's tokens (Archivo/Space Grotesk/Space Mono/DM Sans; Earth `#8A7049` / Sky `#5E84A6` / Water `#4C8E85` / Body `#C15A39`) are **NOT yet in `src/theme/tokens.ts`** — that file still holds an older placeholder system (sandstone/olive/clay/slate; BarlowCondensed/Inter/JetBrainsMono). `planning/brand-kit.md` may be stale against the live Notion mockups — check Notion, not that file, for the current visual direction.

## New nav direction (not yet built)
5 bottom tabs: **Home, Training, Map, Nutrition, Groups.** Profile is NOT a tab — it's a persistent top-right avatar on every tab (tap-through from any name in Groups too); Settings is a root modal reached via a gear near the avatar. Tap-in surfaces: Reflect, Benchmarks, and the Ring 3b summoned coach; **Gear Quiver** is reached from Profile (moved from Settings, 2026-07-09). **"Templates & Sections" is no longer a standalone tap-in** — it's realized as Training's two modes (Templates / Routes & Sections). Current shipped tab bar on `main` is still **Today, Training, Nutrition, Reflect** (4 tabs, no Map, no Groups) — see `app/(tabs)/_layout.tsx`.

- **Nutrition kept its name** (a brief 2026-07-09 "Body" rename was reverted 2026-07-10). Training + Nutrition are both "body infrastructure" and want a shared *visual* tie (Body accent `#C15A39` in both), but stay separate tabs with separate jobs — not merged.
- **Profile + Home are being treated as parking/overflow destinations, deliberately last.** Retrospective surfaces displaced from the working tabs (logbook, benchmark management, the stimulus view) are tagged "overflow, tab-home deferred" rather than firmly filed — Dylan wants Training/Map/Nutrition fully known before sorting what overflows into Home vs. Profile.

## Training tab — decided 2026-07-10 (Notion "Training" page is authority)
- **Two modes, one top swap: Templates / Routes & Sections.** A shape-vs-place split, not planned-vs-history and not by element. `phase-6-plan-tab-spec.md`'s week-grid / unified-timeline model is **superseded** (see the banner atop that file).
- **No week grid.** Recurrence is a per-template property that surfaces only on Home as an equal-weight "due today" stack (tap → straight into the live session). Miss a day → it clears; empty days neutral.
- **Templates are blank slates.** Numbers prefill from last performance (Strong "Previous" column); progressive overload has zero app suggestion; explicit numeric targets are a *benchmark* concept, not stored on templates. Save-time fork: update the template, or keep a one-off.
- **History left Training.** The session logbook + calendar becomes overflow (Profile candidate, deferred).
- **Benchmark groups** added to the goal layer — pausable, many-to-many bundles (`benchmarks-spec.md` v0.5).
- **Pinned activities** = one preference consumed everywhere (activity picker, Map Record, quick-log).
- Parked for their own sessions: Routes & Sections deep-dive, seasonal/annual benchmark windows, nutrition planning's tab home, indoor-climbing + pool-swim classification.

## Open decisions (check Notion for current status — these may resolve over time)
1. **Overflow placement** — where the logbook, benchmark management, and any resurfaced stimulus view ultimately live (Home vs. Profile vs. back in Training). Deliberately deferred until Map + Nutrition are planned.
2. Home "start something" affordance — one entry that routes Earth/Sky/Water → Map Record, Body → the logger (cross-tab; needs its own Home pass).
3. Where do HealthKit steps/sleep live in the new Home layout?
4. ~~Does the condensed Stimulus Ledger stay on Home?~~ **Resolved 2026-07-10: no.** The stimulus ledger is removed from all visual surfaces (Home included); `core/src/stimulus.ts` engine retained, may return as a Reflect mode.
5. Benchmarks need a new `type` field (Outcome / Compliance / Trend) — schema addition, not built in `src/storage/benchmarks.ts` yet.
6. Benchmarks list layout: grouped-by-domain vs. grouped-by-type — undecided.
7. Templates library layout: two lists (Templates vs. Sections) vs. one unified stream — undecided.
8. Routes-vs-templates data seam — saved route inside the template entity, or a sibling it references? (Routes & Sections session owns this.)

## Gear Quiver (new, tap-in from Profile)
Unified cross-sport gear/equipment tracker — zero code today. **Moved from Settings to Profile (2026-07-09 reframe): now social-facing**, a customizable Profile module rather than a private Settings surface. Currently gear is being designed bespoke per sport (Notion New Training Database) with no shared entity. Eventual goal: one quiver spanning all sports (item → hours/mileage → service/retire threshold → "what did I use last time"), per the already-researched "five shared primitives" work.
