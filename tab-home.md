# Home Tab

Today at a glance — the daily loop: open, see today, log, leave. Not a dashboard, not a feed; a glance surface that routes into the depth tabs (Training, Map, Nutrition) for anything more than a quick look.

## Current shape / status

- Bottom nav position: 1st of 5 (Home · Training · Map · Nutrition · Social).
- Currently shipped tab bar on `main` is still **Today, Training, Nutrition, Reflect** (4 tabs) — the 5-tab Home/Training/Map/Nutrition/Social nav is not yet built.
- Glance-module list **locked 2026-07-11** in Notion, but the module ordering and the corresponding `home-tab-spec.md` build spec referenced from Notion **could not be found in the repo** — flag: either it hasn't landed yet or the branch (`claude/home-tab-design-m6zvni`) hasn't merged. Treat the module list below as the best current source, not a stable build doc.
- Persistent avatar (top-right → Profile) and gear icon (→ Settings) are a new pattern, not started.

## Structural pieces / modules

Per the locked 2026-07-11 glance-module list:

1. **Nutrition today** — calories + target progress, Focus-mode aware (reads the Nutrition tab's focus lens if set).
2. **Pinned Spots glance** — condensed cards for go-to places (conditions), moved here from Training on 2026-07-11. Layout (condensed cards vs. a "Spots →" link) still open.
3. **Today's tagged template** — auto-surfaces a due recurring template (Training's per-template recurrence rule), one tap into logging.
4. **Benchmark progress** — pinned benchmarks headline strip; behavior face reads as a factual count ("kayak: 2/4 this week"), outcome face as an observation ("trending down, 1.2 kg to go").
5. **Steps + sleep** — non-headline, small, low on the page. Hours + count only; tier-3 sleep *scores* stay off Home entirely (feeds the expenditure engine more than the eye).

Other persistent pieces:
- **Two-button log bar** — "Log Session" / "Log Food" (redesign of the existing single quick-log entry point).
- **Persistent top-right avatar** → Profile; **gear icon** → Settings.

Explicitly **absent** from Home (moved elsewhere): logbook/recent-logs (→ Profile), condensed Stimulus Ledger (lean-yes eviction, not final).

Optional modules render as *absent, not empty* when untracked — no grey placeholder cards, no implied guilt for not tracking something.

## Full-screen features needing their own design pass

### Log Session → element picker
Tapping "Log Session" opens an Earth/Sky/Water/Body element picker:
- Earth/Sky/Water rows lead with the user's most-recent activity in that element; sport is pickable inline (via a chevron/expand) before starting. Selecting routes to **Map Record** with that sport armed.
- Body routes to **Training** template/session selection.
- Needs its own design pass: row layout, inline sport-swap affordance, and the "arm and hand off to Map" transition.

### Log Food
Opens the existing food logger (Weigh / Describe / Barcode-later / Photo-reserved). Reuses `food-logging-spec.md`'s input contract; no new design surface expected beyond entry-point styling.

### Day-zero / onboarding state
What Home looks like before any data exists — all five glance modules empty/absent simultaneously. Not designed yet; flagged as still open in Notion.

## Open decisions

- Module ordering among the 5 locked glance modules — not yet decided.
- Whether the template↔benchmark card merges into one card or stays two.
- Whether the condensed Stimulus Ledger is fully evicted from Home (current lean: yes).
- Day-zero onboarding state — not designed.
- Pinned Spots glance layout: condensed cards vs. a "Spots →" link; whether it sits alongside or replaces the Stimulus Ledger slot.
- Whether tapping "Session" opens the activity/element picker directly or via an intermediate step (older open item, likely resolved by the element-picker spec above — confirm).
- Referenced build doc `planning/home-tab-spec.md` was not found in the repo at time of writing — confirm it has landed before treating any of the above as final.

## Out of scope

- No AI-authored programming or suggested content on Home (ambient surface — ties to the constitution's "summoned coach lives in its own room" rule).
- No streaks/badges/gamified treatment on the benchmark or template modules.
- No GPS recording UI on Home itself — recording lives on Map; Home only arms and routes to it.
- Recent-logs/logbook list — lives on Profile, not Home.

## Sources used

- Notion: "Pages and Features" (Quick visual map, Home section + open decisions), Notion search for a dedicated Home page (none found beyond the summary above).
- Repo: `planning/screens-features-status.md` (nav status, open decisions list), `planning/benchmarks-spec.md` (benchmark card behavior/outcome rendering), `planning/pinned-spots-spec.md` (Spots glance origin/mechanics), `planning/training-logging-spec.md` (activity picker precedent), `CLAUDE.md` / `planning/claude-md.md` (constitution: pull-not-push, no gamification, four dimensions).
- Gap: `planning/home-tab-spec.md`, referenced repeatedly in Notion as the authoritative build spec, does not exist in this repo checkout.
