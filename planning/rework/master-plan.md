# Product rework — master plan

*v1 — 2026-07-11. The entry point to the rework set. Read this first; every other file
under `planning/rework/` is a spoke off this hub. Locked decisions of 2026-07-11 are
treated as fact throughout and cited as **locked #N**. ⚑ marks anything that needs
Dylan's eyes; the full deduplicated roster is § 8. "Decision (obvious call)" marks calls
already taken and recorded — they are not re-raised.*

---

## 1. Executive summary

This rework takes a product that already knows what it is — **a mirror, not a coach that
leads** — and gives it the shell that shape deserves. One timeline of training, food,
recovery, and outcomes, now organized the way the life it reflects is organized: five
tabs (**Home · Training · Map · Nutrition · Social**), a Profile that holds your history,
and a Settings drawer that holds the machinery. Nothing in this plan adds a plan, a
score, a streak, or a push. What it adds is *placement*: logging starts from Home through
the four elements (Earth/Sky/Water/Body — the literal first branch of the core loop, not
a tag applied afterwards); geometry happens on Map; the workshop of templates and routes
lives on Training; facts and their consequences split honestly across Nutrition's
Intake/Trend; and the logbook moves to Profile, where — per privacy scoping — its shared
entries *are* the social feed. The Stimulus Ledger steps back to a Settings tap-in;
Reflect dissolves into the surfaces that earn its pieces. The intelligence stays in the
plumbing; the shelves just finally match the goods.

Eight specs cover the whole surface area (§ 3), a phased build order sequences them
(§ 4), and one walkable list holds every decision that is genuinely Dylan's (§ 8).
Everything else is already decided or decision-proof — building can start today.

## 2. Current state vs target

### Nav: shipped vs locked

