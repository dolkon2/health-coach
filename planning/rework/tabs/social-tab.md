# Social tab — consolidated build spec

v1 — 2026-07-11. Part of the coordinated rework set under `planning/rework/tabs/`.
Consolidates `social-tab-spec.md` (social-branch, 2026-07-11, primary),
`planning/cohorts-spec.md` (v0.1 — the deeper cohort/challenge/events model),
`planning/rework/research/social-feed-groups.md` (2026-07-11), the 2026-07-09
constitution amendment to rule 5, and Dylan's locked decisions of 2026-07-11. Where
this file and any older Social/Groups text disagree, this file wins.

Sibling specs referenced: `home-tab.md`, `training-tab.md`, `map-tab.md`,
`nutrition-tab.md`, `profile-settings.md` (named `profile.md` in some siblings — same
spec), all under `planning/rework/tabs/`.

## 1. Purpose & constitution alignment

Social is the Ring 4 accountability layer's front door: the mirror extended to a group.
It is the fifth tab of the locked five (Home · Training · Map · Nutrition · Social),
renamed from "Groups" per locked decision #4: **the Social tab = Feed + Groups
sub-sections**. Its constitutional footing is the amended rule 5 — no streaks, badges,
scores, points, or shareable outcome-competition content; "the same 'showing up, not
outcomes' discipline applies to Profile and Groups." (That amendment exists today only
in the map-nav branch extract of `claude-md.md` — `planning/claude-md.md` on this
branch still carries the pre-amendment rule 5 and the old "personal health + training
hub" intro also quoted in root `CLAUDE.md`; adopting it repo-side, along with the rest
of the decided doc reconciliation no other rework doc owns, is pass S0.5, §7.) The app
hosts the group and never
authors, scores, or nudges on its behalf (`cohorts-spec.md` § thesis): accountability
flows friend-to-friend; all social information is pull; the feed carries no
app-generated highlights, no auto-praise, no aggregate numbers of any kind (8a.nu is
the cautionary tale — a logbook with a score attached stops being a mirror and starts
changing what people do to feed it). This is Ring 4: most of this tab is a later
build, and this spec says exactly what ships when, including what the tab shows in the
meantime (⚑2).

## 2. Information architecture / layout

One tab, two top-switched sections (segmented control at the top of the screen, the
same *visual* idiom as Nutrition's Intake/Trend split — see `nutrition-tab.md` §2; the
state contract deliberately diverges, declared in §3):

- **Feed** (default landing)
- **Groups**

Header carries the shell-standard persistent top-right **avatar** (→ Profile) and
**gear** (→ Settings) — neither is a tab (locked #1; `profile-settings.md`).

### Feed

A chronological stream of friends' shared logbook entries. Locked decision #3,
verbatim: *"the logbook IS the social feed: shared logbook entries (per privacy
scoping) are the feed content."* The logbook itself lives on Profile
(`profile-settings.md`); the feed is its **shared projection** — a read of other
people's session observations through a permission filter, never a separate post store.
Held strictly, this buys (research §3a): un-sharing is retroactive (revoke the grant →
the entry vanishes everywhere — nothing was copied); edits propagate via the
observation's `supersedes` chain; deletion is deletion.

- **Chronological only, ever** — Decision (obvious call): Strava shipped an algorithmic
  feed in 2017 and reversed it under user revolt; an algorithmic feed is push wearing a
  feed's clothes. This also answers `cohorts-spec.md` open question #2 for the MVP.
- Feed items are **sessions only** (see §4). Descriptive register: the fact of the
  session leads (who, sport + dimension, when, duration); numbers are secondary; route
  thumbnail only after privacy zones (see `map-tab.md` §6).
