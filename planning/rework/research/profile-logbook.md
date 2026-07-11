# Profile-as-logbook + tap-in architecture — precedent research + assignment proposal

*Research date: 2026-07-11. Input to the product-rework planning pass. Companion to
`social-feed-groups.md` (same pass — owns the feed/audience model), `social-tab-spec.md`
(REF social branch), `cohorts-spec.md` § Profiles, and `screens-features-status.md`
(REF nav branch). Web findings gathered 2026-07-11.*

**Scope note — locked decisions treated as fixed:** 5 tabs (Home / Training / Map /
Nutrition / Social); Profile is a persistent top-right avatar, Settings a top-right gear,
neither a tab; the training logbook lives on Profile and **the logbook IS the social feed**
(shared entries, per privacy scoping, are the feed content); the Stimulus Ledger is highly
deferred and lives in Settings as a tap-in. This doc asks: what do profile-centric apps
teach about splitting history/identity (Profile) from live activity (tabs), what the
top-right avatar/gear convention buys and costs, how a real surface survives living under
Settings, and — the deliverable — an assignment table for what lives on Profile vs Settings
vs stays tab-side. Four placements are genuinely contestable and ⚑-flagged; the rest are
called.

---

## 1. Profile as the home of history + identity — precedents

### Strava: the profile/feed split, and the counter-precedent

