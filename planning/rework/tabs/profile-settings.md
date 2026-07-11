# Profile + Settings — consolidated spec (top-right tap-ins)

*2026-07-11. Part of the coordinated rework set under `planning/rework/tabs/`. Some sibling
specs reference this file as `profile.md` — same document. Primary research:
`planning/rework/research/profile-logbook.md` (precedents + assignment table);
companions: `social-feed-groups.md` (audience model), `cohorts-spec.md` § Profiles.
Locked decisions applied as fact: #1 (Profile = persistent top-right avatar, Settings =
top-right gear, neither is a tab), #2 (Stimulus Ledger OFF Home, lives in Settings as a
tap-in), #3 (training logbook lives on Profile — and the logbook IS the social feed).*

## 1. Purpose & constitution alignment

Profile is the *identity and history* surface: the full training logbook (all dimensions,
chronological + calendar), the gear quiver, and the user's own stated benchmarks — a
projection of the user's own data filtered by privacy scoping, never a separate data
structure (`cohorts-spec.md`). Settings is *private configuration and parked machinery*:
preferences, integrations, engine inputs, and deferred views. The constitution binds both
hard: Profile modules may render only things that already exist in the world — sessions,
gear, totals, user-written benchmarks — never a badge, rank, score, streak-as-identity, or
completion percentage (8a.nu and Duolingo are the documented failure modes in
`profile-logbook.md` § 1). The avatar and gear never badge — an unread dot on a persistent
header control is a push mechanism wearing an icon. And nothing needed mid-workflow lives
only behind either affordance: the daily loop (log bar, Record, glance modules) stays
tab-side; Profile holds the read path, never the write path.

## 2. Information architecture / layout

### Header cluster (every tab)

Avatar + gear form a fixed right-side cluster on every tab's header; tab-specific controls
take left/center or the tab body (Decision (obvious call), from `profile-logbook.md` § 2 —
two persistent targets is the ceiling). Today's code has only the gear
(`app/(tabs)/_layout.tsx` `headerRight`); the avatar is new.

### Profile (avatar → pushed screen)

Top-to-bottom, self-view:

