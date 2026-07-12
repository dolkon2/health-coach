# Rework Session 6 — The shell swap → 5 tabs + Profile/Settings (Phase 2)

**Branch/worktree:** `main`, `~/Projects/health-coach`. 2 commits,
`1138c6c..e10eac7` (`f79cdc2` map/spot primitives, `e10eac7` the shell wiring).

## What was built

Per `planning/rework/session-playbook.md` Session 6, `master-plan.md` §4 Phase 2
(items 14–17), `tabs/profile-settings.md` (P1/P3/P4 + P8's gate),
`tabs/social-tab.md` (S0), and `tabs/map-tab.md` (M1). Dylan's answer: Social
visible at ship as a quiet static placeholder.

### The 5-tab shell + Reflect off-bar
- `app/(tabs)/_layout.tsx` → **Home · Training · Map · Nutrition · Social**
  (was Home · Training · Nutrition · Reflect). Today→Home was already the live
  label — only stale comments were cleaned.
- **Reflect left the tab bar**: `git mv app/(tabs)/reflect.tsx → app/reflect.tsx`,
  now a root stack screen, still fully routable. Its tab *slot* is gone; the
  screen itself is untouched and reached via a temporary **Settings › Views**
  row. Actual retirement (P8) stays gated on Nutrition N1 + P4 — Phase 3, not
  this session. Sim-confirmed: `/reflect` renders the whole long-view intact.

### Header cluster (P1) + Profile stub
- Persistent top-right **avatar (→ `/profile`) + gear (→ `/settings`)** on every
  tab, via a shared `HeaderCluster`. Both are bordered surface circles (a code-
  review catch — a bare gear glyph washed out over the Map's transparent header).
  Neither badges.
- `app/profile.tsx` — the P1 stub: avatar + "You" + a quiet blurb affordance +
  the four element-identity chips (mechanics-only, reusing `DimensionTag`; sim
  confirmed the `element` tokens render tinted) + an absent-not-empty logbook
  placeholder. No schema, no new settings. Editing (P5), the real logbook (P2),
  and the gear/benchmarks/Reflect modules stay later passes.

### Map tab — Record pre-start (M1)
- `app/(tabs)/map.tsx` — full-bleed basemap (real MapTiler tiles on the sim),
  transparent floating header, sport-arm control in the top-left overlay.
- **`MapSurface`** (new component) centers on the user (or the spot centroid, or
  nothing — never an invented [0,0]) and drops tappable sport-icon pins for spots
  with coordinates. Honest neutral placeholder when there's no key / native
  module.
- **Sport-arm control**: a chip showing the armed activity; tap → the reused
  `ElementPickerSheet` to re-arm. Pre-armed from deep-link params
  (`element`/`activity`) else last-used else the Earth archetype.
- **Permission + GPS states**: rationale ("the app can't see your location
  except during a session you start") → prompt; denied/services-off →
  descriptive + Open Settings; a GPS-readiness chip (ready / weak / locating /
  can't-locate).
- **Record scope decision (⚑, chosen)**: the Record button hands the armed sport
  to the existing, proven `log-session` capture+save path — **not** a new on-map
  live-record + save flow. Sim-verified: "Record Whitewater" → `/log-session`
  opens LOG KAYAK on the GPS surface with the "● Record route" panel ready.
  Rationale in Flags below. On-map live trace + save sheet is M2.

### Sectioned Settings (P3) + Stimulus Ledger tap-in (P4)
- `app/settings.tsx` rewritten flat → sections: Preferences, Connections,
  Privacy & sharing (day-one placeholder), Imports, Protocols, Body profile,
  Gear (marked "moving to Profile"), Sky pilot, **Views**, Data. Presentation-
  only — every handler (HealthKit toggles, units, deficit, climbing import,
  sample-data, USHPA draft) preserved verbatim (a removed-behavior audit
  confirmed nothing dropped). Empty sections (Thresholds/Account/Coach) don't
  render, per the spec's empty-section rule.
- **Views** hosts the parked/deferred surfaces: **Stimulus ledger** (→ new
  `app/stimulus-ledger.tsx`, rendering the existing `StimulusLedger` +
  `useWeeklyStimulus`, read-only), the **USHPA ledger**, and the temporary
  **Reflect** door.

### Social placeholder (S0)
- `app/(tabs)/social.tsx` — one quiet descriptive panel ("A feed of friends'
  shared logbook entries, and groups for planning things together."), no hype,
  no waitlist, no notify-me, per ⚑2. Sim-confirmed.

## Code review

Ran `/code-review` at xhigh effort — 4 parallel finder angles (line-by-line +
language pitfalls; removed-behavior audit; expo-router/RN framework correctness;
reuse/simplification/conventions), one-vote verification. Removed-behavior audit
came back clean (Settings restructure + RouteMap extraction preserved all
behavior; Reflect move left no dangling refs). Real findings, all fixed:

- **Bottom Record card double-counted `insets.bottom`** — the tab bar already
  reserves the home-indicator area (per `Screen.tsx`'s own convention), so the
  card floated ~34pt too high on notched iPhones. Fixed to `spacing[4]`.
- **`resolveMapCenter` returned a zoom with no center** → MapLibre parked at
  [0,0] (null island) for a user with no fix and no coordinate-bearing spots.
  Now returns center+zoom both undefined; MapSurface omits the Camera so the
  style default holds. (Sim-confirmed: the no-location fallback shows the world
  default view, not a zoom onto the Atlantic.)
- **Stale `getLastKnownPositionAsync`** could read as a live "GPS ready" fix on
  an hours-old coordinate. Bounded to `maxAge: 60_000`.
- **Granted-but-no-fix dead-end** (Location Services off) spun "Locating…"
  forever with no remedy. Added a `fixFailed` flag + a 15s timeout on the live
  fix (a cold GPS can hang without throwing) → honest "can't locate" + Open
  Settings.
- **`armOverride` never cleared on a new deep-link** (latent until H6) — added
  an effect keyed on the params so a fresh Home deep-link wins over a stale
  manual re-arm.
- **`useForegroundLocation` setState-after-unmount** — added the repo's
  cancelled-ref guard pattern.
- **Duplicated spot→icon derivation** (SpotPin vs SpotCard) → extracted a shared
  `spotIcon(spot)` helper, adopted by both.
- **Dead `MAP_ELEMENTS` export** (also mismatched ElementPickerSheet's order) —
  removed. Unused `activityById` import + unused `router` in `TabsLayout` —
  removed.
- **Gear icon low-contrast over the transparent map** — both cluster controls
  now carry a bordered surface circle.

Considered and NOT fixed (flagged): a shared `loadExpoLocation()` loader would
de-dupe the lazy expo-location import across `useGpsTracker` / `useCragPin` /
this hook, but that touches two verified, tested hooks — deferred rather than
churn the shell-swap session (same posture as Session 4's shared-BottomSheet
deferral).

## Verification

- `npx jest`: 119 suites / 1250 tests, all passing (added 11 tests for the
  `mapRecord` pure helpers: armed-sport resolution, spots-with-coords filtering,
  accuracy level, camera-center resolution). `npx tsc --noEmit`: clean.
- **Sim-verified headless** (iPhone 17 sim, dev client, Metro on 8081, deep-links
  + `simctl` screenshots). All seven surfaces render + navigate with no
  red-screens: Home (unchanged, new cluster), Map (tiles + Whitewater arm +
  Record + GPS status), Social (placeholder), Profile (stub + element chips),
  Settings (sectioned), Stimulus ledger (real chart), Reflect (full long-view
  off-bar). Record → `/log-session?activity=kayak` opens the kayak GPS logger.
  Screenshots in the session scratchpad.

## ⚑ Flags raised

- **M1 Record = deep-link to `log-session`, not on-map live record+save (chosen
  scope).** The ask was the *pre-start* state; M2 owns background recording + the
  on-map save sheet and would replace any save built now; the deep-link reuses
  the shipped, tested Observation path with zero data-loss risk and resolves the
  indoor-climbing/pool-swim ⚑ for free (a non-GPS sport opens its correct
  logger). If Dylan wants the live trace drawn on the map before M2, that's a
  small follow-up.
- **H6 not done (out of this session's scope).** Home still routes Earth/Sky/
  Water to `log-session` directly; the Map Record deep-link *contract* exists on
  the Record side only. Wiring Home→Map Record is H6 — and shouldn't land until
  Record can save (M2), or it would regress E/S/W logging.
- **M0 (keyless OpenFreeMap basemap) not done.** The full-bleed map needs the
  MapTiler key at this pass (Dylan's sim has it); without a key it shows a
  neutral placeholder, not a fake map. M0 is a separate Phase-0 pass.
- **Sport-arm picker offers Body → routes to Training.** Reusing
  `ElementPickerSheet` includes the Body row; picking it on the Map jumps to
  Training (Body isn't GPS-recordable). Minor; flagged in case a Map-scoped
  picker without Body is wanted later.
- **Two commits, not per-sub-pass (single-concern at the spine altitude).** The
  tab layout, its screens, the root-stack registrations, and Settings › Views
  (the door that keeps Reflect reachable) are interdependent — splitting them
  finer yields non-building intermediate states. Split into map primitives
  (`f79cdc2`) + shell wiring (`e10eac7`), each of which builds and tests clean.
- **Profile "(tabs)" back-title** — pushed screens show the group name as the
  iOS back label; pre-existing app-wide behavior (settings/gear/etc. already do),
  not introduced here. Cosmetic; a `headerBackButtonDisplayMode: 'minimal'` sweep
  could clean it later.

## Explicitly NOT done / deferred

- **H6** (Home→Map Record deep link) — deferred; needs M2 first.
- **M2** (background recording + on-map save sheet), **M0** (keyless basemap) —
  separate map passes.
- **P2** (real logbook on Profile), **P5** (identity editing + Gear Quiver
  module), **P8** (Reflect retirement + residual tap-in) — later profile passes;
  P8 stays gated on N1 + P4.
- On-map live-trace recording — folded into M2.

## Status

- **Pass:** Session 6 — the shell swap. `main` @ `e10eac7`, 2 commits ahead of
  the Session-5 close-out.
- **Tests:** 1250 jest / 119 suites passing; tsc clean.
- **⚑ flags:** 6 (M1 Record scope · H6 deferred · M0 deferred · Body-in-arm-picker ·
  two-commit spine · pushed-screen back-title) — all judgment calls with the
  reasoning above; none block Session 7.
- **Deferred:** H6, M0, M2, P2, P5, P8.
- **Safe to leave as-is.** Working tree clean (aside from the pre-existing
  untracked `.claude/skills/` and `planning/nutrition-tab-v2-spec.md`). Sim left
  on the Map tab, location set to Hood River, OR. Metro on 8081. **NOT pushed**
  (main is `NOT pushed` per the standing pattern). Ready for Session 7 (Logbook →
  Profile + Reflect retirement).

**Notion / memory sync:** flagging for status-sync — the "Active Work" hub row
should move to "Phase 2 shell swap done: 5 tabs + Profile stub + Map Record
pre-start + sectioned Settings + Stimulus-ledger tap-in + Reflect off-bar
(routable via Settings › Views); H6/M0/M2/P2/P5/P8 pending." The
`project_app.md` memory `⭐ CURRENT main` pointer is now stale (was `1138c6c`,
now `e10eac7`) and due for a refresh.
