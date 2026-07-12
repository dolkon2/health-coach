# Phase 4 kickoff — handoff to the next session

**Date:** 2026-07-12 · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Base:** `b131c5f` · **⚠️ Nothing from today is committed** (see Git status below).

## What shipped today (uncommitted, in the working tree)

Three rounds of work, in order:

1. **Design import + Training splitter** — imported the `ui_kits/mobile-app`
   mockup, mirrored it into `planning/design-system/`, built Training's
   `[Templates | Routes]` segmented switch + segment-aware footer, swapped the
   MapTiler style to your new on-brand style ID. Full detail:
   `dev-log/rework-phase4-01-mockups-and-training-splitter.md`.
2. **Makeover reconciliation** — checked the design project's reference
   components against what's actually shipped, fixed 5 stale ones (still had
   the kit's original body-rust CTA color, not your monochrome call), added
   an element-color dot to `SpotCard`, ported the design system's 28-icon
   activity glyph library (replacing generic lucide icons everywhere —
   Training tiles, the template picker, Map's sport chip, Spots). Full
   detail: `dev-log/rework-phase4-02-icon-glyph-port.md`.
3. **Persistent button system** (this pass, not yet its own dev-log entry) —
   Home's Log Session/Log Food, Training's footer action, and Nutrition's Log
   food all now share one `PillActionButton` component
   (`src/components/PillActionButton.tsx`): a quiet pill with a small glyph
   (◆ for session actions, ▲ for food), pinned above the tab bar via
   `Screen`'s `footer` prop instead of scrolling inline. Home's glance tier
   also reordered — Nutrition now leads, ahead of Spots. Tab bar icons
   swapped from generic lucide icons to the brand's own ring/diamond/
   dot-path/triangle/two-circles vocabulary (`app/(tabs)/_layout.tsx`).
   Hit and fixed a real bug along the way: `PillActionButton`'s `flex: 1`
   needs a `flexDirection: 'row'` parent to size correctly — the single-button
   footers (Training, Nutrition) were missing that wrapper and rendering with
   invisible label text. Fixed in both.

Verified throughout: `npx tsc --noEmit` clean, `npx jest` 125 suites / 1307
tests green, confirmed live on-sim (screenshots) and on Dylan's physical
iPhone via the LAN dev-client connection.

## Git status

**Committed and pushed — `main` is now the furthest-along state, on
`origin/main` too.** Four commits landed everything from today's four passes
(icon library + component fixes, mockup import + docs, the persistent
button system + Training splitter + macro bar, and this handoff doc). See
`git log` for exact SHAs — written before the push, so this file doesn't
hardcode ones that could go stale.

## Shipped this session (not a quirk list anymore — these are done)

### Home's Nutrition card: macro bar

Added — a compact protein/carb/fat bar under the kcal number
(`MacroBar` in `app/(tabs)/index.tsx`). One correction to what this file
said earlier today: Nutrition's own Intake screen did **not** already have
this bar (I'd misremembered — its "Daily total" card is plain P/C/F text,
no color). This is genuinely new, built fresh: colors follow `chartSeries`'
own stated macro-breakdown order (`tokens.ts`'s comment: "rust, teal, ochre,
then sky") — protein/carb/fat map to body/water/earth, not invented hues.
Renders nothing when every macro is unknown (honest — no fabricated even
split). **The target number (`/ 2,400 kcal`, `260 left`) still isn't
built** — that's N2, genuinely deferred, blocked on the PRO-63 benchmarks
branch merging. Don't add a target without building N2 for real; a
hardcoded or guessed number would violate this app's honesty rules.

Hit the same Fast Refresh bug a third time adding this (new top-level
component in a file with other changes) — full Metro restart fixed it, same
as the two prior incidents this session.

### "How do I pin spots?" — answered, not a bug

There's no standalone "add a spot" flow yet. Today, spots are created
**inline while logging a Water or Wind session** — `SpotPicker`
(`src/components/surface/SpotPicker.tsx`), embedded in the Whitewater/Wind
session form: type a name, and either search a USGS gauge by name (river
spots — kayak, whitewater, paddle) or enter lat/lng manually (launch spots —
paragliding, wingfoil, etc.). It's deliberately barebones — the file's own
comment says so: **"a map-pin picker is redesign territory."** A proper
map-based pin/save-as-spot flow is real work, not a bug fix, and naturally
pairs with the Map Explore/builder work that's already gated on your
Explore design.

## Phase 4 sequencing — answering "should I knock these out first" / "isn't Phase 4 just planning"

Phase 4 is **not** purely a planning session — it's a mix:

- **Item 26 (SDK 53→56 + MapLibre v10→v11) is real, unblocked engineering
  work you can start right now.** It's also the literal prerequisite for the
  3D map you just asked for — the pinned MapLibre v10.4.2 doesn't support
  the terrain APIs the 3D look needs. This is the one part of Phase 4 that's
  concrete build work, not a decision waiting on you.
- **Items 27 (Explore v1) and 28 (M6 route builder)** are gated on your
  Explore design — your own call to do that as a separate session, still
  true.
- **Items 29 (Sections/3a-3b), 30 (benchmark groups/type), 31 (Gear Quiver)**
  are all genuinely gated on rulings only you can make (locked #12 and
  friends) — these really are "planning session" territory, not build-now
  territory.

**Recommendation:** start the SDK/MapLibre v11 upgrade next — it's
unblocked, concrete, and it's what actually gets you to a 3D map. Spot-pin
discoverability (the other open item above) is a quick separate pass
whenever — small, doesn't block anything.

## Suggested next-session starting point

Bring this file. The natural next ask: **"Start the SDK 53→56 + MapLibre
v11 upgrade"** (item 26) — concrete, unblocked, and the actual prerequisite
for the 3D map. No more discovery work needed first; this file plus a fresh
`git log` is enough context to start cold.
