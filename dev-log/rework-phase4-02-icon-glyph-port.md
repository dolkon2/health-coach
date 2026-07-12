# Phase 4 follow-up — makeover reconciliation: Spots dot, activity glyph port

**Date:** 2026-07-12 · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Base:** on top of `rework-phase4-01-mockups-and-training-splitter.md`'s
changes (still uncommitted) · **Not committed yet.**

## What this session did

Dylan had claude.ai/design produce a full makeover of `ui_kits/mobile-app`,
informed by the ground-truth fixes and gap brief from the prior session
(`makeover-brief.md` in the design project). Before implementing, checked the
mockup against actual shipped code — most of it turned out to **already be
built**, in some cases (Settings, Profile) more thoroughly than the mockup
itself. Rather than rebuild working screens from a mockup, this pass closed
the two genuine gaps and left everything already-correct alone. Went through
`EnterPlanMode` given the cross-cutting scope; plan approved before touching
code.

**Confirmed already implemented, not touched:** Nutrition Trend
(`WeightTrendChart`/`WeighInHistory`), `app/profile.tsx` (identity, Logbook
List/Calendar toggle, benchmarks, gear), `app/settings.tsx` (10+ sections,
ahead of the mockup's 3), Training's `[Templates | Routes]` splitter
(previous session), Map's Record pre-start panel, `RouteCard`'s SVG preview
thumbnails, the shell's persistent header cluster.

### 1. Element-colored Spots on Home

`SpotCard.tsx` rendered a plain monochrome row — no element color, unlike
`RouteCard.tsx`'s existing precedent. Tinted the sport icon with
`theme.colors.element[elementOf(activityById(spot.sport))]`, mirroring
`RouteCard` exactly rather than inventing a third visual pattern (a separate
dot, as the mockup's inline demo used).

**Deliberately not touched: `BenchmarkStatusCard`.** `core/benchmark.ts`
carries no activity/element field — many benchmarks span dimensions (a
calorie ceiling isn't Earth/Sky/Water/Body). Inventing an element color here
would misrepresent cross-dimension benchmarks. Flagging as a data-model
question, not building a guess.

### 2. Custom activity icon library (28 glyphs, ported per Dylan's "port it now")

Replaced the ~10 generic lucide icons (grouped by broad category — one
`Waves` icon covering paddle/surf/kayak/whitewater/sup/canoe/row/swim) with
the design system's 28 brand-specific geometric glyphs, one per activity.

- **New `src/components/activityGlyphs.tsx`** — ported the 28 SVG path defs
  from `ui_kits/mobile-app/activityIcons.jsx` from DOM SVG
  (`React.createElement('path', ...)`) to React Native SVG primitives
  (`Svg`/`Path`/`Circle`/`Ellipse`/`Line`, `react-native-svg` — already a
  dependency, matching `RoutePreview.tsx`'s import convention). Rotated
  ellipses use RN-SVG's dedicated `rotation`/`originX`/`originY` props rather
  than a transform string. `ActivityGlyph({ glyphKey, color, size,
  strokeWidth })` is the render surface; shapes get array-index `key`s via
  `cloneElement` since the source defs don't key their own elements.
- **`src/lib/activity.ts`** — updated every `Activity.icon` value from the
  lucide vocabulary to the new glyph-key vocabulary. 4 ids needed renaming
  (`trail-run`→`trailRun`, `mtb`→`mountainBike`, `ski-touring`→`skiTouring`,
  `xc-ski`→`xcSki`); 13 activities have no bespoke glyph in the 28-icon set
  and fall back to a documented sibling (cosmetic reuse, not fabricated data):
  `strength`/`crossfit`→`gym`, `paddle`/`surf`/`sup`/`canoe`/`row`→`kayak`,
  `paragliding`/`hikeAndFly`/`speedflying`/`parakiting`→`parawing`,
  `pilates`/`martial-arts`→`mobility`, `meditation`→`breathwork`,
  `skate`→`walk`. Updated the field's doc comment.
- **`src/components/activityIcons.tsx`** — rewrote the internals only.
  `iconFor(name): IconCmp` and `spotIcon(spot): IconCmp` kept their exact
  signatures — every consumer needed zero changes. Icon components are built
  once at module load into a stable per-key map (not a fresh closure per
  `iconFor()` call), so an icon's component identity doesn't change across
  renders. `spotIcon`'s no-sport fallback stays lucide's `MapPin` — a location
  marker, not an activity glyph, so it's not part of the port.
- **`app/edit-template.tsx`** — found and fixed a pre-existing inconsistency
  while touching this file: it had its own duplicate local lucide `ICONS` map
  instead of using the shared `iconFor()`. Deleted the local map and its
  lucide imports; now reuses `iconFor()` like every other consumer.
- **3 leftover hardcoded fallbacks caught by grep, not by tsc/jest** (a
  string literal, so nothing type-checks or tests against it):
  `app/(tabs)/training.tsx`, `TemplateCard.tsx`, and `ElementPickerSheet.tsx`'s
  `BodyRow` all had `?? 'dumbbell'`/`iconFor('dumbbell')` — no longer a valid
  glyph key, would have silently fallen through to the generic `hike`
  triangle. Fixed all three to `'gym'`.

## Verification

- `npx tsc --noEmit`: clean. `npx jest`: **125 suites / 1307 tests** green,
  unchanged — confirms no test hardcoded an old lucide icon-name string.
- `grep` swept for every retired lucide key (`'dumbbell'`, `'footprints'`,
  `'bike'`, `'mountain'`, `'waves'`, `'wind'`, `'snowflake'`, `'flower'`,
  `'backpack'`, `'heart-pulse'`) across `app/` and `src/` — the only hits
  left are unrelated domain terms (gear category `'bike'`, the `wind` session
  form field), not icon references.
- **Sim smoke, live on the running Metro instance** (deep-linked via
  `xcrun simctl openurl healthcoach:///…`, since Simulator taps aren't
  available to this session — see the ⚑ below):
  - `/edit-template` — the "What kind of thing?" activity grid renders Gym
    (dumbbell shapes), Run (footprint ellipses + swoosh), Ride (wheel-frame +
    dot), Climb and Hike (mountain triangles) correctly.
  - `/training`, Routes segment — `RouteCard` icons render the new glyphs
    *and* tint by element: the kayak route in Water teal, the hike route in
    Earth tan.
  - `/map` — the sport-arm chip renders the new kayak glyph in place of the
    old lucide waves icon.
  - Not verified: Home's Spots cards (zero spots seeded, nothing to
    screenshot) and the element-picker sheet (a tap-triggered modal — see ⚑).
    Both use the exact same `iconFor()`/element-tint code path already
    confirmed working on Routes and Map, so risk is low.

## Addendum — same session, Home footer + reorder (after live sim/phone review)

Dylan connected his physical iPhone to this Metro instance directly (LAN URL,
since the app needs a custom dev client — not Expo Go) and reviewed Home
against a mockup screenshot side-by-side. Two more changes landed:

- **Log Session / Log Food became a persistent footer**, using `Screen`'s
  existing `footer` prop (the same mechanism as Training's footer button,
  not a new pattern) — pinned above the tab bar instead of scrolling away
  with the content. Bespoke pill buttons (`LogBarButton` + small
  `DiamondGlyph`/`TriangleGlyph`), not the shared `Button` component — the
  mockup's quiet dual-button look doesn't match any of `Button`'s existing
  variants, and adding a new variant there would ripple into every screen
  that imports it.
- **Nutrition now leads the glance tier**, ahead of Pinned Spots (was
  Spots → Nutrition → Benchmarks; now Nutrition → Spots → Benchmarks).
  `app/(tabs)/index.tsx`'s spacing was adjusted so Spots picks up the
  smaller top margin when Nutrition is absent (no food logged yet).
- **Hit a stale Fast Refresh error mid-verification**: removing the
  `Button` import and adding new top-level components triggered `Property
  'Button'/'LogBarButton' doesn't exist` — a known Fast Refresh limitation
  (in-place patching loses track of removed/added module bindings), not a
  real bug; tsc and jest were both clean throughout. Fixed by a full Metro
  restart (`--clear`), same as the two prior restarts this session.
- Verified: tsc clean, 1307 tests green, sim screenshot confirms the footer
  renders correctly with both glyphs and the reordered sections.

## ⚑ Flags

- **⚑ Simulator tap automation unavailable this session** — the
  computer-use `request_access` tool doesn't resolve "Simulator" as an app
  name in this environment (tried 3x across this session), even though the
  process is confirmed running via AppleScript. All verification routed
  around it via `xcrun simctl openurl` deep links to real routes; anything
  gated behind a modal/sheet tap (element-picker sheets, the template-picker
  overlay) couldn't be screenshotted directly.
- **⚑ `BenchmarkStatusCard` has no element mapping** (see above) — a
  product/data-model question, not decided here.
- **⚑ Icon fallback choices are a judgment call** — 13 activities reuse a
  sibling's glyph (documented in `activity.ts`'s inline comments and above).
  Purely cosmetic, easy to swap individually if any read wrong once seen on
  real device.

## Status / handoff

- **Not committed** (same standing pattern as the prior session — commits
  happen only when explicitly asked). Changed:
  `app/(tabs)/training.tsx`, `app/edit-template.tsx`,
  `src/components/{ElementPickerSheet,SpotCard,TemplateCard,activityIcons}.tsx`,
  `src/lib/activity.ts`; new: `src/components/activityGlyphs.tsx`.
- Home's header composition (big date headline vs. the mockup's small label)
  was deliberately left untouched — a content-density choice from an earlier
  build pass, not a bug; changing it felt like a judgment call beyond what
  was asked, so flagging instead of silently rewriting it.
- Sim left on the Map tab (world view, no GPS fix), same Metro instance as
  the prior session (still running with `--clear` from the MapTiler style
  change).
- **Next:** whenever Dylan can drive the Simulator himself, worth a quick
  look at the element-picker sheet and template-picker overlay specifically,
  plus Home's Spots cards once a spot exists to seed one.
