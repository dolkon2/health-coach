# Phase 4 kickoff — mockups in hand, Training splitter, map style swap

**Date:** 2026-07-12 · **Branch:** `main` · **Worktree:** `~/Projects/health-coach`
**Base:** `b131c5f` (Session 10 + its two follow-ups) · **Not committed yet** — see Status.

## What this session did

Read `dev-log/rework-session-10-rebrand-swap.md` and `planning/rework/master-plan.md`'s
Phase 4 section (items 26-31) to confirm Session 10 is settled and see what Phase 4 still
needs. Dylan brought two things: an on-brand 3D map redesign, and updated 5-tab mockups with
the new brand applied. Per instruction, the first step was getting the actual design in hand
before planning further build work.

1. **Imported the design project** via the DesignSync MCP
   (`3d618119-dc01-4d82-a3e9-f73f1eb05490`, the same "Health Coach Design System" project
   Session 10 snapshotted tokens from). Fetched `ui_kits/mobile-app/index.html` +
   `HealthCoachApp.jsx` — a bespoke, self-contained mockup of all 5 tabs — and mirrored both
   into `planning/design-system/ui_kits/mobile-app/`, with a new README section explaining
   what the mockup resolves vs. leaves open (dashed "OPEN ·" badges throughout mark Dylan's
   own unresolved spots).
2. **Built the Training `[Templates | Routes]` segmented switch** Dylan asked for, matching
   Nutrition's Intake/Trend `ChipSelect` pattern exactly (same component, same styling). This
   directly answers master-plan.md Phase 4 item 29's Templates-organization question, though
   it's a distinct, smaller decision than T0/T6's Sections/3a-vs-3b question (still open,
   locked #12 — see the addendum this session added to master-plan.md). Shipped in
   `app/(tabs)/training.tsx`: recent-template chips + Library nest under **Templates**;
   the routes shelf nests under **Routes**; Progress & tools and the pending-removal review
   tray stay unconditional below both (not a Templates-vs-Routes question).
3. **Swapped the MapTiler style** to Dylan's new on-brand style (`019f3285-…`) via
   `.env.local`'s `EXPO_PUBLIC_MAP_STYLE_ID` — a one-line env change, same key. Restarted
   Metro with a cleared cache (env vars are inlined at bundle time, not hot-reloadable) and
   confirmed on-sim: the new style renders cleanly on the pinned MapLibre v10.4.2, sage/moss
   terrain colors matching the mockup's `TerrainMap` reference illustration, no crash.
4. **Updated specs** to record what changed and what this session discovered was already
   stale:
   - `planning/rework/tabs/training-tab.md` — added a 2026-07-12 status note: the splitter
     supersedes §2's "no mode toggle, sections on one screen" framing (which itself reversed
     an earlier 2026-07-10 call), and ⚑1 (landing lead order) turns out to have already been
     resolved differently back in Session 4 (a footer button, not a Start section) — neither
     fact was previously written down.
   - `planning/rework/master-plan.md` — added a dated addendum under the Phase 4 section
     covering items 26-31's real status post-mockup (below), plus a flag that §2's "Nav:
     shipped vs locked" table is stale: `git log` shows the 5-tab shell swap and P8's Reflect
     retirement both shipped *before* this file was written, contradicting its own "shipped
     today: 4 tabs" claim.

## The Phase 4 status, corrected

- **Item 26 (SDK/MapLibre v10→v11)** — still the real blocker for 3D terrain, but now
  partially de-risked: the new style's *palette* renders fine on v10 today (confirmed
  on-sim), so the color half of "on-brand map redesign" already shipped via the env swap
  alone. Only the 3D terrain exaggeration itself needs the upgrade.
- **Item 27 (M5 Explore v1)** — **still gated, not unblocked by this delivery.** This is the
  one correction most worth flagging: the mockup's own Map screen renders a literal
  "OPEN · EXPLORE LAYOUT" placeholder badge for Explore mode. Dylan has not designed Explore
  yet, even in this handoff — only Record-mode chrome reads as settled. Don't read "mockups
  arrived" as "Explore is ready."
- **Item 28 (M6 builder)** — unchanged, still sequenced after M5.
- **Item 29 (Templates organization)** — the segmented-splitter half is done (above); the
  Sections-primitive/3a-vs-3b half (T0/T6) remains fully open, locked #12.
- **Items 30-31** — untouched; still gated on their own ⚑ rulings.

## Verification

- `npx tsc --noEmit`: clean. `npx jest`: **125 suites / 1307 tests** green (unchanged from
  Session 10 — no logic touched, only JSX reorganized).
- **Sim smoke:** Fast Refresh picked up the Training splitter live — screenshotted both
  segments rendering correctly against the empty-library/empty-routes states. Metro
  restarted with `--clear` for the env change; deep-linked to `/map` via
  `xcrun simctl openurl` (`healthcoach:///map`) and screenshotted the new tile style
  rendering (world view — sim has no GPS fix, so no zoomed-in confirmation of the Dog
  Mountain/Columbia River area specifically, just that the style loads and renders its
  land-cover colors correctly).

## ⚑ Flags (for Dylan)

- **✅ RESOLVED (same session) — Explore layout timing.** Dylan: designing Explore is a
  separate session, not this one; Phase 4 planning proceeds without it. M5 stays parked
  until that design lands — nothing Explore-related was built or speculated on here.
- **⚑ Dark-mode toggle still present in the mockup** — cosmetic mockup convenience (session
  10 retired dark mode in the shipped app); not treated as a signal to reconsider that call,
  flagging only in case it wasn't intentional on Dylan's end.
- **⚑ Two carried-forward flags from Session 10, still unruled:** non-artifact color slots
  (caution/positive/modeled/neutral/trendLine collapsed to monochrome — WeekStrip's
  food-logged dot reads as error-red) and Sky/Water element-hue contrast (3.8-3.9:1 on
  white, worse on `bg`) for the 11px `elementTag` caps text. Untouched this session; still
  open.
- **⚑ master-plan.md's own phase-numbering is written mid-stream** against a code state it
  doesn't fully reflect (§2's nav table, per the addendum above) — worth a fresh
  code-inventory pass before treating its "current state" sections as ground truth for
  further Phase 4 planning.

## Status / handoff

- **Not committed.** Changed: `app/(tabs)/training.tsx`, `.env.local` (gitignored, not
  diffable), `planning/design-system/README.md`, `planning/rework/master-plan.md`,
  `planning/rework/tabs/training-tab.md`; new:
  `planning/design-system/ui_kits/mobile-app/{index.html,HealthCoachApp.jsx}`. Per standing
  instruction, commits happen only when explicitly asked — flag if you want this committed.
- Pre-existing untracked files noted in prior sessions' dev-logs remain untouched
  (`planning/nutrition-tab-v2-spec.md`, `planning/rework/research/fable-session-prompts.md`,
  `.claude/skills/`).
- Sim left on the Map tab (world view, no GPS fix), new bundle running under the restarted
  Metro (`--clear`).
- **Next:** a ruling on Explore's design status decides whether M5 planning can proceed;
  the SDK/MapLibre v11 upgrade (item 26) is otherwise the next concretely-scoped Phase 4
  build once Dylan confirms direction.