- Feed content mix (activity-only vs activity + member posts at top level) is ⚑
  genuinely open (locked #12) — do not decide; the layout must not preclude either.

### Groups

Coordination, not competition. WhatsApp-shaped: persistent named group chats that can
also hold lightweight posts and events — the group is where logistics live ("who's on
for the river Saturday"). The cohort concepts from `cohorts-spec.md` (challenges,
events, leaderboards-within-challenges) live *inside* a group, never as separate tabs.

- **Group list** → **group screen**: chat thread as the backbone (Heylo/Discord both
  show the chat *is* the community), pinned events, lightweight posts.
- **Events**: title, date/time, meeting-point pin, optional attached Route (the Route
  entity — `routes-spec.md` / `map-tab.md`), RSVP as a visible who's-coming *name
  list*. Strava's minimal event shape is the right size; capacity/waitlists/payments
  are big-club features friend groups don't need.
- **DMs**: in the design (member-to-member reach-out is the human nudge the app never
  sends); MVP inclusion is a scope call inside ⚑1.
- **Challenges**: deferred post-MVP entirely — thinnest constitutional ice
  (`cohorts-spec.md` § reconciliation); needs the feed + groups substrate proven
  first. When built: member-created only, empty container, leaderboard exists only
  inside an active challenge, results never leak outside the group, no manufactured
  rewards.

## 3. Components & states

- **Section switcher** — Feed | Groups. Remembers position within a session; Feed on
  cold open. Decision (obvious call): this deliberately diverges from Nutrition's
  contract (`nutrition-tab.md` §3: resets to Intake on every tab re-entry) even though
  the two controls share a visual idiom. Nutrition resets because Intake is the
  logging loop's landing surface and the switch is one tap; Social keeps position
  because Groups is a live chat backbone — someone bouncing between a group thread and
  the Map while coordinating an event must not be dumped back to Feed on every return.
- **FeedEntryCard** — avatar + name (tap → their profile), sport + dimension
  (dimension color = element token, rebrand track), relative time, duration, route
  thumbnail (only if geometry is shared and zone-filtered), the stats the owner's
  field settings allow. No fidelity dot, tier marker, or capture-method audit — your
  friends see what you did, not a confidence audit of your logging (research §3d). No
  counts of any kind on the card.
- **SharedSessionDetail** — read-only projection; map-hero layout when a route is
  shared (rendering shared with Profile's session detail — `profile-settings.md`).
  Comments thread below: plain words, chronological, no count badge anywhere.
- **GroupCard / GroupScreen** — name, members (names, never a member-count-as-status),
  chat thread, pinned upcoming events, posts.
- **EventCard** — title, when, meeting-point pin (opens in Map), optional Route link,
  RSVP name list, "I'm in / out" toggle for self.
- **States**:
  - *Placeholder (pre-Ring-4)* — see ⚑2. One quiet static panel, nothing interactive.
  - *No friends yet* — a single invite affordance (mutual invite link, Slopes-style)
    plus one descriptive sentence. No guilt, no growth upsell, no contact import.
  - *Empty feed (friends exist, nothing shared)* — "Nothing shared yet." Never
    suggests the user prompt friends to share.
  - *End of feed* — hard stop. No infinite synthetic content, no suggested strangers.
  - *Loading* — skeleton rows; *offline* — last-fetched cache + a plain "showing last
    sync" line; *error* — plain retry.
  - *Groups empty* — "No groups yet" + create/join-by-invite affordances only.

## 4. Data touchpoints

Everything here is descriptive design intent — no code in this pass, and **nothing in
this section touches the local schema before the backend era** (the app today is
local-first, single-user: no accounts, no sync, no visibility field anywhere — verified
in the code inventory).

- **Visibility is a grant layer, not a field on Observation.** The constitution's
  forward reference — "visibility toggling should be a permission change, not a schema
  migration" — is satisfied by a separate sharing grant keyed by observation id,
  conceptually `{ observationId, audience, fieldOverrides?, grantedAt }`, living in the
  sync/backend layer. Reasons (research §3b): a visibility change is a permission
  change, not a data event (baked into the versioned record it would mint `supersedes`
  versions on every toggle); `core/` engines never read grants — the correlation
  engine runs on the owner's full data regardless of what's shared; and it matches the
  per-object-permission principle routes already carry (`visibility` on the Route
  entity, migration 016 — routes are mutable assets, a column is fine there;
  observations are versioned facts, a grant record is right). ⚑3 — the seam (grant
  table vs column) is flagged genuinely open in the consolidation digest; this spec
  recommends the grant layer, pending confirmation alongside the MVP-scope call.
- **Only `session` observations are feedable — enforced in the type.** `weighIn`,
  `foodEntry`, `sleep`, `steps`, `subjective` have **no grant path at all**: not
  "private by default" but structurally unshareable — amended rule 5 encoded so it
  can't erode in a UI sprint. Known tension, deferred: group-authored weight
  challenges (`cohorts-spec.md` sanctions them) would eventually need scoped weigh-in
  *aggregates* — revisit only when challenges get scoped, aggregate-only.
- **The shared projection is a defined subset, not the raw payload**: sport +
  dimension, when, duration, route geometry after privacy zones, plus owner-allowed
  fields. Three separable layers, all present from day one (Strava's post-incident
  privacy stack is the floor): *who* sees the entry, *which fields* they see, *what
  the geometry reveals*. `notes` is excluded from shared projections by default with
  an explicit per-entry include — notes are where the felt sense lives, the
  highest-sensitivity field on the record. Fidelity and tier are never surfaced
  socially.
- **Defaults**: a user-level default audience exists (per-entry friction on every log
  would kill the feed) but **ships set to Private** — sharing is a deliberate act at
  least once, never an ambush. Audience values at MVP: `private | friends | specific
  group(s)`. No public tier (⚑4).
- **Messaging is not an Observation-shaped problem.** Chat (groups, DMs) lives on its
  own transport; build-vs-buy (Stream/Sendbird-class chat-as-a-service is the plausible
  MVP answer — zero constitutional IP in the transport) is ⚑ open (locked #12).
- **Backend prerequisites** (the real cost — research §3e): identity/accounts, the
  friends graph, the grant store, server-side shared projections, message transport.
- **Local migrations**: none required by this spec now. If a local mirror of grants or
  an outbound-share queue lands later, it takes the next free migration number (017+;
  015 is reserved for `spots_sport`, 016 for `routes` — never re-register 010–013).
- **Privacy zones** are a hard gate: the zones entity (not yet schemaed anywhere) must
  exist before any route geometry is ever group-visible (`map-tab.md` §6; existing
  gps-mapping-spec rule). It is a prerequisite row in every Ring-4 plan.

## 5. Interactions & cross-tab flows

- **Feed entry tap** → SharedSessionDetail (read-only projection).
- **Any name/avatar tap** → that member's Profile — a projection over *their* data
  filtered by *their* privacy settings, not a separate structure
  (`profile-settings.md`; `cohorts-spec.md` § Profiles).
- **Own avatar (top-right)** → own Profile, where the logbook lives (locked #3:
  "Training logbook/history lives on Profile — and the logbook IS the social feed").
  The per-entry share control and default-audience setting live on the Profile logbook
  and in Settings respectively — **Social is the read side only**; it never hosts a
  "share" composer for sessions.
- **No logging from Social.** Logging routes through the Home log bar (locked #6: Log
  Session opens the Earth/Sky/Water/Body element picker; Earth/Sky/Water → Map Record
  with sport armed; Body → Training template/session selection). Social never
  duplicates entry points.
- **Event meeting-point pin** → opens on the Map tab. **Event-attached Route** → route
  detail; a friend's shared route can be saved into one's own library (browsed on
  Training, per locked #8); cohort-shared routes render as a togglable Map layer, not a
  separate object (`map-tab.md`).
- **Notifications**: everything app-initiated is banned — no "X posted," no presence,
  no digests, ever. Whether a *human-authored message deliberately addressed to you*
  (DM, group chat, a change to an event you RSVP'd) may notify is ⚑6 — a single
  constitution-language ruling to make once, before the Social build.

## 6. Guardrails — binding on every pass

The checklist from `planning/rework/research/social-feed-groups.md` §7, restated as
acceptance criteria for any Social build pass:

1. Feed = shared session entries only; chronological only; no app-authored items ever.
2. No counts anywhere: no follower counts, no kudos totals, no comment-count badges,
   no member counts as status. Comments render as words; acknowledgment (if any — ⚑5)
   renders as a name list, never a numeral.
3. No public tier at MVP: `private | friends | group(s)`; default private; opt-in.
4. Grant layer separate from the Observation record; engines never see visibility.
5. Non-session observation kinds structurally unshareable (no grant path).
6. Privacy zones exist before any geometry is group-visible (hard gate).
7. `notes` excluded from shared projections by default.
8. Refused outright, each failing a constitution test: attendance streaks/milestone
   badges (manufactured reward), persistent group leaderboards (leaderboards exist only
   inside member-created challenges), app-authored challenge templates (the app
   suggesting what to put in the container), weekly digests / "your group was active"
   pushes (trigger = "it's been a while"), auto-posted join/milestone cards
   (app-authored content in a user-authored stream), algorithmic feed ordering.

## 7. Build passes (ordered; S/M/L; each independently shippable)

This is **Ring 4** — everything below except S0 and S0.5 sits behind the backend era
and ships after the Ring 1–3 surfaces (Home, Training, Map, Nutrition, Profile
logbook) are standing. S0 ships with the 5-tab shell now; S0.5 is pure docs and can
land immediately.

- **S0 — Placeholder tab (S).** `app/(tabs)/social.tsx` renders the quiet static
  panel (⚑2). No storage, no network. Ships with the nav shell.
- **S0.5 — Doc reconciliation (S, pure docs, shippable immediately).** Mirrors
  `planning/rework/brand-integration.md` Pass 3's doc-hygiene pattern. No other spec
  in the rework set owns adopting the decided doc changes the whole set stands on, so
  this pass claims them; it blocks no build work, but should land before any sibling
  pass is built against the amended rule 5. Everything below executes decisions
  already made — nothing here opens or resolves a ⚑:
  1. **Adopt the 2026-07-09 constitution amendments** from the map-nav branch extract
     of `claude-md.md` into `planning/claude-md.md`: the reframed intro (outdoor
     success, Body as infrastructure — with its *Reframed 2026-07-09* note) and the
     amended rule 5 ("shareable outcome-competition content" plus the "showing up,
     not outcomes" rider this spec quotes in §1). Update the root `CLAUDE.md` intro
     line to match. Today the amendment text exists in no file on this branch.
  2. **Groups→Social rename ripple** (locked #4): the root `CLAUDE.md` planning-docs
     index (the `cohorts-spec.md` line), a banner on `planning/cohorts-spec.md`
     (its concepts live on inside the Social tab's Groups section; this spec is the
     consolidation), the Groups-tab wording in `planning/gps-mapping-spec.md`, and
     the merged status doc in item 3.
  3. **`screens-features-status.md` three-way merge**: nav-branch extract as base (it
     alone carries Profile-not-a-tab and Templates-as-Training-modes), fold in the
     home-branch and pins-routes-branch deltas, rename Groups→Social throughout, land
     as `planning/screens-features-status.md`.
  4. **Supersession banners**: `planning/phase-6-plan-tab-spec.md` and
     `planning/phase-6-plan-tab-build.md` (no Plan tab exists in the locked five —
     locked #1; superseded by the rework set), and the stale
     `planning/ai-consultant-prompt.md` line "a persistent Ask button in the
     top-right of every screen" (top-right is avatar + gear per locked #1 — mark the
     line superseded; where the summoned coach's entry point moves is a nav question
     this pass does not decide).
  5. **Archival note** in the merged status doc: "Elements/HBEGPS tab exploration
     ARCHIVED 2026-07-11 (locked #5) — do not revive." Notion still reads "revisit or
     archive"; without a repo-side record the exploration gets rediscovered as new.
- **S1 — Identity + friends graph (L).** Accounts; mutual friend connection via
  explicit invite link (Slopes-style: no usernames to search, no follower counts).
  Shippable as a friends list reachable from Profile. First backend-era pass.
- **S2 — Sharing grants + shared projection (M).** Grant store; per-entry share
  control on the Profile logbook (UI owned by `profile-settings.md`); default-audience
  setting in Settings, shipping Private; server-side projection honoring the field
  subset and notes-exclusion rules. Shippable as "shared" markers on one's own
  logbook — proof the permission model works before any feed exists.
- **S3 — Feed (M).** Chronological feed of friends' shared entries +
  SharedSessionDetail. The tab becomes real. Route thumbnails only if the privacy-zone
  gate (Map track) has shipped; otherwise entries render stats-only.
- **S4 — Comments (M).** Words under shared entries; no counts.
- **S5 — Groups: container + chat + posts (L).** Invite-only private groups,
  persistent chat (buy candidate), lightweight posts. Public/discoverable groups
  deferred with creator cohorts.
- **S6 — Events in groups (M).** Title/when/meeting pin/optional Route/RSVP name list.
- **S7 — Deferred, unsized:** DMs (if cut from ⚑1), challenges, creator/public
  cohorts, cohort map layer (`map-tab.md`), event discovery, moderation tooling.

**⚑1 — Candidate MVP cut (proposed for Dylan's reaction, NOT decided — locked #12
keeps scope open):** S1–S6 — accounts, mutual friends, grants, feed, comments (the
product's entire social point), group chat with events — with **DMs and challenges
deferred**. Rationale: the minimum that delivers both halves of the locked shape (Feed
+ Groups) and the coordination job (event logistics), while deferring everything on
thin constitutional ice. Contestable edges: DMs in or out (cheap if chat is bought — a
scope-discipline call, not technical), and whether Groups ships chat-only (S5 without
S6) first.

## 8. Dependencies

- **`profile-settings.md`**: hard prerequisite. The Profile logbook is the feed's
  source; the share control and profile projection live there. S2/S3 cannot ship
  before Profile's logbook pass.
- **`map-tab.md`**: privacy zones gate any shared geometry (S3 route thumbnails, event
  routes); the Route entity (migration 016) gates event-attached routes in S6; the
  cohort route layer is Map's, fed by this tab's grants.
- **`training-tab.md`**: the benchmark mechanic is the social atom ("current
  benchmarks" is a default profile card — `cohorts-spec.md`) and must be solid before
  cohorts ship. No pass here blocks on the ⚑ benchmarks type question.
- **`home-tab.md` / `nutrition-tab.md`**: no dependency either direction beyond the
  shared shell.
- **Research**: `planning/rework/research/social-feed-groups.md` (guardrails,
  precedent); a build-vs-buy chat evaluation is new work required before S5.
- **Rebrand track (locked #13)**: FeedEntryCard's dimension coding consumes the future
  `elements: {earth, sky, water, body}` token group — mechanics only, no visual values
  finalized here. Nothing in S0–S2 waits on the rebrand.
- **Backend era**: S1 is the first pass anywhere in the product requiring accounts and
  a server; the MVP-scope conversation (⚑1) is mostly about how much backend to stand
  up.
- **S0.5 (doc reconciliation)**: depends on nothing — planning-docs only. Its sources
  are the branch extracts (map-nav `claude-md.md`; nav/home/pins-routes
  `screens-features-status.md`); it can land ahead of even the shell.

## 9. ⚑ Flagged concerns (for Dylan)

- **⚑1 — Social MVP coordination scope** (locked #12 — genuinely open). Candidate cut
  proposed in §7; the DM in/out and chat-only-groups sub-calls need your eyes.
- **⚑2 — Placeholder tab content pre-Ring-4.** Proposal: the tab renders from the
  shell's first ship (a missing fifth tab makes every layout decision provisional),
  showing one static panel — a one-sentence description ("a feed of friends' shared
  logbook entries, and groups for planning things together") and nothing else: no
  waitlist, no "coming soon" hype, no notify-me toggle. Alternative: hide the tab
  until S3. Your call.
- **⚑3 — Visibility schema seam**: grant table (recommended, §4) vs a field on the
  record. Confirm alongside ⚑1 — it shapes the S2 backend.
- **⚑4 — Audience model**: mutual friends + group membership as the only two audience
  primitives at MVP — no asymmetric follow, no public profiles, no "Everyone" tier.
  The research is firm (the kudos study: an audience you perform for warps the log),
  and deferring follow forecloses nothing (creator cohorts are better served by
  public-cohort membership later) — but this shapes growth mechanics: a founder call.
- **⚑5 — The countless ack**: is there room for a one-tap "seen by *Alex, Priya*"
  (name list only, never a numeral, no notification)? For: witness sustains showing
  up, and comment-or-silence may read as absence of witness. Against: any one-tap
  gesture drifts toward reciprocity theater. Both defensible under the constitution;
  needs your ruling before the Feed design pass.
- **⚑6 — The notification line**: current position is zero social notifications; the
  defensible exception is messages a human deliberately addressed to you (DM, group
  chat, RSVP'd-event change) — never activity, never presence. One ruling, in the
  constitution's language, before S5.

## 10. Open questions

1. Does a "group" map 1:1 to a `cohorts-spec.md` cohort, or is a group a lighter chat
   construct with cohorts as a superset? (Carried; interacts with ⚑1.)
2. Feed content mix — activity-only vs activity + member posts at the top level
   (posting possibly reserved for Groups). (Carried; locked #12.)
3. Chat build-vs-buy — evaluate chat-as-a-service before S5.
4. Where does "add friend" live — Profile, Settings, or a Social affordance? (Leaning
   Profile, since the graph is identity-shaped; not decided.)
5. Moderation/blocking floor: even a friends-only MVP needs block + unfriend + report
   the moment accounts exist. Unscoped; belongs to S1 design.
6. Weigh-in aggregates for group-authored weight challenges — deferred with
   challenges; revisit the unshareable-kinds rule only then, aggregate-only.