1. **Identity header** — avatar image, display name, one-line blurb, element-identity strip
   (the four dimension chips, tinted by the future `elements` token group — mechanics only,
   locked #13). All fields optional; all social-facing fields carry per-field visibility
   toggles when the backend era arrives (private by default).
2. **Logbook** (the tab's center of gravity, locked #3) — two views, one toggle:
   chronological windowed list, and a Strong-style calendar (month grid, checkmark days).
   Entry tap → session detail (map-hero when a track exists; rendering shared with Map's
   session detail and Social's `SharedSessionDetail`). Post-Social-S2, each entry carries
   the **share control** (`social-tab.md` S2 — the UI lives here, the grant store is
   Social's). Descriptive summaries only; the `reveal()` contribution string stays off the
   card (per the Notion session-history relocation note).
3. **Current benchmarks card** — the user's own words, `cohorts-spec.md`'s "social atom."
   Display only; management stays elsewhere (⚑5). Decision (obvious call): this ships as a
   default Profile module, removable like everything else.
4. **Gear Quiver module** — preview + tap-through to the quiver (locked 2026-07-09:
   moved from Settings, social-facing). Reuses `app/gear.tsx`; the Settings link retires.
5. **Past benchmarks** (⚑1) and **connections/friends list** (backend era; Decision
   (obvious call) per Strava precedent — the graph is identity-shaped) slot below.
6. **"Preview as"** (backend era) — see your own profile as a chosen audience sees it; the
   honest way to make scoping legible (Decision (obvious call)).

Outward view = the same layout minus everything not granted to that audience; legitimately
empty is a valid render (Slopes precedent: the profile is an optional projection).

### Settings (gear → root modal)

Sectioned, replacing today's flat `app/settings.tsx` list:

- **Preferences** — units (kg/lb, km/mi), theme, pinned activities, rest timer, pool length.
- **Connections** — HealthKit/Health Connect state + permissions (migrating here from Home —
  obvious call, already recorded in `home-tab-spec.md`), HealthKit-writes opt-in, future
  integrations.
- **Privacy & sharing** — default audience (ships Private; `social-tab.md` S2), per-field
  profile visibility defaults. Exists as a section from day one even while it holds only
  placeholders — visibility must be a permission change, not a schema migration.
- **Imports** — climbing CSVs (BoardLib/8a), Strong/Hevy link-out to Training's importer.
- **Protocols** — PT protocol *definitions* (`protocols.tsx`); daily ticking stays tab-side.
- **Body profile** — height/DOB/sex/activity/restrictions/medications (`body-profile.tsx`):
  private engine inputs (TDEE cold-start, coach grounding), never social-facing.
- **Thresholds** — placeholder until the correlation engine ships; recorded now as the
  future home of the user-owned detection thresholds (z-scores against the user's *own*
  baseline — the constitution requires the threshold "visible and user-owned";
  `correlation-engine-spec.md` § Feature 3; Notion Settings row 2026-07-09). Renders
  nothing until the engine lands (§ 3's empty-section rule); naming it now means the
  engine arrives to a decided home, not a placement debate. Decision (obvious call).
- **Data** — JSON export (day-one, you-own-your-data), dev seed.
- **Account** — backend era; arrives with Social S1 (accounts/identity, `social-tab.md`).
  Absent pre-backend per the empty-section rule; listed per the Notion Settings row
  (2026-07-09) so account management has a decided home the day accounts exist.
- **Views** — the tenant section: **Stimulus Ledger** (locked #2) and the **USHPA sky
  ledger** (`sky-ledger.tsx`). "Views" names them as data views, not toggles, and gives
  future tenants (raw-observation browser, debug surfaces) a home.
- **Coach** — the summoned-coach door (Ring 3b), if it lands here (⚑4).

### The Stimulus Ledger as Settings tenant (locked #2)

The row opens a full screen rendering the existing `StimulusLedger` component +
`useWeeklyStimulus` — read-only over sessions, engine untouched. Partial burial is the
point: "highly deferred" is a product status and Settings expresses it honestly. Two
guardrails from the research so it parks rather than dies: (a) a **recorded graduation
condition** — if Reflect ships a ledger mode, the Settings entry retires; (b) it is never
the *only* rendering path *by accident* — see ⚑6, because Reflect's no-benchmark default
(which used to be the ledger) is itself in question, and if that goes away too, the
Settings row becomes the sole door and the surface is effectively archived, not parked.
That's a legitimate outcome, but it should be chosen, not drifted into.

### Reflect's fate as tap-in

Reflect leaves the tab bar; its layers disperse (WeightTrendChart → Nutrition Trend,
ledger → Settings Views, benchmark hero/lens → the Reflect tap-in itself). The remaining
Reflect — benchmark-keyed correlation hub — needs a door. Proposal (⚑3, lean from the
research): **both** — Home benchmark glance cards deep-link into the matching Reflect
story, and Profile carries the browsable entry ("Reflect →" beside the logbook), since
Reflect is a routed screen, not a mounted pane, so the second door is nearly free.

Build ownership: **P8 (§ 6)** owns the retirement mechanics — no other pass in the rework
set touches `app/(tabs)/reflect.tsx`. The 5-tab shell swap removes only the *tab slot*;
the screen's actual removal is gated (Nutrition N1 + P4 both live) and the residual
tap-in is built in the same pass, so dispersal never becomes silent deletion — the ⚑6
never-drift-into-it discipline, applied to Reflect itself. Coordination note for the set:
`home-tab.md` § 6 sequences its passes around "the 5-tab shell swap" (the Today→Home
rename rides with whichever lands first) without mentioning the Reflect slot — a one-line
cross-reference to P8 belongs on the Home side.

### The summoned coach room (Ring 3b)

A separate, full-screen room — never ambient, never initiating, output is a draft. Entry:
the nav plan says Settings; `benchmarks-spec.md` still flags "settings may be too buried; a
nav tab too central." Spec position: build the door in **Settings › Coach** (matches the
nav plan), ⚑4 the Profile-sheet alternative before Phase 7. Contextual launches (long-press
a session, tap a plateau card) remain compatible with either door. The
`ai-consultant-prompt.md` "persistent Ask button top-right of every screen" is stale
against locked #1 — the top-right is spoken for. Whichever door wins, it never badges.

### Gear Quiver rework (deferred track — this spec is the named owner)

P5 builds only the Profile preview module over today's `gear`/`kits` tables (014). The
*rework* direction is already decided (Notion 2026-07-09/10; `screens-features-status.md`
§ Gear Quiver) but until now no spec in the rework set owned it — recorded here, with this
spec as the named owner, so it isn't silently dropped between specs:

- **One quiver spanning all sports** — item → accumulated hours/mileage → user-set
  service/retire threshold → "what did I use last time."
- **Earth arms** (shoes, bikes + components, skis) as an **additive migration** — a 017+
  claimant that queues at build time per `benchmarks-templates.md`'s migration-ledger
  rule; no number pre-assigned.
- **Two read models, both descriptive**: *last-used* derives from session gear refs;
  *wear-vs-threshold* renders accumulated hours/mileage against the user's own service
  number — shown when the user opens the quiver, never fired at them.
- **Sky reserve-repack dates** are the same threshold shape keyed by date instead of
  hours. Whether that date may ever generate a reminder is ⚑7 — pull-vs-push is genuinely
  contestable there, and the track must not assume push.

Build pass: P9 (§ 6), deferred; nothing else waits on it.

## 3. Components & states

| Component | Loaded | Empty | Loading | Error |
|---|---|---|---|---|
| Identity header | Avatar, name, blurb, element chips | Initials placeholder; quiet "add a blurb" affordance — no setup wizard, no completion meter | Static (KV read) | n/a (local) |
| Logbook list | Windowed session cards, newest first | "Nothing logged yet." One quiet Log Session affordance (pull, not guilt) | Skeleton rows | Retry row (local reads rarely fail) |
| Logbook calendar | Month grid, checkmark days | Neutral empty grid — empty days are neutral, never red | Skeleton grid | Same as list |
| Session detail | Map-hero when track exists; stats-only otherwise — never a fabricated line | n/a | Spinner over shared renderer | Falls back to stats-only if map style fails |
| Share control (post-S2) | Audience per entry; default Private | Hidden entirely pre-backend — no "coming soon" | — | Grant write fails loud, entry stays private |
| Current benchmarks card | User-authored titles + standing | Module absent, not empty (Home's rule reused) | Skeleton | — |
| Gear Quiver module | Item count + last-used preview | Absent, not empty | — | — |
| Settings sections | Rows per § 2 | Sections with no content don't render (Views renders only built tenants) | Instant (KV) | Per-row inline error |
| Stimulus Ledger screen | Weekly per-pattern ledger, `reveal()` lines | "No sessions this week." — descriptive, no prompt to train | Spinner | Retry |
| Coach room (Phase 7) | Chat-style room, draft-plan output | First-open one-line description of what it is and isn't | — | Keyless/offline: honest "can't reach the model" |

## 4. Data touchpoints

- **Logbook move is UI-only.** `useSessionHistory`-style windowed query over
  `observations`; no schema change. The feed content = the shared subset of exactly these
  rows (locked #3).
- **Visibility scoping** is Social's schema seam (`social-tab.md` ⚑3: grant table
  recommended over a column; engines never see visibility). Profile renders share state
  and hosts the control; it owns no sharing storage.
- **Identity fields** (name, blurb, avatar, element identity, module order): settings KV
  (migration 009) under a `profileCard` key pre-backend; migrates to the account record in
  the backend era. No migration.
- **Gear Quiver**: existing `gear`/`kits` tables (014). Earth arms (shoes/bikes/skis) are a
  future additive migration — 017+ candidate, owned by this spec's quiver track (§ 2, P9);
  it queues at build time and pre-assigns no number.
- **Stimulus Ledger**: `computeWeeklyStimulus`/`reveal()` read-only; no schema.
- **Settings restructure**: KV only; no schema.
- **This spec claims no migration numbers.** 015/016 stay reserved (spots/routes); next
  free is 017.
- Tier discipline carries: the logbook renders tier-1 facts; nothing modeled ever annotates
  an entry ("recovery was low that day" never appears beside a logged session).

## 5. Interactions & cross-tab flows

- **Avatar → Profile; gear → Settings**, from every tab (locked #1). Neither ever badges.
- **Training keeps a small "History →" header link** → Profile › Logbook
  (`training-tab.md` T4 hard gate: the Training feed is deleted only after the Profile
  logbook pass is live — the user never loses access to history).
- **Session-save confirmation deep-links to the new logbook entry** (discoverability
  mitigation — trains avatar = my history).
- **Own entries in the Social feed open into the own logbook entry** (same entity — free).
- **Any name in Social → that member's Profile** (projection over *their* grants);
  own avatar from Social → own Profile (`social-tab.md` § 5).
- Locked #3 verbatim: "Training logbook/history lives on Profile — and the logbook IS the
  social feed: shared logbook entries (per privacy scoping) are the feed content."
- Gear Quiver module → `gear.tsx`; benchmarks card → benchmark detail (management surface
  per the pending locked-#12 decisions); Settings › Views › Stimulus Ledger → ledger
  screen; Settings › Connections owns HealthKit state (Home shows only the data).
- Logging never routes through Profile. Locked #6 routing is untouched: Log Session opens
  the Earth/Sky/Water/Body element picker; Earth/Sky/Water → Map Record with sport armed;
  Body → Training template/session selection (`home-tab.md`).

## 6. Build passes (each independently shippable)

1. **P1 — Header cluster + Profile shell (S).** Avatar + gear on every tab; `app/profile.tsx`
   with identity header (KV-backed) and placeholder logbook section. Ships with the 5-tab
   shell.
2. **P2 — Logbook on Profile (M).** Chronological list + calendar toggle moved from
   `training.tsx`; session detail wiring; save-confirmation deep-link. **Unblocks Training
   T4.**
3. **P3 — Settings restructure (S).** Sectioned Settings per § 2; HealthKit connection
   state absorbed from Home; existing tap-ins (body-profile, protocols, imports, sky-ledger)
   re-homed into sections; gear link marked "moving to Profile."
4. **P4 — Stimulus Ledger tap-in (S).** Views section row + screen. Trivial; any time after
   P3. Retires Reflect's ledger mount when P8 removes the legacy screen — P4 is one of
   P8's two hard gates.
5. **P5 — Profile modules (M).** Gear Quiver module (Settings link retires), current
   benchmarks card, blurb/element-identity editing, module removability.
6. **P6 — Share state + preview-as (M, backend era).** Renders Social S2's grants on
   logbook entries; hosts the per-entry share control UI; "preview as." Gated on Social S1/S2.
7. **P7 — Coach room (L, Phase 7).** Settings › Coach door + separate room per
   `ai-consultant-prompt.md` rails (door contingent on ⚑4).
8. **P8 — Reflect retirement (M).** The only pass in the rework set that actually retires
   `app/(tabs)/reflect.tsx`; the 5-tab shell swap removes only the *tab slot*. From the
   shell swap until P8 completes, the legacy Reflect screen stays routable behind a
   temporary Settings › Views row (Decision (obvious call): the tenant section exists for
   exactly this) so the weight chart and ledger frame never go dark. Hard gates before
   the legacy screen is deleted: **Nutrition N1 live** (WeightTrendChart + weigh-in entry
   re-homed — `nutrition-tab.md`) **and P4 live** (the ledger's Settings door) — the same
   never-lose-access guarantee T4 gives history, applied to Reflect itself. P8 then
   builds the residual **Reflect tap-in screen**: the benchmark-keyed correlation hub
   (benchmark frame → hero signal → supporting context, per `benchmarks-spec.md`'s
   three-layer hierarchy), opened per ⚑3's doors — interim door is Profile's "Reflect →"
   entry (nearly free, § 2); the Home deep-link door lands with ⚑3's ruling. Interim
   guard, explicitly *not* a resolution of ⚑6 / `benchmarks-templates.md` ⚑4: with zero
   benchmarks the residual screen isn't reachable (the Profile entry goes absent-not-empty)
   rather than silently becoming a ledger view — the no-benchmark default stays Dylan's
   ruling. If that ruling is instead "park the benchmark-lens surface entirely until
   ⚑3/⚑4 land," P8 shrinks to removal + gates, and the parking is recorded as a chosen
   state, not a drift.
9. **P9 — Gear Quiver rework (M, deferred).** The § 2 quiver track: Earth-arms additive
   migration (017+ claimant, queued at build time), last-used + wear-vs-threshold read
   models over session gear refs, reserve-repack dates as date-keyed threshold rows.
   Sequenced after P5; nothing waits on it. ⚑7 must be ruled before any reminder
   mechanics exist — until then, display only.

## 7. Dependencies

- **`social-tab.md`**: this spec is its hard prerequisite (P2 before S2/S3); reciprocally,
  P6 waits on Social S1/S2 (accounts + grant store). The visibility seam (Social ⚑3) shapes
  P6 only.
- **`training-tab.md`**: T4 gates on P2. The "History →" link is Training-side, specced here.
- **`map-tab.md`**: session-detail map-hero rendering is shared; P2 can ship with the
  existing `RoutePreview`/stats rendering and adopt the map-hero when Map's pass lands.
- **`home-tab.md`**: P3 absorbs HealthKit connection state; header cluster shape is shared
  shell work. Its § 6 shell-swap note (the Today→Home rename) doesn't yet mention the
  Reflect slot — P8 here owns Reflect's retirement and its gates; a one-line
  cross-reference belongs on the Home side.
- **`nutrition-tab.md`**: N1 (WeightTrendChart + weigh-in relocation) is one of P8's two
  hard gates; its ⚑1 (adherence-history home) interacts with ⚑2 here.
- **Rebrand track (locked #13)**: element-identity chips and dimension tints consume the
  future `elements.{earth,sky,water,body}` token group — mechanics only; no Gorge hexes
  hardcoded. Nothing in P1–P5 waits on the rebrand.
- **Benchmarks decisions (locked #12)**: benchmark card/history modules render whatever the
  type/layout decisions produce; no pass here blocks on them.
- **Research**: `planning/rework/research/profile-logbook.md` (assignment table, § 4, is
  this spec's backbone).

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 — Completed/archived benchmark history: Profile or Reflect?** Lean Profile: the
  *list* of past benchmarks lives on Profile (identity — the arc of past goals); tapping
  one opens its Reflect-rendered story. Decides where "revisit the arc" starts.
- **⚑2 — Nutrition adherence-benchmark history location** (locked #12 — genuinely open, no
  call made): (a) Profile with the rest of benchmark history — consistent, but nutrition is
  the most private data class and defaults hardest-off socially; (b) Nutrition › Trend —
  food stays in the food room, benchmark history splits across two homes; (c) Reflect via
  ⚑1's tap-through only. Interacts with scoping defaults.
- **⚑3 — Reflect's door**: Home cards deep-link + Profile browsable entry (lean: both,
  § 2), vs a single home. Shapes Home's already-⚑'d shelf layout.
- **⚑4 — Summoned coach door**: Settings › Coach (nav plan) vs a Profile-sheet entry
  (deliberate, semantically "mine," grounds in exactly the data Profile fronts — but puts
  the one prescriptive surface beside the social-facing identity surface). Spec builds the
  Settings door; confirm before Phase 7. Never badges either way.
- **⚑5 — Benchmark group management placement** (carried from `benchmarks-spec.md` v0.5):
  Profile is the named candidate, explicitly undecided; tied to the locked-#12 decisions.
- **⚑6 — Stimulus Ledger: parked vs effectively archived.** Settings › Views alone will
  make the ledger nearly invisible — acceptable, and honestly expressive of "highly
  deferred," *if chosen*. But the ledger was also Reflect's no-benchmark default frame, and
  that default is itself now in question (repo digest ⚑6). If Reflect drops it too,
  Settings becomes the only door and the surface is archived in all but name. One ruling:
  is invisible-but-alive the intent, or should Reflect's no-benchmark default keep
  rendering ledger data? (P8 holds an interim guard — zero benchmarks → the residual
  screen's Profile entry goes absent — but that is a placeholder, not this ruling.)
- **⚑7 — Reserve-repack dates: may the quiver ever remind?** Sky reserves carry a
  date-keyed service threshold (repack due). Rendering the date and days-elapsed when the
  user opens the quiver is plainly descriptive; a *notification* is push, and "sparingly
  earned" is the only constitutional gap it could pass through — arguably the data saying
  something (a safety-relevant date crossed a line the user set), arguably an engagement
  mechanic wearing a safety costume. Not assumed either way: P9 builds display only until
  you rule.

## 9. Open questions

1. Where does "add friend" live once accounts exist — Profile (leaning, per the graph
   being identity-shaped), Settings, or a Social affordance? (Carried from
   `social-tab.md` open Q4.)
2. USHPA sky-ledger long-term home: Settings › Views now (private compliance record); if
   the Benchmarks Compliance type (locked #12) lands, the compliance-ledger family may
   absorb it — revisit then.
3. Settings presentation: root modal (Notion nav plan) vs pushed stack screen (today's
   `router.push('/settings')`). Cosmetic; decide at P1/P3.
4. Pre-backend, is the outward Profile view built at all, or is Profile self-view-only
   until Social S1? (Lean: self-only; "preview as" is meaningless before audiences exist.)
5. Does the logbook offer filters (per-dimension, per-activity) at P2, or ship plain
   chronological + calendar first? (Lean: plain first; per-route/per-spot filtered views
   already exist as scoped lists elsewhere and don't compete with the logbook.)
