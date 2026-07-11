# Training tab — rework spec

*v1 — 2026-07-11, product-rework consolidation pass. One of the coordinated 8-spec set under
`planning/rework/tabs/`. Sources: `planning/training-logging-spec.md` (three-layer model —
still authoritative), `planning/phase-4-training-plan.md` (build history; its "Training tab is
history + log entry point" framing is superseded here), REF nav-branch
`screens-features-status.md` (2026-07-10 Training decisions), REF pins-routes-branch
`routes-spec.md` (2026-07-11), and the code inventory. Supersedes the Training-tab framing in
`phase-6-plan-tab-spec.md` (week grid dead) and the 2026-07-10 "Templates / Routes & Sections
top swap" formulation (the swap assumed Pinned Spots occupied the Routes slot; Spots moved to
Home the next day, and the swap died with it — Training is sections on one screen, no mode
toggle).*

Locked decisions applied as fact: #3 (logbook → Profile; the logbook IS the social feed),
#6 (Home element picker routing), #7 (GPS capture on Map), #8 (routes created on Map, browsed
on Training), #12 (3a vs 3b genuinely open — both shapes specced, neither chosen), #13
(rebrand mechanics only).

---

## 1. Purpose & constitution alignment

Training is the **workshop, not the archive**: the forward-facing home of everything the user
has authored for future use — session templates, sections, and the route library — plus the
Body-dimension session start flow and the derived progress views (e1RM ladders, tonnage,
lift detail). Nothing here is history: the logbook lives on Profile (locked #3), and nothing
here is a plan the app wrote — templates are blank slates whose numbers prefill only from the
user's own last performance (the Strong "Previous" idiom); progressive overload gets zero app
suggestion; explicit numeric targets are a benchmark concept and are never stored on
templates. The library ships empty and is never seeded with "recommended" content (north-star
rule 6: pull, not push). Every string on the tab is descriptive ("last done Tue · 4×8 @ 60kg"),
never imperative ("time to train"). Recurrence is a per-template property that surfaces *only*
on Home as today's due stack — Training itself shows a recurrence chip and no calendar, no
week grid, ever.

## 2. Information architecture / layout

One scrolling screen, four sections, no top swap, no history feed. Standard chrome: top-right
avatar (Profile) + gear (Settings), like every tab — plus, once T4 removes the feed, a small
**"History →" header link → Profile › Logbook** (the mitigation specced in
`planning/rework/tabs/profile-settings.md` §5: history moves, but Training keeps a one-tap
door to it).

```
Training
├── A. Start                 "Start a session"
│     recent-templates row (≤3, last-used order) · [Blank session]
├── B. Library               Templates & Sections  (3a/3b shared skeleton, ⚑2)
│     search (appears ≥10 items) · template cards · [+ New template]
├── C. Routes                "Routes →" shelf                     (locked #8)
│     2 most-recent route cards · effort counts · [+ New Route → Map build mode] (post-M6)
└── D. Progress & tools      Training Progress → · Import CSV →
```

**What Training keeps / loses (the moves, explicit):**

| Surface | Fate |
|---|---|
| Session history feed + calendar | **OUT → Profile** (locked #3; see `planning/rework/tabs/profile-settings.md`). Only the UI moves; `useSessionHistory` and the observations query are unchanged. A small "History →" header link remains Training-side (§2, T4). |
| Pinned Spots list | OUT → Home glance (pinned-spots-spec REF amendment; see `planning/rework/tabs/home-tab.md`) |
| GPS live capture + GPX import | OUT → Map Record (locked #7; see `planning/rework/tabs/map-tab.md`). `useGpsTracker`/`GpsRecorderPanel` relocate with it. |
| Stimulus/ledger anything | Never returns here — Settings tap-in (locked #2; `planning/rework/tabs/profile-settings.md`) |
| Benchmarks tile | Superseded per Notion Features DB; contextual benchmark creation from Training flows survives (⚑4) |
| Templates & Sections library | **KEEPS** — no longer a standalone tap-in; it is Training's core content |
| Route library browsing | **KEEPS** (locked #8) — routes are reusable assets, not history |
| Non-GPS logging surfaces (gym, climbing, pool swim, practice) | **KEEPS** — `log-session.tsx` remains the surface router, launched from Start (and from Home's Body row) |
| Manual-numbers GPS fallback | **KEEPS** — the capture-ladder floor ("manual numbers, no map") stays reachable from Blank session; recording itself is Map's |
| training-progress / lift-detail / log-rom / log-pain | **KEEPS** as tap-ins from section D |
| Strong/Hevy CSV import | **KEEPS** (section D). Decision (obvious call): it's a logging-adjacent utility, not history. |

**Landing lead — ⚑1.** With history gone, what leads the screen is contestable. Proposal:
**Start-first** (section A on top) — the tab's daily job is "begin the thing I planned,"
and the library is the reference shelf behind it. The alternative (Library-first, with Start
folded into the library's cards) reads better for heavy template authors but adds a tap to
the most common action. Flagged for Dylan; the section skeleton is identical either way, so
the order is a late swap.

## 3. Components & states

**A. Start strip.**
- `RecentTemplateChip` ×≤3: title + surface icon + dimension tint. Tap → launches the
  template into a live session (`log-session` prefilled, `templateId` carried for
  planned-vs-actual).
- `Blank session` button → `log-session.tsx` step-1 activity picker (non-GPS surfaces +
  manual-GPS fallback; the existing element-grouped picker in `app/(tabs)/training.tsx` is
  the prior art and moves into this flow).
- *Empty (no templates yet):* Blank session alone plus one descriptive line — "Templates you
  save appear here." No starter packs, no sample content, no CTA styling beyond the button.
- *Loading:* skeleton chips (local SQLite — sub-100ms; still specced).
- *Error:* strip degrades to Blank session only; a library read error never blocks logging.

**B. Template library — shared skeleton for 3a and 3b (⚑2, do not decide).**
Both open shapes share: `TemplateCard` (title, surface icon, dimension tint from the element
token, recurrence chip when set — "repeats M/W/F" as fact, not schedule —, descriptive
last-done line), a search field (Decision, obvious call: appears at ≥10 items), sort by
last-used desc, `+ New template` → existing `edit-template.tsx`.
- **3a (two lists):** two headers, "Templates" then "Sections," each its own list. Sections
  header renders even while the Sections primitive is unbuilt? No — *absent, not empty*
  (Home's rule applies here too): the Sections list only appears once a first section exists.
- **3b (unified stream):** one list, `kind` filter chips (All / Templates / Sections), cards
  distinguished by a small kind glyph.
The data layer, cards, search, and empty state are identical; only the grouping wrapper
differs — build the skeleton once (Pass T2), apply the decision as a wrapper swap (Pass T6).
- *Empty:* "Your library is empty. Save a session as a template, or build one from scratch."
- *Error:* inline retry row; Start strip unaffected.

**C. Routes shelf** (per `routes-spec.md`, which owns the entity and detail screen).
- `RouteCard`: name, activity icon, distance via `metersToDisplay` (routes-spec ⚑6), SVG
  `RoutePreview` thumbnail (never a GL map per row), effort count when >0.
- Shelf shows the 2 most-recent (`updatedAt` desc) + "Routes →" to the full list
  (`app/routes.tsx`); `+ New Route` → **Map build mode** (creation door 1) — this button
  renders only once Map's builder pass (map-tab M6) is live; before that the shelf ships
  without it (see T3). Route card tap → route detail (`app/route/[id].tsx`, specced in
  routes-spec; map-hero + efforts list).
- *Empty:* pre-M6, one line naming the creation doors that actually exist (save a logged
  session as a route · import GPX — both builder-independent, routes-spec P2.5); once Map's
  builder lands, the line adds "build on Map" and `+ New Route` appears.
- *Loading/error:* skeleton cards / collapse to the "Routes →" link.

**D. Progress & tools.** Plain link rows to `training-progress.tsx` (→ `lift-detail.tsx`,
`log-rom`, `log-pain`) and `import-csv.tsx`. Internals unchanged by this spec; the
per-session `reveal()` contribution string stays off every card here (it left with the
ledger).

**Body deep-link presentation.** Arriving from Home's element picker with `dimension=body`,
the tab opens scrolled to Start with the strip focused. Decision (obvious call): a
presentation state of the landing screen, not a separate "session selection" screen — one
less surface to maintain, same content.

## 4. Data touchpoints

Descriptive only; this spec **owns no new migration** (next free number is 017 and stays
free unless Sections becomes a table — see Open questions).

- **Templates:** `session_templates` (migration 005) CRUD exists. Additions ride the JSON
  payload shape, migration-free per the Phase-4 seam: `recurrence?` (weekday set) on the
  template shape; `GpsTemplateShape.routeId?: string` (type-level; templates *reference*
  routes, never embed geometry — routes-spec resolved this).
- **Routes:** `routes` table = migration 016, owned by the routes build (see
  `planning/rework/tabs/map-tab.md` + `routes-spec.md` P1). Training only reads:
  `listRoutes()` and per-route effort counts via `listSessionsForRoute` (JS scan over
  session payload `routeId` backlinks — same rationale as `listSessionsForSpot`).
- **Last-performance prefill:** reads recent session observations per exercise ref
  (extends the existing `useExercisePatternMemory` idiom). Read-only, no schema.
- **Recent/pinned activities:** ordered id list in settings KV (exists in `appSettings`) —
  the one preference consumed by this picker, Map Record, and Home's element picker alike.
- **Logbook:** zero schema change; the observations query simply gets a new consumer on
  Profile. Per-route efforts lists remain *scoped filtered views* of sessions — Decision
  (obvious call): locked #3 resolves routes-spec ⚑7 / pinned-spots ⚑3; these lists are not
  the logbook and don't compete with Profile.
- **Sharing readiness:** templates and progress views are private surfaces; routes already
  carry `visibility` (016). No Ring-4 work here beyond not blocking the per-session
  visibility seam (flagged in `planning/rework/tabs/social-tab.md`).

## 5. Interactions & cross-tab flows

Locked routing, verbatim: **Log Session (Home log bar) opens an Earth/Sky/Water/Body element
picker; Earth/Sky/Water rows lead with most-recent activity, route to Map Record with sport
armed; Body routes to Training template/session selection** (locked #6). **GPS capture lives
on the Map tab (Record mode)** (locked #7). **Routes are created on Map (straight-line
builder etc.), and the route library is browsed on Training. History (logbook) is on Profile;
routes are reusable assets, not history** (locked #8).

- Home Body row → this tab's Start presentation (§3). Until Pass T5 lands, Home's interim
  routing (straight into `log-session` with activity pre-selected, home-tab-spec ⚑1) applies.
- Template tap → live session; at save, the **save-time fork**: "update template" vs "keep as
  one-off" (locked 2026-07-10). A finished session also offers **save-as-template** (sheet,
  unbuilt) and — when it has a track — **save-as-route** / save-as-spot (`log-session.tsx`
  affordances; routes-spec P2.5, no map dependency).
- `+ New Route` / route detail "Start session on this route" → Map (build mode / Record with
  the route preloaded for follow). Both are Map-owned flows; Training only links — and only
  once the target exists (the build-mode link is gated on map-tab M6; see §3 C and T3).
- Recurrence set on a template surfaces **only** on Home as today's due stack; missed days
  clear silently, empty days are neutral.
- Benchmarks: cadence benchmarks spawn contextually from Training flows (benchmarks-spec);
  no benchmark list lives here pending the locked-#12 decisions (⚑4).

## 6. Build passes (each independently shippable)

1. **T1 — Landing skeleton (S).** Restructure `app/(tabs)/training.tsx` into sections
   A/B/D (C placeholder); move the activity picker inside Blank session; keep the history
   feed temporarily pinned at the bottom with no other changes. Ships alone.
2. **T2 — Template library v2 (M).** Shared 3a/3b skeleton: cards, search, last-used sort,
   recurrence property + chip in `edit-template.tsx`, save-time fork, save-as-template
   sheet. Home's due-stack consumes the recurrence field (its pass, not this one).
3. **T3 — Routes shelf (S).** Mount per routes-spec P2: interim "Routes →" header link →
   `app/routes.tsx`, then the inline 2-card shelf once T1 is live. Requires routes P1/P2.
   The `+ New Route → Map build mode` button is *additionally* gated on Map's builder pass
   (map-tab M6, itself gated on M5 + Map ⚑3) — until M6 lands, T3 ships without the button
   and the empty state names only the existing creation doors (save-as-route, GPX import),
   so the pass stays independently shippable without linking to a build mode that doesn't
   exist yet.
4. **T4 — History removal (S).** Delete the feed from Training; add the small "History →"
   header link → Profile › Logbook (§2; cross-ref `profile-settings.md` §5 — the link is
   Training-side and ships in this pass). **Hard gate: ships only after the Profile logbook
   pass is live** — the user never loses access to history.
5. **T5 — Body deep-link handoff (S).** Accept the Home element-picker param; Start-focused
   presentation; retire Home's interim routing.
6. **T6 — 3a/3b resolution + Sections first cut (M).** Apply Dylan's layout decision as the
   grouping-wrapper swap; design + build the Sections primitive (data shape TBD — may claim
   migration 017 if it becomes a table).

## 7. Dependencies

- **Profile spec** (`planning/rework/tabs/profile-settings.md`): logbook pass (P2) gates T4;
  T4 also ships the "History →" header link (§2). Research:
  `planning/rework/research/profile-logbook.md` (assignment table).
- **Map spec** (`planning/rework/tabs/map-tab.md`): routes P1/P2 gate T3; Map's builder pass
  M6 (gated on M5 + Map ⚑3) gates T3's `+ New Route` button — the shelf itself doesn't wait
  on it. Record deep-links ("start on route", builder door 1) are Map passes. Research:
  `planning/rework/research/routes-implementation.md`, `gps-recording-expo.md`.
- **Home spec** (`planning/rework/tabs/home-tab.md`): element picker gates T5; due stack
  consumes T2's recurrence field.
- **Rebrand track** (locked #13): dimension tints on cards/section headers consume a new
  semantic `elements.{earth,sky,water,body}` token group — mechanics only; never hardcode
  Gorge hexes. Note `training.tsx` currently references `theme.colors.sandstone` by name —
  one of the grep-rename sites the token migration must catch.
- **Benchmarks decision** (locked #12): ⚑4 waits on it; nothing in T1–T6 blocks on it.

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 Landing lead order** — Start-first proposed (§2); Library-first is the defensible
  alternative. Cheap to swap, but it defines the tab's felt purpose.
- **⚑2 3a two-lists vs 3b unified stream** (locked #12 — genuinely open, both shapes
  specced on one skeleton, decision deferred to you; T6 is the application pass).
- **⚑3 Non-GPS Earth/Water starts** (carried Notion open question): indoor climbing and
  pool swim are Earth/Water by dimension but have no GPS shape — locked #6 routes E/S/W to
  Map Record, which is wrong for them. Proposal to react to: routing follows the *logging
  surface*, not the dimension — the element picker's expanded activity list sends
  non-GPS-surface activities to the logger directly (Map Record could equally offer a
  "log without GPS" escape). Needs your call; touches the Home and Map specs too.
- **⚑4 Benchmarks door on Training** — the old tile is superseded; contextual creation
  survives, but whether Training gets any benchmark management entry is tied to the open
  type-field/list-layout decisions (locked #12) and group-management placement.

## 9. Open questions

- Sections primitive: no entity, storage, or editor exists — first design work lands in T6
  (table vs JSON-in-templates decides whether migration 017 is claimed).
- Template shapes beyond gym + endurance (climbing, pool swim, practice) — editor currently
  covers two surfaces; does the library want the rest at parity?
- In-progress session state: a live gym session surviving tab switches / app background is
  assumed by the Start flow but specced nowhere.
- Protocols (`protocols.tsx`, user-authored home-exercise plans): candidate for section D vs
  staying Settings-linked — small, but currently double-homed.
- Efforts-count scans (`listSessionsForRoute`) are JS payload scans — fine single-user; note
  a ceiling if route counts grow large.