Strava is the cleanest working example of the exact split we've locked. The
[profile page](https://support.strava.com/hc/en-us/articles/216917697-Your-Strava-Profile-Page)
is the *aggregated, browsable* self: the activity log filtered by week/month and by
time/distance/elevation, per-sport stats (last-4-weeks averages, year totals, all-time
totals), a photo strip — while the feed is the *live, chronological* stream of what just
happened. History reads best aggregated and navigable; live activity reads best as a
stream. Two different reading modes, two different surfaces, one underlying log — precisely
the logbook-is-the-feed architecture we've committed to.

What Strava bolts onto that profile is the part we refuse: the
[Trophy Case](https://support.strava.com/hc/en-us/articles/216918557-The-Strava-Trophy-Case)
(challenge finisher badges, four most recent promoted on the profile), KOM/CR tabs, and
follower counts as headline stats. Each is an app-authored artifact that exists nowhere in
the world. The keep/refuse line for our Profile in one test: **a module may render only
things that already exist in the world.** Sessions, gear, user-written benchmarks, all-time
totals (revealed facts, same status as the benchmarks-spec's consistency counters) pass;
badges, trophies, scores, completion percentages fail.

One counter-precedent to record honestly: in its recent nav rework Strava went the *other*
way — the new tab bar is
[Home, Maps, Record, Groups, You](https://road.cc/content/tech-news/new-look-incoming-stravas-app-layout-283095),
with the old Profile and Training tabs merged into a bottom-tab "You." Strava concluded
self-history deserves permanent bottom-nav real estate. Our nav is locked and this doesn't
reopen it — but it raises the stakes on discoverability of the avatar route (§ 2) and on
cross-links from tabs into the logbook. Strava also validates the privacy shape:
[profile page privacy controls](https://support.strava.com/en-us/articles/15401967-profile-page-privacy-controls)
scope the profile per-audience, which matches `cohorts-spec.md`'s "profile is a projection
of the user's own data, filtered by their privacy settings — not a separate data structure."

### 8a.nu: what happens when the profile grows a score

Covered in depth in the sibling doc (`social-feed-groups.md` § 1): 8a.nu's profile *is* a
scorecard — points per ascent, global ranking — and the result was grade-chasing and
scorecard performance; people's actual climbing changed to feed the number. The lesson for
Profile specifically: the moment history aggregates into a **rank or score**, the profile
stops being a mirror and starts steering behavior. Our Profile may sum (total sessions,
total km — facts) but never *scores* (no points, no rank, no percentile).

### Duolingo: the profile as trophy shelf (the anti-pattern)

Duolingo's profile is the purest inversion of what ours must be. The top of the profile is
"Personal Records" — longest streak, total XP, highest league — followed by stacked
achievement badges, with
[leagues, streak-freezes, and friend-streaks](https://trophy.so/blog/duolingo-gamification-case-study)
layered on top. Every headline element is an app-authored reward; the documented cost is
[streak anxiety and compulsive engagement that resembles addictive social media more than
the underlying activity](https://healthmattersandme.substack.com/p/duolingo-analyzing-all-engagement).
It works spectacularly *for Duolingo's retention model* — which is exactly the model the
constitution refuses (spine rule 5, and the pressure will be strongest here: a profile is
the single most tempting surface in the app to decorate). Concretely: no "longest streak"
headline (a consistency count may appear *inside a benchmark's own history* as a fact, per
`benchmarks-spec.md` § Consistency counters — it is never promoted to profile-identity), no
XP-shaped aggregate of any kind, no level, no league.

### Slopes: the other pole

Also from the sibling doc: Slopes ships a working social layer with **no public profiles at
all** — mutual invite-link friends only. Useful as a reminder that the profile is an
*optional projection*, private by default (`cohorts-spec.md`: "nothing is public by default
except what the user explicitly makes visible"). Our Profile's self-view is always full;
its outward view may legitimately be nothing.

---

## 2. The top-right avatar + gear — what the convention buys and costs

**The convention is strong and works in our favor.** The avatar-in-top-right-corner as
"me/account" is an ecosystem-wide pattern across
[every first-party Google app](https://9to5google.com/2025/06/20/fullscreen-google-account-switcher-redesign-list/)
(Gmail, YouTube, Maps, Photos, Drive…), and users reliably decode avatar = me. Since our
Profile literally *is* "me" (my history, my gear, my goals), the icon is semantically
honest.

**The reachability cost is real but correctly spent.** The top corners are the hard thumb
zone;
[NN/g and current mobile-nav guidance](https://www.nngroup.com/articles/mobile-navigation-patterns/)
consistently place frequent actions in the bottom 40% of the screen and warn against
critical actions in top corners. That's fine here *because of what we put there*: Profile
and Settings are retrospective/config surfaces, not the daily loop. The log bar, the glance
modules, and Record all stay bottom-tab-side. The derived rule worth writing down:
**nothing needed mid-workflow may live only behind the avatar or gear.** (This is why the
logbook's *write* path — logging — never touches Profile; only the *read* path lives
there.)

**The discoverability cost needs active mitigation.** Hidden/corner navigation measurably
depresses discovery —
["if users cannot see it, they assume it does not exist"](https://www.uxpin.com/studio/blog/mobile-navigation-patterns-pros-and-cons/)
— and an avatar reads to many users as "account settings," not "my logbook." Strava judged
this cost high enough to promote You to a tab. Since our nav is locked, we mitigate with
**tap-throughs from content instead of a tab** — Decision (obvious call):

- Your own entries in the Social feed open into your logbook (same entity, so this is free).
- The session-save confirmation deep-links to the new logbook entry.
- Training keeps a small "History →" header link that jumps to Profile › Logbook (history
  *left* Training as a surface; a pointer costs one row and repairs the "where did my
  history go" moment for anyone migrating from the 4-tab era).
- Tap-to-profile from any name in Social (already in the nav plan) trains the avatar→profile
  association from the other direction.

**The avatar and gear never badge.** No unread dot, no red count — an indicator on a
persistent header control is a push mechanism wearing an icon (constitution: no badges;
pull, not push). Whether *messages* in Social ever earn a notification is the sibling doc's
question; the header stays inert regardless.

**Header real estate — Decision (obvious call):** avatar + gear form a fixed right-side
cluster on every tab; tab-specific header controls (Map's layer switcher, Nutrition's
Focus toggle) take the left/center or move into the tab body. Two persistent targets is
already the ceiling for a top bar; per-tab specs should treat the top-right as spoken for.

---

## 3. Settings as a tenant landlord — keeping the Stimulus Ledger findable-enough

The known failure mode is the
["junk drawer"](https://medium.com/design-bootcamp/ux-smack-down-the-junk-drawer-problem-a80b4e80a566):
settings/profile sections that accumulate miscellaneous screens until nothing is findable,
in a world where
[only ~20% of shipped features see common use](https://mrx.sivoinsights.com/blog/how-to-improve-feature-discoverability-in-ux-research).
For the Stimulus Ledger, though, partial burial is the *point* — "highly deferred" is a
product status, and Settings placement expresses it honestly (the engine keeps running in
`core/`; the surface waits). The pattern that keeps a tenant surface alive without
promoting it:

1. **Sectioned Settings, with tenants in a named section.** Settings is not a flat list:
   *Preferences* (units, pinned activities), *Connections* (HealthKit/Health Connect state
   — migrating here from Home per `home-tab-spec.md`, integrations), *Privacy & sharing*
   (visibility defaults, per-audience scoping), *Protocols* (PT protocol definitions — the
   `dimension-body-build.md` settings-KV screen; daily ticking stays tab-side), *Data*
   (export), and **Views** — the tenant section. The Stimulus Ledger is a *view*, not a
   preference; labeling the section "Views" (or "Data views") keeps it from reading as a
   toggle and gives future tenants (debug surfaces, raw-observation browser) a home.
2. **A recorded graduation condition.** Settings-as-tenant is a parking pattern, not a
   permanent address. Per the nav-branch status doc, the ledger "may return as a Reflect
   mode" — write that as the exit: *if/when Reflect ships a ledger mode, the Settings entry
   retires.* A tenant with no exit condition is how junk drawers form.
3. **No dead-end burial.** The one cross-link that stays: Reflect's no-benchmark default
   view is the stimulus ledger (`benchmarks-spec.md` § No-benchmark default) — that
   rendering *inside Reflect* is unaffected by where the standalone tap-in parks. The
   Settings entry is for deliberately seeking the full ledger, nothing more.

---

## 4. Assignment table — Profile vs Settings vs tab-side

**The organizing test:** Profile holds what is *identity and history* — social-facing or
potentially so, a projection of the user's own data filtered by privacy scoping. Settings
holds what is *private configuration and parked machinery* — inputs to engines, never
social. Tabs hold the *live loop* — anything touched in the act of training, logging,
navigating, or checking conditions today.

| Surface | Home | Why | Status |
|---|---|---|---|
| Training logbook + calendar (all dimensions) | **Profile** | The feed's source-of-truth; history/identity, aggregated + browsable (Strava profile model) | **Locked** |
| Gear Quiver | **Profile** | Social-facing, customizable module (moved from Settings 2026-07-09) | Locked (2026-07-09) |
| Current benchmarks display (user's own words) | **Profile** | `cohorts-spec.md` names it a profile default — "the social atom"; management stays elsewhere | Decision (obvious call) |
| Connections (friends/follows list) | **Profile** | Strava precedent; profile is where "who I am to others" lives; graph *mechanics* stay a Social-doc question | Decision (obvious call) |
| "Preview as" (see own profile as a given audience sees it) | **Profile** | Direct consequence of profile-as-projection; the honest way to make scoping legible | Decision (obvious call) |
| Completed/archived benchmark history | **Profile ⚑** | Fits "history/identity" (the arc of past goals); rival claim: Reflect owns the *story* of a benchmark | ⚑ contestable — see below |
| Nutrition adherence-benchmark history | **⚑ undecided** | Genuinely open per today's decisions — options below, no call made | ⚑ **open — do not decide here** |
| Units, appearance, pinned-activities preference | **Settings** | Pure preference; pinned activities editable inline everywhere it's consumed | Decision (obvious call) |
| Integrations + HealthKit connection state | **Settings** | Config, not data; `home-tab-spec.md` already migrates connection state off Home | Decision (obvious call) |
| Privacy & sharing defaults | **Settings** | Private config; per-entry overrides stay at log time (Ring-1 scoping rule) | Decision (obvious call) |
| Body profile (height, DOB, restrictions, medications, activity level) | **Settings** | Private engine inputs (TDEE cold-start, coach grounding); never social-facing | Decision (obvious call) |
| PT protocol definitions | **Settings** | Already specced there (`dimension-body-build.md`); daily ticks stay tab-side | Decision (obvious call) |
| Stimulus Ledger tap-in | **Settings › Views** | Deferred surface; honest parking with a recorded graduation condition (§ 3) | **Locked** |
| Data export | **Settings › Data** | Config-adjacent, rarely used, must exist | Decision (obvious call) |
| Benchmark creation + management | **Training** | `benchmarks-spec.md` § Three surfaces: created/managed on the planning surface; behavior faces resolve there | Recommended ⚑ — placement was explicitly deferred in the nav-branch status doc (Home vs Profile vs Training); this doc recommends Training, confirm |
| Routes library | **Training** | Reusable assets, not history | **Locked** |
| Pinned Spots | **Home** (glance) + **Map** (create) | Locked today; Home layout contention with steps/sleep strip is the Home doc's ⚑ | **Locked** |
| Feed + Groups | **Social** | Locked shape | **Locked** |
| Reflect entry point | **⚑ undecided** | See below | ⚑ contestable |
| Summoned coach door | **⚑ undecided** | `benchmarks-spec.md` open question, unresolved | ⚑ contestable |

### The four ⚑ flags, expanded

**⚑ 1 — Completed/archived benchmark history: Profile or Reflect?** *Lean: Profile.* The
arc of past goals ("trained for the Gorge race spring '26, hit 100 kg bench in March") is
identity — the kind of thing you'd show a friend, and shareable under scoping. But Reflect
owns benchmark *storytelling* (hero signal, correlation context), and archived benchmarks
"can be revisited to see the arc" (`benchmarks-spec.md` § Lifecycle). Cheapest resolution:
the *list* of past benchmarks lives on Profile; tapping one opens its Reflect-rendered
story. Needs your eyes because it decides where "revisit the arc" starts.

**⚑ 2 — Nutrition adherence-benchmark history: genuinely open (named so today — no call
made).** Options mapped: (a) Profile, with the rest of benchmark history — consistent, but
nutrition data is the most private class in the app and defaults hardest-off socially;
(b) Nutrition tab (Trend mode) — keeps food data in the food room, splits benchmark history
across two homes; (c) Reflect via ⚑ 1's tap-through — no standalone home at all. The
Profile-vs-privacy tension is the real question, and it interacts with scoping defaults.

**⚑ 3 — Reflect entry point.** Reflect is a tap-in with no confirmed door. Candidates:
(a) **Home** — glance modules (benchmark cards) escalate naturally into the correlation
hub; Reflect is a *live analytical* surface, closer to "today's story" than to identity;
(b) **Profile** — retrospective self-knowledge, sits beside the logbook; (c) both (Home
cards deep-link into Reflect; Profile carries the browsable entry). Lean: (c) costs
nothing if Reflect is a routed screen rather than a mounted pane — but this shapes the
Home layout contention (⚑'d in the Home doc) so it needs your call.

**⚑ 4 — Summoned coach door.** `benchmarks-spec.md` flags it verbatim: "settings may be too
buried; a nav tab too central." The Profile sheet is a genuinely good middle — deliberate
tap, never ambient, semantically "mine," and the coach grounds itself in exactly the data
Profile fronts (history, benchmarks, body profile). Counter-argument: putting the one
prescriptive surface next to the social-facing identity surface muddies "a separate room,
not the mirror." Settings › Views is the fallback that errs buried. Needs your eyes;
whichever door wins, it never badges.

---

## 5. Constitution audit (quick pass)

- **Profile modules render only things that exist in the world** — sessions, gear, totals,
  user-written benchmarks. No trophy case, no rank, no score, no streak-as-identity
  (8a.nu/Duolingo are the documented failure modes). ✅
- **Profile is a projection, not a second data structure** — privacy scoping filters it;
  self-view full, outward view opt-in, "preview as" makes the scoping legible. ✅
- **Avatar/gear never badge** — no unread dots on persistent header controls; pull, not
  push. ✅
- **Nothing mid-workflow lives only behind the avatar/gear** — the daily loop stays
  bottom-tab; Profile/Settings hold read-back and config only. ✅
- **Settings tenants get a named section and a graduation condition** — parked honestly,
  not buried into nonexistence. ✅