| | Shipped today (`app/(tabs)/_layout.tsx`) | Locked target (locked #1) |
|---|---|---|
| Tabs | **Today · Training · Nutrition · Reflect** (4) | **Home · Training · Map · Nutrition · Social** (5) |
| Top-right | Settings gear only | **Avatar (→ Profile) + gear (→ Settings)** — neither is a tab |
| Reflect | A tab | Retired from the bar; layers dispersed (WeightTrendChart → Nutrition Trend, Stimulus Ledger → Settings Views, benchmark hero/lens → a residual Reflect tap-in — `profile-settings.md` P8) |

### Code per target surface (from the code inventory, 2026-07-11)

- **Home** — the shipped Today screen is the base: log buttons, benchmark cards,
  Steps/SleepCard all exist and get reworked/demoted per `tabs/home-tab.md`. No element
  picker, no spots glance yet (prior art: Training's `elementSections()`).
- **Training** — tab exists; keeps picker/templates/progress/import; **loses the history
  feed to Profile**. Routes shelf: zero code (no `routes` table).
- **Map** — **zero tab code.** Building blocks ship: `RouteMap` (MapLibre 10.4.2),
  `useGpsTracker` (foreground-only), `GpsRecorderPanel`, GPX/IGC import, spots table +
  conditions clients. Missing: the tab, background recording, any map gesture, builder.
- **Nutrition** — tab exists; logger is complete (**including barcode + label scan — the
  "barcode 2.7 still gated" line in older plans is stale; it shipped** via `expo-camera`
  in `log-food.tsx`). Missing: Intake/Trend split UI, targets/status card, Focus lens.
- **Social** — **zero code.** No accounts, no backend, no visibility scoping anywhere.
- **Profile** — **zero code.** No avatar, no profile route, no identity concept.
- **Settings** — exists flat; gets sectioned; gains the Stimulus Ledger tap-in
  (`StimulusLedger` component already ships, mounted on Reflect today).
- **Engine** — `core/` is healthy (trend, expenditure, stimulus, benchmarks v0.4 faces,
  swim/climb/gear/conditions). Correlation engine still unbuilt (the declared next core
  piece; untouched by this rework).
- **Storage** — migrations 001–009 + 014 registered; **010–013 burned, never re-register;
  015 reserved `spots_sport`, 016 reserved `routes`, next free = 017** with multiple
  queued claimants — numbers are claimed at build time, never pre-assigned.
- **Theme** — `src/theme/tokens.ts` still holds the desert placeholder system. Zero raw
  hex outside it (good), but 95 references in 40 files bind to palette *proper nouns* —
  the target of brand Pass 1.

### The unmerged-branches situation — ⚑MP-1 (disposition needs your sign-off)

Five branches hold spec work that this consolidation supersedes; two hold *code* that it
does not. The rework set was written against the freshest branch extracts, which live in
a session scratchpad that will expire — **landing their content into `planning/` on this
branch is pass D0 + S0.5 (the first work session, § 5)**. Recommended disposition:

| Branch | Holds | Recommendation |
|---|---|---|
| `claude/home-tab-design-m6zvni` | `home-tab-spec.md`, SFS fork | Superseded by `tabs/home-tab.md`. **Extract via D0, then archive/delete.** |
| pins-routes branch | `routes-spec.md`, `pinned-spots-spec.md`, `gps-mapping-spec.md` § Placement, SFS fork | routes/pinned-spots specs stay authoritative for their entities — **extract via D0 (with the gps-mapping union), then archive.** |
| `claude/map-nav-planning-7cv9x9` | `gps-mapping-spec.md` background amendment, amended `claude-md.md` (commit `fb61366`) | Constitution amendments land via S0.5; gps-mapping union via D0. **Then archive.** |
| social branch | `social-tab-spec.md` | Consolidated into `tabs/social-tab.md`; original still worth landing via D0 as the design-basis record. **Then archive.** |
| nav branch | `benchmarks-spec.md` v0.5, phase-6 supersession banner, richest SFS base | **v0.5 and the banner must land with D0/S0.5** (they're in the checklist below). Then archive. |
| **PRO-63 benchmarks branch** | **Code** (expenditure/TDEE state) | **Not superseded — merge to main.** Nutrition N2 is sequenced after this merge (Notion). |
| **`dimension/body`** | **Code — 46 commits, LOCAL, NOT PUSHED** | **Push immediately** (pure risk mitigation; see § 7 R3). Build work stays sequenced after the Gorge redesign per your 2026-07-09 call. |

Doc-landing checklist for D0/S0.5 (so nothing on those branches is lost when they go):
union both `gps-mapping-spec.md` amendments; take pins-routes `pinned-spots-spec.md`;
add `routes-spec.md` / `home-tab-spec.md` / `social-tab-spec.md`; take nav-branch
`benchmarks-spec.md` v0.5 + the `phase-6-plan-tab-spec.md` banner; adopt the map-nav
`claude-md.md` amendments into `planning/claude-md.md` + root `CLAUDE.md`; Groups→Social
rename ripple; supersession banners (`phase-6-plan-tab-build.md`,
`ai-consultant-prompt.md` Ask-button line); the Elements/HBEGPS archival note (locked #5).
`planning/screens-features-status.md` was already updated in this pass (see § 9).

## 3. The unified scope — one paragraph per spec

- **[`tabs/home-tab.md`](tabs/home-tab.md)** — Home is today at a glance plus the fastest
  path to logging. Two tiers: the always-present two-button log bar (Log Session opens
  the Earth/Sky/Water/Body element picker with the locked routing — E/S/W lead with
  most-recent activity and route to Map Record with sport armed; Body → Training), and a
  glance tier (today's template card, Pinned Spots condensed cards, benchmark progress,
  Focus-aware nutrition-today card, and the deliberately non-headline steps/sleep line at
  the very bottom — hours + count only, tier-3 scores never). No numeric headline by
  design once the ledger leaves. Interim routing to the current logger means Home never
  blocks on the Map shell. Passes H1–H6.
- **[`tabs/training-tab.md`](tabs/training-tab.md)** — the workshop, not the archive: one
  screen with Start (recent-template chips + Blank session — the Body landing for Home's
  picker), the template library on a shared 3a/3b skeleton (decision deliberately open,
  locked #12), the browse-only Routes shelf (creation always deep-links to Map, locked
  #8), and Progress & tools tap-ins. History leaves for Profile behind a hard gate — the
  feed is deleted only after the Profile logbook ships. Passes T1–T6.
- **[`tabs/map-tab.md`](tabs/map-tab.md)** — where geometry happens. Two modes only:
  Record (MVP — full-bleed map, spots pin layer, sport arm honoring the Home deep link,
  one-tap start, **background continuation of user-initiated recordings** on a
  While-Using-only permission, crash-safe SQLite buffer, silent conditions snapshot on
  save) and Explore (post-MVP stub for Dylan's in-flight design; the route builder lives
  inside it). Follow = a muted guide line, no off-route alerts ever. Privacy restated as
  the hardest line: Body sessions structurally excluded from every map query; privacy
  zones hard-gate Ring 4. Passes D0 + M0–M6.
- **[`tabs/nutrition-tab.md`](tabs/nutrition-tab.md)** — the tier logic made structural:
  Intake holds tier-1 facts (day nav, target-status card, totals, meals, logger); Trend
  holds everything derived/modeled (weigh-in + WeightTrendChart relocated from Reflect,
  expenditure, energy-balance history). Focus mode is the flagship single-metric lens —
  display-only, full-macro capture invariant intact, settable without a target. A target
  *is* the adherence benchmark's behavior face, created in one gesture, rendered
  adherence-neutral via the three-valued day engine. Passes N1–N5.
- **[`tabs/social-tab.md`](tabs/social-tab.md)** — Feed + Groups (locked #4). The feed is
  the **shared projection of the Profile logbook** (locked #3): a permission-filtered
  read, never a post store — un-sharing is retroactive, deletion is deletion. Visibility
  is a grant layer, not a field on the versioned Observation; only session-kind
  observations are shareable *in the type*. Groups are coordination, not competition:
  chat backbone, light posts, minimal events; challenges deferred entirely. The
  anti-gamification checklist is restated as binding acceptance criteria. Passes S0
  (placeholder tab, ships with the shell) + S0.5 (docs) + S1–S7 (backend era).
- **[`tabs/profile-settings.md`](tabs/profile-settings.md)** — Profile (avatar) = identity
  + history: the logbook (list + Strong-style calendar), Gear Quiver, current benchmarks;
  renders only things that already exist in the world; never badges. Settings (gear) =
  sectioned private machinery, with the **Stimulus Ledger parked in Settings › Views**
  (locked #2) under a recorded graduation condition, and Reflect's retirement owned by
  pass P8 behind never-lose-access gates. Passes P1–P9.
- **[`benchmarks-templates.md`](benchmarks-templates.md)** — frames the two genuinely-open
  systems (locked #12) without deciding them: the Benchmarks type question (with the ⚑
  tension against v0.4's "the user never picks a type"), 2a/2b list layout, 3a/3b
  templates library plus the hidden "what is a Section" gate. Decision-proof passes
  B1–B5 + T0 (pure classifier, detail sheet, pluggable list container, groups storage)
  let building start before any decision lands. Decision briefs with leans in § 10.
- **[`brand-integration.md`](brand-integration.md)** — token-migration mechanics for the
  in-flight Gorge rebrand (locked #13: mechanics only, no visual values). Pass 1 retires
  palette proper nouns for semantic roles (95 refs / 40 files, zero visual diff); Pass 2
  ships the `element: {earth, sky, water, body}` token group with declared-throwaway
  placeholders (unblocks Home/Map/Training now); Pass 3 writes the handshake contract the
  kit artifact must satisfy; Pass 4 is the single mechanical swap PR when the kit lands;
  Pass 5 is QA.
- **Research** (`research/`): `gps-recording-expo.md` (verified against SDK 56 package
  source — the background stack M2 builds on), `routes-implementation.md` (tiles/builder/
  DEM), `nutrition-ux.md` (MacroFactor et al. — Focus + targets precedents),
  `profile-logbook.md` (the Profile/Settings assignment table), `social-feed-groups.md`
  (audience model + the guardrail checklist).

## 4. Implementation order

Four principles drive the sequence: **(a)** token cleanup and doc reconciliation start
now — they gate nothing and unblock everything; **(b)** the 5-tab shell swap is the
spine, but most feature passes deliberately land *before* it on the current tabs;
**(c)** nothing that removes a surface ships before its replacement (T4 after P2; P8
after N1 + P4; `log-session` importers after M2); **(d)** the rebrand swap and the
locked-#12 decisions are parallel tracks that never block the mainline — decision-proof
work proceeds.

### Phase 0 — Docs + tokens (start now; no decisions, no shell)

1. **D0** (S, docs — map-tab pass 0) + **S0.5** (S, docs — social-tab pass 0.5): land the
   branch specs into `planning/`, union the gps-mapping amendments, adopt the
   constitution amendments, rename ripple, banners, archival note (§ 2 checklist).
2. **Push `dimension/body`; merge PRO-63** (§ 2 table; PRO-63 gates N2 later).
3. **Brand Pass 1** (M): semantic indirection sweep — zero visual diff.
4. **Brand Pass 2** (S): `element` token group, placeholder values. Unblocks H1, M1, T1.
5. **Brand Pass 3** (S): handshake contract + stale-kit banners.
6. **M0** (S): OpenFreeMap keyless basemap default; MapTiler stays the keyed upgrade.

### Phase 1 — Feature work on the current 4-tab shell

7. **N1** (M, nutrition): Intake/Trend split + WeightTrendChart/weigh-in relocation from
   Reflect. Lands on the current shell; one of P8's two gates.
8. **H1** (M, home): log bar + element picker, interim routing (E/S/W → `log-session`
   pre-selected; Body → Training). The locked-#6 centerpiece, live without Map.
9. **H2** (M) + **H3** (S, home): glance-tier pivot (weigh-in card / sessions list / meal
   list / third button removed with destinations live or interim); steps/sleep demotion
   to the single line; HealthKit connection state → Settings.
10. **T1** (S) + **T2** (M, training): landing skeleton (Start/Library/Progress sections;
    history pinned at bottom untouched); template library v2 on the shared 3a/3b
    skeleton + recurrence property (feeds H5).
11. **B1** (S) + **B2** (M) + **B3** (M, benchmarks): face classifier, detail sheet, list
    container with pluggable group-by — all decision-proof.
12. **Spots P1–P2** (per `pinned-spots-spec.md`): migration 015, `conditions/current.ts`,
    spots list → gates **H4** (M): the Pinned Spots glance on Home.
13. **H5** (S): today's-template card (needs T2's recurrence).

### Phase 2 — The shell swap (the spine)

14. **P1** (S, profile): avatar + gear header cluster on every tab; `app/profile.tsx`
    shell.
15. **Shell swap** (S): `_layout.tsx` → 5 tabs; Today→Home rename; **S0** social
    placeholder tab; Reflect's *tab slot* removed with the legacy screen kept routable
    behind a temporary Settings › Views row (P8 owns actual retirement). Decision
    (obvious call, from the code inventory): nothing in current code blocks this — pure
    nav work.
16. **M1** (M, map): `app/(tabs)/map.tsx` — Record pre-start (map, pins, sport arm,
    permission states), Home deep-link contract. Foreground recording is an accepted
    known ceiling at this pass.
17. **P3** (S) + **P4** (S, profile): sectioned Settings; **Stimulus Ledger tap-in**
    (locked #2 executed).
18. **H6** (S, home): swap interim routing for the real Map Record deep link.

### Phase 3 — The big moves

19. **P2** (M, profile): **logbook moves to Profile** (list + calendar, save-confirmation
    deep-link) → unblocks **T4** (S, training): delete the Training feed, add the
    "History →" link. Hard gate honored.
20. **M2** (L, map): **background recording + save** — the MVP big rock (task stack,
    plugin config + new dev build, buffer migration claimed ≥017, kill-resilience,
    conditions snapshot). GPX/IGC "Import a track" door rides this pass. Then **M3** (S):
    derived honesty stats.
21. **Routes P1–P2/P2.5** (per `routes-spec.md`): entity + migration 016 + list/detail +
    save-as-route → gates **T3** (S, training): Routes shelf; → **M4** (S, map): route
    follow.
22. **N2** (L, nutrition — after PRO-63 merge): targets + adherence benchmark + status
    card (H2's card upgrades to consume it) → **N3** (M): Focus lens → **N4** (M): Trend
    completion → **N5** (S): provenance tap-through.
23. **T5** (S, training): Body deep-link presentation, retiring Home's interim Body
    handling.
24. **P5** (M, profile): Profile modules (Gear Quiver module, benchmarks card, identity
    editing).
25. **P8** (M, profile): Reflect retirement + residual tap-in — gated on N1 + P4, both
    now live.

### Phase 4 — Decision-gated + platform work (as rulings land)

26. **SDK 53→56 + MapLibre v10→v11 upgrade** (⚑, map ⚑3): research lean is
    *before* M5/M6 (they sit on exactly the renamed v11 gesture/camera APIs).
27. **M5** (L): Explore v1 — gated on Dylan's in-flight Explore/"Now" design.
28. **M6** (M): straight-line builder inside Explore (shared gesture spike with Spots P4)
    → enables T3's `+ New Route` button.
29. **T0** (S, paper) → **T6** (M, training): Sections definition, then the 3a/3b
    application — after Dylan's ruling (locked #12).
30. **B4** (M): benchmark groups storage; **B5** (S–M): type-decision application —
    after ⚑ rulings.
31. **P9** (M, deferred): Gear Quiver rework (Earth arms migration, wear-vs-threshold
    read models — display only until ⚑ repack-reminder ruling).

**Addendum — 2026-07-12, mockups + map style received.** Dylan delivered the
`ui_kits/mobile-app` mockup (all 5 tabs, new brand — see `planning/design-system/README.md`)
and a redesigned MapTiler style (`019f3285-…`, keyed via `.env.local`). Concrete effect on
this phase's items:

- **Item 26 (SDK/MapLibre upgrade) — still the real blocker, now partially de-risked.** The
  new style's base colors/land-cover render correctly on the pinned MapLibre v10.4.2
  (confirmed on-sim, no crash) — so the *palette* half of "on-brand map redesign" ships
  today via the env swap alone. The *3D terrain* half genuinely needs v11, per Dylan; item
  26 remains the gating upgrade for that.
- **Item 27 (M5 Explore v1) — still gated, NOT unblocked by this delivery.** The mockup's own
  Map screen literally renders an "OPEN · EXPLORE LAYOUT" placeholder badge for Explore mode
  — Dylan has not designed it yet, even in this handoff. Reading the mockup arrival as
  resolving Explore would be a mistake; only Record-mode chrome (mode-switch chip, sport-arm
  chips, session-detail card) reads as settled in the mockup.
- **Item 28 (M6 builder)** — unchanged; still sequenced after M5 + map ⚑3.
- **Item 29 (T0 → T6, Sections/3a-3b) — do not conflate with the shipped Training splitter.**
  The mockup's `[Templates | Routes]` top segmented switch is a **different, smaller
  question** than T0/T6's Sections-primitive/3a-vs-3b decision, and it's been answered:
  built into `app/(tabs)/training.tsx` this session (see `tabs/training-tab.md`'s
  2026-07-12 status update). T0/T6 (what a "Section" even is, list-grouping shape) remain
  fully open, locked #12.
- **Items 30-31** — untouched by this delivery; still gated on their own ⚑ rulings.

**Also flagged: §2's "Nav: shipped vs locked" table is stale.** It records the shipped nav
as the old 4-tab bar (Today/Training/Nutrition/Reflect) as of this file's 2026-07-11
authorship, but `git log` shows the 5-tab shell swap (item 15) and P8's Reflect retirement
(item 25) both already shipped *before* this file was written (`e10eac7`, `d0b8219`) — the
sim now shows Home/Training/Map/Nutrition/Social live. This master plan's phase numbering
was written mid-stream against a state it doesn't fully reflect; treat §2 and the "current
state" framing in §3 as needing a fresh code-inventory pass before anyone plans off them
literally, rather than as ground truth.

### Phase 5 — The rebrand swap (whenever the kit artifact arrives)

32. **Brand Pass 4** (M): the single mechanical swap PR (fonts verified against the
    *installed* SDK, both-mode colors, element values replace placeholders, type-scale
    retune session with Dylan). Can land any time after Phase 0; blocks nothing before
    it. **Landing it unblocks the Body-dimension backlog** (sequenced after the redesign
    per Dylan, 2026-07-09).
33. **Brand Pass 5** (S): post-swap QA sweep.

### Phase 6 — Ring 4 / backend era (after Ring 1–3 surfaces stand)

34. **S1** (L): accounts + mutual invite-link friends (+ moderation floor) → **S2** (M):
    sharing grants + projection (Profile P6 rides alongside) → **S3** (M): the Feed →
    **S4** (M): comments → **S5** (L): groups + chat (build-vs-buy evaluated first) →
    **S6** (M): events. Privacy zones are a hard gate before any shared geometry. **S7**:
    deferred pool (DMs if cut, challenges, cohort map).
35. **P7** (L, Phase 7): the summoned-coach room, behind whichever door ⚑ lands.

## 5. Where to start — the first three work sessions

1. **Session 1 — the docs session (D0 + S0.5, § 4 items 1–2).** Land every branch spec
   into `planning/`, union the two `gps-mapping-spec.md` amendments, adopt the
   constitution amendments into `planning/claude-md.md` + root `CLAUDE.md`, apply the
   rename ripple and banners, push `dimension/body`, open the PRO-63 merge. Zero product
   code; removes the single biggest risk (the scratchpad extracts expiring while
   `planning/` still contradicts them).
2. **Session 2 — the tokens session (brand Passes 1–3 + M0).** The semantic sweep (95
   refs, 40 files, zero visual diff), the `element` token group with placeholders, the
   handshake contract, and the keyless basemap default. After this session the rebrand
   is a value swap and every element-colored surface is unblocked.
3. **Session 3 — the first visible rework (H1, then N1).** The Home log bar + element
   picker with interim routing is the locked-#6 centerpiece and needs nothing from Map;
   N1's Intake/Trend split is the same shape of win on Nutrition and starts the Reflect
   dispersal clock. Both land on the current 4-tab shell.

## 6. Tooling & library decisions (consolidated from research)

| Area | Decision | Status |
|---|---|---|
| Map renderer | `@maplibre/maplibre-react-native` — stay; pinned 10.4.2 on SDK 53 | Decided |
| MapLibre v11 + Expo SDK 56 | Upgrade **before** M5/M6 (Explore/builder sit on renamed v11 APIs); M0–M4 fine on v10. Note `AGENTS.md` points at v56 docs while package.json pins ^53 — reconcile at upgrade time | ⚑ (map ⚑3 — sequencing is Dylan's call) |
| Base tiles | **OpenFreeMap keyless default; MapTiler keyed upgrade** | Decided (obvious call) |
| Offline tiles | End state lean: self-hosted Protomaps extracts; `OfflineManager.createPack` collides with provider terms | ⚑ (map ⚑4 — decide before any offline pass) |
| GPS capture | `expo-location` + `expo-task-manager` task-based two-layer stack; **While-Using-only permission, both platforms, forever**; `pausesUpdatesAutomatically: false` explicit; `BestForNavigation`; SQLite crash-safe buffer; store raw, derive clean; **no live auto-pause** | Decided (research-verified) except ⚑ `killServiceOnDestroy` (map ⚑1) |
| Elevation for plotted routes | Lean: client-side terrain-RGB decode; until chosen, plotted routes honestly show no elevation | ⚑ open (map open Q5) |
| Fonts | Four `@expo-google-fonts/*` packages (Archivo / Space Grotesk / Space Mono / DM Sans), verified against the **installed** SDK at swap time; bundled-TTF fallback via `expo-font` if any face isn't published | Mechanics decided; values wait on the kit (⚑ brand ⚑1–⚑5) |
| Nutrition data | USDA + OFF, free-only covenant; barcode + label scan **shipped** (`expo-camera` ~16.1.11); hold the 1–3 s resolution floor | Decided, shipped |
| Chat (Social S5) | Lean **buy** (Stream/Sendbird-class — chat is not Observation-shaped; zero constitutional IP in transport); evaluation is required new work before S5 | ⚑ open (locked #12 scope adjacent) |
| Visibility model | Sharing-grant layer keyed by observation id, separate from the versioned record; engines never see grants | Recommended; ⚑ confirm (social ⚑3) |
| Migration ledger | 001–009 + 014 registered; 010–013 burned; 015 `spots_sport`; 016 `routes`; **next free 017, claimed at build time only** (claimants: recording buffer, Sections table, benchmark groups, type column if chosen, nutrition soft-archive ex-"M010", Earth gear arms, hk_exports) | Decided (binding rule) |

## 7. Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Doc divergence**: the freshest specs live in an expiring scratchpad; `planning/` actively contradicts them (old gps-mapping wording, Spots-on-Training). A future session reads stale truth. | D0 + S0.5 first (§ 5 session 1). Until they land, treat `planning/rework/` as authority. |
| R2 | **Migration-number collisions**: 010–013 burned; several specs queue 017 candidates; one stale "M010" reference exists in phase-5-pass-2-6. | Ledger restated everywhere (§ 6); claim at build time only; renumber rule already written into `nutrition-tab.md` N2. |
| R3 | **`dimension/body` is 46 local, unpushed commits.** A disk failure deletes real work. | Push in session 1. No build implications (sequenced post-rebrand anyway). |
| R4 | **Losing user access during the moves** (history, weight chart, ledger). | Hard gates baked into passes: T4 only after P2; P8 only after N1 + P4; `log-session` importers retire only after M2's door is live. Nothing is deleted before its replacement ships. |
| R5 | **Background recording platform risk** (OEM killers, task config, dev-build churn, iOS swipe-kill semantics). M2 is the plan's biggest single rock. | Research done against actual SDK source (`gps-recording-expo.md`); the one source-vs-docs gotcha is named; buffer + recovery designed for kill-resilience; ⚑1/⚑2 isolate the two judgment calls. |
| R6 | **SDK/MapLibre upgrade mid-build** churning the Map work. | M0–M4 explicitly buildable on v10; upgrade scheduled as its own item before M5 (⚑ map ⚑3). |
| R7 | **Rebrand drift**: building element-colored UI against unfinalized values, or the kit arriving in a shape that isn't mechanically swappable. | Pass 1/2 indirection + declared-throwaway placeholders; Pass 3's handshake contract defines exactly what the artifact must contain; Pass 4 is the only kit-blocked work in the whole plan. |
| R8 | **Decision deadlock on locked-#12 items** stalling adjacent build. | Decision-proof passes (B1–B3, T2's shared skeleton, B4) are specced to proceed under any outcome; only B5/T6/2b-rendering wait. |
| R9 | **Constitution erosion at the social edge** (counts, badges, notification creep under build pressure). | `social-tab.md` § 6 guardrails are binding acceptance criteria; non-session kinds structurally unshareable; the two notification/ack questions pre-flagged for one ruling each (⚑) instead of drift. |
| R10 | **Notion/repo drift**: Notion still carries stale rows (Body tab, Spots-on-Training, "zero display UI" benchmarks, "revisit or archive" HBEGPS). | This file + updated `screens-features-status.md` are repo truth; S0.5 records the archive decision; a Notion cleanup sweep is recommended but never authoritative. |
| R11 | **PRO-63 unmerged** blocks N2 (and Notion's V2 sequencing). | Merge scheduled Phase 0; N1 explicitly does not wait. |

## 8. ⚑ Flag roster — every flag, deduplicated, one walkable list

Shared flags are listed once with all origins. **Group A needs a decision; Group B needs
your eyes to confirm a call already taken (or a proposal already made).**

### Group A — decisions needed

**Bites immediately (shapes Phase 0–2 work):**

1. **Home shelf layout** (home ⚑1; the flag locked #11 mandates). Confirm: template card
   → Spots condensed cards (cap 3, "Spots →") → benchmarks → nutrition → steps/sleep as
   the single bottom line; sub-calls (a) cards vs plain link, (b) Spots above
   benchmarks/nutrition, (c) steps/sleep at the very bottom.
2. **Non-GPS Earth/Water starts** (home ⚑4 = training ⚑3 = map ⚑6). Indoor climbing /
   pool swim are E/W by dimension but Map Record is wrong for them. Proposal: routing
   follows the *logging surface*, not the dimension (+ optional "log without GPS" escape
   on Record). One call, three specs.
3. **Training landing lead order** (training ⚑1): Start-first (proposed) vs
   Library-first. Cheap to swap; defines the tab's felt purpose.
4. **Social placeholder tab content** (social ⚑2): quiet one-sentence static panel
   shipping with the shell (proposed) vs hiding the tab until the Feed pass.
5. **Branch disposition** (⚑MP-1, § 2): sign off the extract-then-archive plan for the
   five spec branches + merge PRO-63 + push `dimension/body`.
6. **Brand artifact format + ground truth** (brand ⚑1 + ⚑2): (a) Figma tokens / JSON /
   markdown kit — any works, say which; (b) confirm the repo's
   `brand-kit-gorge-draft.md` (forest/river, no fonts, none of your four element hexes)
   is superseded by the kit you cited, and that the blank-but-"Done" Notion Brand Kit
   page is not an authority.

**Bites at its pass (each named at the gating pass):**

7. ~~**Benchmarks type field vs "the user never picks a type"**~~ **RESOLVED 2026-07-14**:
   derived, no schema, no dropdown, no type-first creation flow — the existing rule stands.
   Gates B5 (now unblocked); see `phase4-session-playbook.md` R3.
8. ~~**Benchmarks list layout 2a by-domain vs 2b by-type**~~ **RESOLVED 2026-07-14**: both,
   as two tabs, not a straight swap — by-domain stays, by-type/face is added alongside it.
   See `phase4-session-playbook.md` R4.
9. ~~**Templates 3a two-lists vs 3b unified stream + the "what is a Section" gate**~~
   **RESOLVED 2026-07-14**: Section = a timed stretch within a *route* (Strava-segment-like) —
   the reusable-work-block reading was wrong; Training gets no Sections primitive at all.
   Templates is **3a, two lists** (reverses this doc's 3b lean). Gates T6 (now unblocked, no
   T0 needed); see `phase4-session-playbook.md` R1/R2.
10. **Social MVP coordination scope** (social ⚑1; locked #12). Candidate cut for
    reaction: S1–S6 with DMs + challenges deferred; sub-calls: DMs in/out, chat-only
    groups first. Gates the backend-era plan; nothing sooner.
11. **Nutrition adherence-benchmark history location** (nutrition ⚑1 = profile ⚑2;
    locked #12). Candidates: Nutrition Trend / benchmark surface–Reflect remnant /
    Profile / own surface. Counts, never streaks, wherever it lands.
12. **Reflect's no-benchmark default** (bench ⚑4, profile ⚑6's twin): the old ledger
    fallback predates locked #2. Candidates: the four-dimensions mix view, or ledger
    data re-rendered inside Reflect's remnant. Bites at P8.
13. **Stimulus Ledger: parked vs effectively archived** (profile ⚑6). If Reflect's
    default also drops the ledger, Settings › Views becomes the only door — legitimate,
    but it should be chosen, not drifted into. One ruling, with #12.
14. **Reflect's door(s)** (profile ⚑3): Home benchmark cards deep-link + Profile
    browsable entry (lean: both). Interacts with #1's shelf and #12.
15. **Completed/archived benchmark history: Profile or Reflect?** (profile ⚑1). Lean:
    list on Profile, tap-through opens the Reflect-rendered story.
16. **Benchmark-group management placement** (bench ⚑5 = profile ⚑5): Profile is the
    named candidate, explicitly undecided; B4 mounts interim on the list surface.
17. **Benchmarks door on Training** (training ⚑4): waits on #7/#8 + #16.
18. **Template ↔ benchmark card merge on Home** (home ⚑3): merge into one "active
    today" module or stay two. Bites at H5.
19. **Intake landing hierarchy** (nutrition ⚑2): totals-first vs target-status-first
    when a target exists and Focus is off. Tone call; spec shows target-status first —
    confirm or flip. Bites at N2.
20. **Focus metric set** (nutrition ⚑4): does fiber join the picker once N2 lands fiber
    pull-through? Bites at N3.
21. **`killServiceOnDestroy` false vs true** (map ⚑1): does swiping the app away stop a
    recording? Research lean: false. Values call; bites at M2.
22. **Battery-optimization exemption prompt** (map ⚑2): contextual one-time ask on the
    first long recording — confirm it clears the pull-not-push bar. Bites at M2.
23. **SDK 53→56 + MapLibre v10→v11 sequencing** (map ⚑3): upgrade before Explore
    (research lean) or build on v10 and migrate. Bites before M5.
24. **Offline tile terms** (map ⚑4): decide the provider/self-hosting posture before any
    offline-pack pass ships.
25. **Visibility schema seam** (social ⚑3): grant layer (recommended) vs field on the
    record. Confirm alongside #10; shapes S2.
26. **Audience model** (social ⚑4): mutual friends + groups only — no follow, no public
    tier at MVP. Founder call; shapes growth mechanics.
27. **The countless ack** (social ⚑5): a one-tap "seen by *Alex, Priya*" name list, or
    comments as the only response channel. Rule before the Feed design pass.
28. **The notification line** (social ⚑6): zero social notifications vs the one
    defensible exception (human-authored messages deliberately addressed to you). One
    constitution-language ruling before S5.
29. **Summoned coach door** (profile ⚑4): Settings › Coach (spec position) vs a
    Profile-sheet entry. Confirm before Phase 7; never badges either way.
30. **Reserve-repack reminders** (profile ⚑7): may the quiver ever notify on a
    date-keyed service threshold, or display-only forever? Rule before any P9 reminder
    mechanics; until then display only.
31. **Element palette = brand accent palette?** (brand ⚑3): which color takes sandstone's
    CTA/active-tab job under the kit. Bites at brand Pass 4.
32. **Light-mode coverage of the kit** (brand ⚑4): kit includes light values (preferred)
    / dark-first with old light temporarily / mechanical derivation. Bites at Pass 4.
33. **Type-scale retune + the uppercase rule** (brand ⚑5): condensed→grotesk is not
    value-for-value; Pass 4c is a screenshot-judgment session with you, scheduled, not
    silent token math.

### Group B — review wanted (proposals + obvious calls to confirm; awareness items)

34. **Archetype defaults for new users** (home ⚑2): element rows default to trail run /
    paraglide / kayak before history exists — deliberately kept, voice-level only,
    changeable inline. The one place the app "suggests" an activity.
35. **Builder + follow host surface inside Explore is a placement deferral, not a scope
    cut** (map ⚑5 = routes-spec ⚑1) — waiting on your Explore design; don't read it as
    "routes got cut."
36. **`nutrition-tab-v2-spec.md` is missing from the repo** (nutrition ⚑3): Notion calls
    it authoritative but it exists on no branch we hold; `tabs/nutrition-tab.md`
    reconstructs it from the Notion summary + locked #10. If the file surfaces, diff it.
37. **Barcode ground truth** (nutrition, correction on the record): barcode + label scan
    already shipped in `log-food.tsx` — older plan lines and the repo digest saying
    otherwise are stale. No one should plan barcode work.
38. **Notion "zero display UI" for Benchmarks** (bench ⚑6): `app/benchmarks.tsx` +
    `edit-benchmark.tsx` ship today — read as "zero *redesigned* UI"; reconcile in Notion.
39. **gps-mapping doc-merge hazard** (map, handled by D0): the consolidated file must
    union the background-continuation amendment with the Placement work — the
    pins-routes copy still carries the old "never runs in the background" wording.
40. **Carried build-spec flags that survive into their tracks** (digest ⚑9): MapLibre
    tap/long-press gesture spike (one spike shared by Spots P4 + builder M6);
    kind-vs-sport field collapse; provisional-gauge marker; weather-icon derivation;
    follow's foreground-only ceiling pre-M2; climbing-surface granularity ladder
    (research done, decision pending in `training-logging-spec.md`'s orbit).

## 9. Doc map

### The rework set (this directory — current, authoritative)

| File | What it is |
|---|---|
| `master-plan.md` | This file — read first. |
| `tabs/home-tab.md` | Home: log bar + element picker, glance tier, H1–H6. |
| `tabs/training-tab.md` | Training: workshop (Start / library / routes shelf / tools), T1–T6. |
| `tabs/map-tab.md` | Map: Record + Explore, recording stack, routes on the map, privacy, D0 + M0–M6. |
| `tabs/nutrition-tab.md` | Nutrition: Intake/Trend, targets-as-benchmark, Focus, N1–N5. |
| `tabs/social-tab.md` | Social: Feed + Groups, grant model, guardrails, S0–S7. |
| `tabs/profile-settings.md` | Profile + Settings tap-ins, logbook, ledger parking, Reflect retirement, P1–P9. (Referenced as `profile.md` by some siblings — same file; normalize on `profile-settings.md`.) |
| `benchmarks-templates.md` | The two locked-#12 open systems, decision-proof passes B1–B5 + T0, decision briefs. |
| `brand-integration.md` | Token-migration mechanics + the kit handshake contract, Passes 1–5. |
| `research/gps-recording-expo.md` | Background GPS on Expo — verified against SDK package source; M2's build reference. |
| `research/routes-implementation.md` | Competitor routes patterns + tiles/DEM/builder stack. |
| `research/nutrition-ux.md` | MacroFactor/Cronometer/GLP-1-cluster precedents for Intake/Trend + Focus. |
| `research/profile-logbook.md` | Profile-vs-Settings assignment table + precedent research. |
| `research/social-feed-groups.md` | Feed/groups precedents, audience model, the anti-gamification checklist. |

### Older planning docs now partially superseded (keep — do not delete)

- `planning/screens-features-status.md` — **updated 2026-07-11 in this pass** to today's
  locked state; still the pointer to the live Notion page.
- `planning/brand-kit.md` — **stale by declaration** (locked #13); brand Pass 3 banners
  it as the handshake-contract host. `planning/brand-kit-gorge-draft.md` — also
  superseded-in-part (older than the kit Dylan cited; brand ⚑2).
- `planning/gps-mapping-spec.md`, `planning/pinned-spots-spec.md` — the `planning/`
  copies are stale until **D0** lands the branch versions (background-continuation union;
  Spots on Home).
- `planning/benchmarks-spec.md` — v0.4 on this branch; nav-branch v0.5 (groups section)
  lands with D0. Its "Today cards" language = Home; its Reflect ledger-default is
  dangling (flag #12).
- `planning/phase-6-plan-tab-spec.md` / `phase-6-plan-tab-build.md` — superseded-in-part
  (no Plan tab in the locked five; week grid dead); bannered by S0.5, kept as history.
- `planning/nutrition-tab-plan.md` — IA framing superseded by Intake/Trend + Focus
  (locked #10); honesty rules and shipped-pass records remain valid.
  `planning/phase-5-pass-2-6-nutrition-benchmarks.md` — shapes current, "M010" migration
  number stale (renumber 017+ at N2).
- `planning/training-logging-spec.md` — three-layer model still authoritative; its
  "Training tab is history + log entry point" framing predates locked #3.
- `planning/cohorts-spec.md` — concepts live on *inside* the Social tab's Groups section;
  bannered by S0.5; still the deeper challenge/events model.
- `planning/ai-consultant-prompt.md` — behavior rails authoritative; the "persistent Ask
  button top-right" line is stale vs locked #1 (bannered by S0.5).
- `planning/claude-md.md` + root `CLAUDE.md` — missing the 2026-07-09 amendments
  (outdoor-success reframe; amended rule 5) until S0.5 adopts them.
- `planning/data-model.md` — the contract lags shipped reality (no spot/gear/route
  entities, etc.); refreshing it is a blessed-contract change, deliberately not smuggled
  into this rework.
- `planning/product-overview.md` — "no native sport tracking at MVP" contradicts the
  blessed 2026-06-30/07-02 native-GPS reversal; identity framing predates the reframe.
- `planning/backlog.md` — still the best index of deferred items; item 40's "no
  background" wording predates the 2026-07-10 amendment.
- `planning/wearable-ingestion-spec.md` — read its § Addendum as current (Garmin blocked;
  Health Connect a Layer-0 peer); it owns watch import end-to-end.
- Dimension/session docs, `game-plan-and-prompts.md`, phase-1/3/4 and ring2 docs — build
  history; accurate for what shipped, not the target IA.
