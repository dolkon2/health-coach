# Screens & Features — live design status

*Last synced 2026-07-11. This file is a pointer + summary, not the source of truth — the source of truth for design iteration is the Notion page below, which Dylan updates continuously. **For the consolidated rework plan, the source of truth is now `planning/rework/` — start at `planning/rework/master-plan.md`.** The locked decisions of 2026-07-11 recorded here are NEWER than parts of Notion (Notion still carries stale rows — see the note at the bottom).*

**Live Notion page:** [📱 Screens & Features](https://app.notion.com/p/39412384a063815d93ecdc301b4d35ca) (child of the Health Coach hub, sibling to Data Map & Research). Two databases there:
- **Pages** — one row per screen/surface, hierarchical (Home/Training/Map/Nutrition/Social are top-level; Reflect, Benchmarks, Templates & Sections, and Gear Quiver nest as sub-pages under their parent via a Parent Page/Sub-pages relation).
- **Features** — one row per individual feature/component, related to its Page, tagged Shipped on main / Built on branch (unmerged) / Designed in mockup only / Constitution-specced only / Needs placement decision / Not started, plus Earth/Sky/Water/Body dimension tags.

## Why this exists
Dylan is mid-redesign of the core screens around a new Columbia River Gorge brand kit, and the design is currently **ahead of the code in some places and behind it in others** — don't assume either direction without checking. As of 2026-07-11 the full rework is consolidated under `planning/rework/` (8 specs + 5 research docs + master plan); those files supersede same-named framing in older planning docs.

**Update 2026-07-11 (Session 10):** the brand kit's tokens (Archivo/Space Grotesk/Space Mono/DM Sans; Earth `#8A7049` / Sky `#5E84A6` / Water `#4C8E85` / Body `#C15A39`) **have landed in `src/theme/tokens.ts`** — light-only, dark mode retired. `planning/brand-kit.md` is stale by declaration, and `planning/brand-kit-gorge-draft.md` is an *earlier* draft than the kit Dylan cited (it lacks the fonts and all four element hexes). Token-migration mechanics + open flags: `planning/rework/brand-integration.md`; the swap's own dev-log entry has the full judgment-call list.

## Nav direction — LOCKED 2026-07-11 (not yet built)
5 bottom tabs: **Home, Training, Map, Nutrition, Social** (renamed from "Groups"; the Social tab = Feed + Groups sub-sections). **Profile is a persistent top-right avatar on every tab; Settings is a top-right gear — neither is a tab.** Reflect, Benchmarks, Templates & Sections, Gear Quiver, and the Ring 3b summoned coach are tap-in surfaces, not tabs. Current shipped tab bar on `main` is still **Today, Training, Nutrition, Reflect** (4 tabs, no Map, no Social) — see `app/(tabs)/_layout.tsx`.

Locked placements (2026-07-11):
- **Stimulus Ledger: OFF Home** — a highly deferred surface, living in **Settings** as a tap-in (engine retained).
- **Training logbook/history lives on Profile — and the logbook IS the social feed**: shared logbook entries (per privacy scoping) are the feed content.
- **GPS capture lives on the Map tab (Record mode).** Home's "Log Session" opens an Earth/Sky/Water/Body element picker: E/S/W rows lead with most-recent activity and route to Map Record with the sport armed; Body routes to Training template/session selection.
- **Routes are created on Map** (straight-line builder), **browsed on Training**; routes are reusable assets, not history.
- **Pinned Spots glance lives on Home** (moved off Training); HealthKit steps + sleep render as a small, deliberately non-headline strip low on Home (hours + count only; tier-3 sleep scores never shown).
- **Nutrition tab = Intake/Trend split plus a single-metric "Focus mode"**; targets are self-set only — the app never prescribes them.

**⛔ ARCHIVED 2026-07-11:** the alternate "Elements"/HBEGPS tab exploration. Do not revive. (Notion still says "revisit or archive" — this is the archive decision, recorded repo-side.)

## Open decisions (genuinely open — flagged, not to be decided by drift)
1. Benchmarks `type` field (Outcome / Compliance / Trend) — schema addition not built in `src/storage/benchmarks.ts`; in tension with v0.4's "the user never picks a type" entry rule. See `planning/rework/benchmarks-templates.md` §10.1.
2. Benchmarks list layout: grouped-by-domain (2a) vs grouped-by-type (2b) — undecided.
3. Templates library layout: two lists (3a: Templates vs Sections) vs one unified stream (3b) — undecided; plus the definitional gate "what is a Section" (reusable work-block is the only surviving reading — geometry went to Spots/Routes).
4. Social/Groups MVP coordination scope — candidate cut proposed in `planning/rework/tabs/social-tab.md` §7, not decided.
5. Where nutrition adherence-benchmark *history* lives (Trend vs benchmark surface/Reflect remnant vs Profile vs own surface) — undecided.

Resolved since the 07-06 sync (recorded so nobody re-opens them): Home log-bar routing (element picker, locked); GPS on Map (locked); steps/sleep on Home non-headline (locked); condensed Stimulus Ledger off Home (locked — Settings tap-in); logbook location (locked — Profile-as-feed). The full flag roster, including everything smaller, is `planning/rework/master-plan.md` §8.

## Gear Quiver (tap-in from **Profile** — moved from Settings 2026-07-09)
Unified cross-sport gear/equipment tracker. No unified UI yet, but **no longer zero code at the data layer**: `gear`/`kits` tables + `src/storage/gear.ts` (Water arms) and `skyGear.ts` shipped in migration 014; Earth arms (shoes, bikes, skis) are a future additive migration. Eventual goal unchanged: one quiver spanning all sports (item → hours/mileage → service/retire threshold → "what did I use last time"). Rework owner: `planning/rework/tabs/profile-settings.md` (pass P9).

## Notion staleness note
Notion rows known to lag the 2026-07-11 locks: the Body-tab / "Nutrition (folds into Body)" rows (pre-reversion), "HealthKit steps + sleep — Needs placement decision" (resolved), Pinned-Spots-on-Training mount note (moved to Home), the Map page's "history stays on Training" line (logbook is on Profile), Benchmarks "zero display UI" (read: zero *redesigned* UI — `app/benchmarks.tsx` ships today), the Brand Redesign Planning row still named "Groups", and the blank-but-"Done" Brand Kit page (not an authority for any visual value).
