# Profile (screen, not a tab)

Customizable identity + history surface — the full training logbook, gear quiver, and the user's own stated benchmarks, filtered by privacy scoping. **Not one of the 5 bottom-nav tabs** (Home, Training, Map, Nutrition, Social). Reached via a persistent top-right avatar icon on every tab (self-view), or by tapping any name/avatar inside Social (their view, projected through their privacy grants). A separate top-right gear icon reaches Settings — private configuration and parked machinery — kept deliberately apart from Profile since Profile is public-facing and Settings isn't.

## Current shape / status

- **Not started.** Zero code (per the tab-social.md stub, `screens-features-status.md`, and the Notion "Profile" page's own `Status: Not started` property).
- Nav type: Root / Modal, position 7 in the Notion Pages database. Locked 2026-07-09 after several passes (tab-vs-no-tab, avatar-on-Home vs. persistent-top-right).
- The dedicated Notion "Profile" page exists but its body is **blank** — only summary properties carry content (see Sources). Two other Notion pages titled "Profile" or "9 — Profile" turned up in search and are also blank/superseded stubs from earlier planning passes (2026-07-06/07), superseded by the 2026-07-09 page.
- The real detail lives in **`planning/rework/tabs/profile-settings.md`** and its companion **`planning/rework/research/profile-logbook.md`**, both dated 2026-07-11 — but both exist only on the unmerged remote branch `claude/product-rework-planning-7gblvl` (repo `dolkon2/health-coach`), fetched here via `git show origin/claude/product-rework-planning-7gblvl:<path>`. Neither file is present in this repo checkout (`main` / current branch). Same gap pattern as tab-social.md's missing `social-tab-spec.md` — flagging rather than guessing at contents.
- Per the Notion "Product Rework — Master Plan (Consolidated 2026-07-11)" page: Profile is one of 8 specs covering the rework; build passes are **P1–P9**, sequenced after the 5-tab shell swap. Locked decisions treated as fixed by that plan: (1) Profile = persistent top-right avatar, Settings = top-right gear, neither is a tab; (2) the Stimulus Ledger lives in Settings, not Profile; (3) **the training logbook lives on Profile — and the logbook IS the social feed** (shared entries, per privacy scoping, are the Social feed's content).

## Structural pieces / modules

Self-view, top to bottom (per `profile-settings.md` § 2, cross-checked against `cohorts-spec.md` § Profiles):

1. **Identity header** — avatar image, display name, one-line blurb, element-identity strip (Earth/Sky/Water/Body chips). All fields optional; all social-facing fields carry per-field visibility toggles (private by default).
2. **Logbook** (the screen's center of gravity) — two views on one toggle: chronological windowed list, and a calendar (month grid, checkmark days, precedent: Strong-style). Entry tap opens session detail (map-hero when a GPS track exists, shared rendering with Map's session detail and Social's shared session detail). Each entry carries a **share/audience control** once the backend/cohorts era lands.
3. **Current benchmarks card** — the user's own words; `cohorts-spec.md` calls this the social layer's "social atom." Display only; creation/management stays on Training (per `benchmarks-spec.md` § Three surfaces). Ships as a default, removable module.
4. **Gear Quiver module** — preview + tap-through to the full quiver. Moved here from Settings 2026-07-09 because it's social-facing (cross-sport item → hours/mileage → service/retire threshold → "what did I use last time").
5. **Past (archived/completed) benchmarks** and **connections/friends list** — slot below; both flagged open on placement (see Open decisions).
6. **"Preview as"** — see your own profile as a chosen audience sees it; the legibility mechanism for privacy scoping (backend/cohorts era).

Outward view (someone else's Profile, as seen by you) = the same layout minus everything not granted to your audience tier. A legitimately empty profile is a valid render — not an error state.

**Privacy / field-level toggles** (`cohorts-spec.md` § Profiles, the load-bearing privacy principle):
- **Fully private by default. Nothing is public until the user explicitly opts in**, field by field.
- **Defaults shown** (once opted in): training split/routine, nutrition approach (not detailed macros — just what they're doing), current benchmarks (in the user's own words, from Reflect).
- **Optionally added/removed:** any stat or data surface. If you don't track nutrition, there's no card for it — no blank card implying you should.
- Scales with cohort size: a 5-person friend group carries implicit trust; a 500-person creator cohort does not — the same toggles have to hold at both scales.
- Visibility must be a **permission change, not a schema migration** — the underlying Session/Observation data model needs to support per-field/per-entry sharing grants from early on, even before cohorts ship (Ring 4 forward-reference in `claude-md.md`).

**Modules render "absent, not empty"** when untracked — no grey placeholder cards, no implied guilt (same rule tab-home.md uses for its glance modules).

## Full-screen features needing their own design pass

### Profile edit / customization flow
Editing blurb, avatar, element-identity chips; adding/removing/reordering modules. No module is mandatory beyond the identity header.

### Privacy toggle management
Field-level public/private controls, per-module and (once the logbook is shareable) per-entry. Needs its own UI: where toggles live relative to each module, how defaults are surfaced at first opt-in, and how a user audits "what's currently visible to whom."

### Public-facing profile view (as seen by others)
The outward render, filtered by the viewer's audience grant. Needs a "preview as [audience]" mode so privacy scoping is legible rather than trusted blindly.

### Logbook (chronological + calendar)
The screen's largest surface — windowed session list and a month-grid calendar, both feeding into shared session-detail rendering. This is also the literal source of the Social Feed's content, so its layout decisions ripple into Social.

### Session detail (shared rendering)
Map-hero when a GPS track exists, stats-only otherwise (never a fabricated line where there's no data) — shared component with Map and Social, but Profile is one of its three entry points.

### Gear Quiver tap-through
Full quiver view reached from the Profile preview module (spec detail lives in `screens-features-status.md`'s Gear Quiver section — cross-sport, zero code today).

### Connections / friends list
Who you follow/are followed by — mechanic (mutual vs. asymmetric) not yet decided; surfaced here because "who I am to others" reads as identity, per Strava precedent.

## Open decisions

- **Group ↔ cohort / friends mechanic** — mutual-friend vs. asymmetric follow, not yet decided (`cohorts-spec.md` Open questions #1).
- **Completed/archived benchmark history placement** — Profile (the arc of past goals) vs. Reflect (the story of a benchmark); current lean is a list on Profile that tap-throughs into Reflect's rendering, but this is explicitly undecided.
- **Nutrition adherence-benchmark history placement** — Profile, Nutrition › Trend, or Reflect via tap-through only; genuinely open, no call made. Nutrition is flagged as the most private data class, which cuts against defaulting it onto the social-facing Profile.
- **Benchmark-group management placement** — Profile is the named candidate but undecided (carried from `benchmarks-spec.md` v0.5).
- **Reflect's door(s) from Profile** — current lean is both a Home deep-link and a Profile browsable "Reflect →" entry, since Reflect becomes a routed tap-in rather than a tab; not finalized.
- **Summoned coach door** — Settings › Coach (the current spec's build target) vs. a Profile-sheet entry (semantically "mine," grounds in the same data Profile fronts) — explicitly flagged as unresolved before Phase 7; also open in `benchmarks-spec.md`.
- **Visibility schema seam** — a separate sharing-grant layer keyed by observation id (recommended) vs. a visibility field on the record itself; affects how early session/benchmark data must be built with sharing in mind.
- **Does the outward (non-self) Profile view get built pre-backend at all**, or is Profile self-view-only until accounts/cohorts ship? Current lean: self-only; "preview as" is meaningless before audiences exist.
- **Logbook filtering scope at first build** — plain chronological + calendar only, vs. per-dimension/per-activity filters from day one. Current lean: plain first.
- **"Add friend" entry point** once accounts exist — Profile, Settings, or a Social-tab affordance; carried as an open question from the social-layer research.
- Full detail on all of the above lives in `planning/rework/tabs/profile-settings.md` §§ 8–9, which — per the repo-gap note above — has not yet landed in this checkout's `planning/` directory.

## Out of scope

- **Global leaderboards, ranks, percentile scores, or any cross-user competitive ranking on Profile** — refused per constitution rule 5 and `cohorts-spec.md`; only cohort-internal, time-bound challenge leaderboards exist anywhere in the product, and they don't live on Profile.
- **Badges, trophies, streak-as-identity, or completion percentages** — the documented failure modes to avoid are 8a.nu (profile-as-scorecard, which measurably changed people's actual climbing to chase points) and Duolingo (profile-as-trophy-shelf: streaks, XP, leagues, achievement badges, tied to documented compulsive-engagement costs). The governing test: **a Profile module may render only things that already exist in the world** — sessions, gear, user-written benchmarks, factual totals pass; anything app-authored as a reward fails.
- **A consistency-count promoted to profile-identity headline** — a factual streak/count may appear *inside a benchmark's own history* as a revealed fact (per `benchmarks-spec.md` § Consistency counters), but it is never promoted to a Profile headline stat the way Duolingo promotes "longest streak."
- **Notification badges/unread dots on the avatar** — an indicator on a persistent header control is a push mechanism wearing an icon; refused outright regardless of how Social's own notification questions resolve.
- **Routes library** — explicitly does *not* live on Profile; this is a deliberate rejection of the Strava routes-under-profile pattern. Routes are browsed on Training, created on Map.
- **Any logging/write path** — Profile is read-only history; the daily log-session/log-food loop stays tab-side (Home/Map/Training/Nutrition). Nothing needed mid-workflow may live only behind the avatar.
- **Detailed macro breakdowns as a public default** — the nutrition-approach default is a description of approach, not a public macro ledger; detailed nutrition data stays opt-in like everything else.
- **Any app-authored suggestion of what to show/hide** — the app never nudges the user toward making something public; opt-in is the user's initiative alone.

## Sources used

- **Notion:**
  - "Profile" page (id `39812384-a063-81ae-8a60-d3c5c9fd0ead`), locked 2026-07-09 — summary properties only (Nav Type, Reached From, Status, Summary); page body blank.
  - "Pages and Features" hub (`39412384-a063-815d-93ec-dc301b4d35ca`) — Quick visual map's 🪪 Profile and ⚙️ Settings rows, plus the constitution note on shareable body-change content (landed 2026-07-10 in `planning/claude-md.md`).
  - "Product Rework — Master Plan (Consolidated 2026-07-11)" (`39a12384-a063-8192-8683-d62d2e31f034`) — Profile's place in the 8-spec rework, build passes P1–P9, and the full ⚑ flag roster (items on benchmark history, Reflect's door, coach door, visibility schema, audience model).
  - "Settings" page (`39412384-a063-81b7-9d72-ddca2cc87927`) — for the Profile/Settings split (private vs. public-facing content).
  - Two older/blank "Profile" stubs (`39612384-a063-80c0-8521-fa273284bef1`, `39512384-a063-817b-a913-da9683e11aac`) found via search — superseded, no content, noted for completeness.
- **Repo (this checkout):** `planning/cohorts-spec.md` (§ Profiles — the primary spec: defaults, privacy principle, constitutional reconciliation, build implications, open questions), `planning/screens-features-status.md` (nav status, Gear Quiver section), `planning/benchmarks-spec.md` (benchmark surfaces, consistency-counter rule, Reflect placement questions), `CLAUDE.md` / `planning/claude-md.md` (constitution — no gamification, pull-not-push, evidence tiers, four dimensions), `tab folder for design/tab-social.md` (existing Profile stub, starting point for this doc), `tab folder for design/tab-home.md` (format/structure reference, "absent not empty" module convention).
- **Repo (unmerged remote branch, fetched via `git show origin/claude/product-rework-planning-7gblvl:<path>`, not present in this checkout):** `planning/rework/tabs/profile-settings.md` (the authoritative 2026-07-11 consolidated Profile + Settings spec — layout, components/states, data touchpoints, build passes P1–P9, flagged concerns) and `planning/rework/research/profile-logbook.md` (precedent research — Strava, 8a.nu, Duolingo, Slopes — and the Profile/Settings/tab-side assignment table). **Gap flagged:** these files do not exist on `main` or the currently checked-out branch; this doc pulls their content directly since they're the fullest available source, but they should be reconciled into `planning/` before being treated as settled.
