# Activity Groups — build spec (community container, channels, events, member-set segments)

v1 — 2026-07-11. Commissioned by Dylan to turn the S9 "Groups / activity groups" bucket
into a real, buildable spec. Authority lineage: sits under
`planning/rework/research/social-expansion-plan.md` (v2, the post-override authority —
especially §1 the public/private + Share/Save model, §2.2 kudos with counts, §2.4 the
segments resolution, §3 the Groups sketch + chat decision, §6 the ladder this extends)
and the amended constitution (`planning/claude-md.md` rules 5 + 6, 2026-07-11); consumes
`planning/rework/research/supabase-backend-spec.md` (the backend/RLS target — B0–B4 are
this spec's substrate) and `social-tab.md` (the tab shell, EventCard/RSVP pattern; its
Groups text is superseded where this file speaks). Where this file and any older
Groups/cohorts text disagree, **this file wins** for the group container, channels,
events-in-groups, and segments; `cohorts-spec.md`'s challenge concepts stay deferred
(§9). Planning only — no code, no migrations, nothing provisioned.

**Settled inputs honored, not reopened:** segments = member-set, ONLY inside
member-created activity groups — never global, never app-authored, never a default
(plan §2.4, amended rule 5); chat = roll-your-own on Supabase, and the community layer
stays OUT of the chat transport — communities/rosters/roles/channels are our own DB rows
pointing at chat rooms (plan §3, backend spec §4 B4); kudos with counts (plan §2.2);
notifications ON, human-action triggers only (plan §2.5, amended rule 6); backend =
Supabase Postgres + Realtime (backend spec, project "avatar training").

Codebase facts leaned on (verified by the sibling specs this session, not re-derived):
local migration ledger 001–017 with **017 burned by `recording_buffer`, next free local
number ≥018, claimed at build time only** (backend spec §8's two-ledgers rule: server
migrations are timestamp-named and never consume a local number); `routes` (016, being
built in Session 9) carries `points TEXT` (JSON `RoutePoint[]`) and
`visibility TEXT DEFAULT 'private'`; `spots` (014) is a point + sport tag, not a line;
the chat spine is backend spec §4 B4 (`threads` / `thread_members` / `messages`) with
membership-gated RLS and Broadcast-from-database delivery.

## 0. What this spec settles vs. what needs Dylan

Settled here (engineering defaults, decided with rationale — flag only if you disagree):
what a group is and isn't (§2); roles = creator/admin/member, **no moderator tier at
MVP** (§2.2); channels ship at MVP with an auto-created #general, extra channels are an
admin action (§2.3); no separate "post" object — messages + pins cover it, mirroring
Profile's session=post decision (§2.3); the invite-token join flow with a minimal
pre-join preview (§2.5); membership is a scope separate from the follow graph (§3); the
server schema + RLS shape and the member-sync trigger that keeps the community layer out
of the transport (§4); the full segment mechanic — two kinds (geo + manual board),
local-only matching, deliberate posting, best-per-member boards with all-time/this-year
windows (§5); the notification set for groups (§6); leave/delete/block semantics (§2.6);
the G1–G4 ladder and its gates (§7).

Needs Dylan (§9): ⚑G1 group discoverability at MVP (invite-link-only vs searchable);
⚑G2 where the G-track slots against arc 2, and whether segments (G4) jump ahead of
events (G3); ⚑G3 member-count display — the small, flagged reversal of the old
"no member counts as status" line (§1.3).

## 1. Purpose & constitution alignment

An **activity group** is the Discord-vibe persistent community the social plan sketched
(plan §3): a place with identity — roster, roles, channels, pinned content, events —
and **the one sanctioned home of member-set segments and leaderboards**. It is the
"opt-in social layer" at its most opted-in: everything inside a group exists because a
member made it, joined it, or posted into it.

### 1.1 The exact constitutional ground (quoted, binding)

Amended rule 5 (`planning/claude-md.md`, 2026-07-11) — the boundary language this whole
spec builds inside, verbatim:

> **The opt-in social layer is the one sanctioned place applause may live.** By
> deliberate founder decision (2026-07-11; detail in
> `planning/rework/research/social-expansion-plan.md`), content a user *chooses to
> share* may carry kudos and follower counts, and members may set their own segments
> and leaderboards inside activity groups they create. The boundary is strict and
> structural, not a matter of taste: (a) a count exists only on content the user
> deliberately shared — a privately-saved session is never scored, so the mirror stays
> countless by construction; (b) competition is member-authored inside a member-made
> group — never app-authored, never global, never a default, never a thing the app
> starts for you; (c) no shareable body-change content — weigh-ins and the like stay
> structurally unshareable. The app hosts what people choose to share; it never authors
> a score, ranks users itself, or defines what winning is.

And amended rule 6, verbatim:

> *Amended 2026-07-11:* the opt-in social layer may notify on things a person did — a
> message addressed to you, a comment, a like, a new follower — all user-toggleable,
> because a human acted, not because the app grew impatient. The line that never moves:
> no digests, no "you haven't logged in a while," no app-authored nudge engineered to
> pull you back.

The reject-test exception carries the same carve-out: *"kudos/follower counts on
deliberately-shared social content, and member-set segments inside member-created
activity groups — a real-world social gesture between people, walled off from the
mirror per rule 5."*

### 1.2 Compatible vs. refused (the plan §3 fence, inherited and extended)

**Compatible (this spec builds them):** member-created groups; member-created channels
as topics; member-authored messages and pinned content; events with RSVP name lists;
member-set segments and leaderboards (§5) — rule 5's explicitly sanctioned shape;
(post-override) member counts, like counts inside group content, and visible rank on a
member-made board; members manually sharing a session *into* a channel later, riding
the plan §6 S6 share mechanic.

**Still refused — orthogonal push/app-authored lines the override didn't touch:**

- Any channel that **auto-posts** members' activity (app-authored content in a
  user-authored stream). This is also why segment entries are posted deliberately, not
  auto-published (§5.4) — rule 5(a) verbatim: *a privately-saved session is never
  scored*.
- **Presence** ("3 online") — a live-tracking concern, not a count. Not built; the
  chat transport deliberately doesn't use Realtime Presence (backend spec §6.1).
- **Engagement digests** ("your group was active this week") — rule 6's never-moving
  line.
- **App-authored segments or boards** in any form: no starter segments, no "popular
  segments near you," no suggested challenges, no default board created with the group.
  The group is born empty; members fill it. (This is `cohorts-spec.md`'s empty-container
  thesis, now constitutional text.)
- **Global or cross-group anything**: no segment appears outside its group; no board
  aggregates across groups; times never render on profiles or in the feed (§5.7).
- **Manufactured rewards for rank**: no crowns, trophies, badges, or "KOM" artifacts.
  The board itself shows who's fastest — a rank rendered in the board members built is
  hosting; a persistent trophy minted by the app is authoring a reward and fails the
  reject-test unamended. (Strava's crown is the app defining what winning is.)
- **"Your time was beaten" pushes — decided-by-default OFF.** Technically
  rule-6-eligible (a human acted), but it's engineered rivalry — a notification whose
  only job is to pull you back into a contest. Not at MVP; listed as decided-by-default
  so it's reversible by Dylan, not by drift.

### 1.3 The one flagged reversal — member counts as status (⚑G3)

`social-tab.md` §6 guardrail 2 banned "member counts as status" alongside all other
counts. The round-3 counts override (plan §2.2) reversed the counts line wholesale for
the opt-in social layer, and a group surface is entirely inside that layer — so a
member count on a GroupCard is now *permitted*. It is still a small posture change from
the old spec's text, so per the flag-don't-reinterpret rule it's ⚑G3, not silently
adopted. Recommendation: show it — a member count on a group you're joining is
informational (how big is this room?), and the invite preview (§2.5) needs it for
informed joining anyway. The mirror is untouched either way.

### 1.4 Why the leaderboard RPC doesn't violate "never ranks users itself"

Stated once so no build pass trips on it: rule 5 says the app "never authors a score,
ranks users itself, or defines what winning is." The `get_leaderboard` function (§4.3)
sorts entries that members deliberately posted into a competition a member authored,
by the metric that member chose. The app supplies arithmetic and rendering; the members
supply the contest, the entrants, and the definition of winning. The refused shape is
the app ranking users who never entered a contest — "most-kudo'd athletes this week,"
"most active member" — which needs no member to have authored anything. That stays
refused (plan §2.2's no-aggregate-leaderboards-from-counts rule, inherited as
guardrail 7).

## 2. What an activity group IS

### 2.1 The concept

A persistent, member-created community: a name, an optional blurb and avatar, an
optional sport/dimension tag (cosmetic + filtering only — it never gates content), a
roster with light roles, one-to-many text channels backed by the chat transport, pinned
content, events with RSVP name lists, and member-set segments/boards. Discord-vibe at
friends-and-club scale — tens to low hundreds of members — not Discord-parity: no
voice channels, no bots, no server tiers, no community-scale mod tooling at MVP. The
scale honesty matters for the transport math too: Supabase Realtime's 500 concurrent
connections on Pro (10k with spend cap off) comfortably covers this shape (backend
spec §2/§6.1).

Where it lives: the **Groups section of the Social tab** (locked decision #4 — Social =
Feed + Groups; `social-tab.md` §2's layout stands). Group list → group screen: channel
chat as the backbone, with Pins, Events, and Boards reachable from the group header.

### 2.2 Roster + roles — creator / admin / member, no moderator at MVP

- **creator** — the member who made the group. Full admin powers plus: delete the
  group, transfer creatorship. Exactly one per group.
- **admin** — promote/demote admins (creator only promotes to admin; admins can
  promote members to admin — decided default: yes, admins can mint admins; the creator
  can always demote), remove members, delete any message or pin in the group, create/
  rename/delete channels, edit/cancel any event, archive/delete any segment, revoke
  invites, edit group identity.
- **member** — chat, pin nothing (decided default: pinning is admin-only — pins are
  curation, and friends-scale groups don't need pin wars), create events, create
  segments and boards (**that's the point — "member-set"**), post entries, RSVP,
  delete their own content.

**No moderator tier at MVP** (decided): a moderator is an admin who can't manage
admins — a distinction that earns its keep at hundreds of strangers, not at
friends-and-club scale. Adding it later is one enum value and a policy tweak; adding it
now is UI and role-matrix surface for nobody. Revisit trigger: the first group that
actually asks for it.

### 2.3 Channels, pins, posts

- **Channels ship at MVP, minimally.** Every group is born with one auto-created
  **#general** channel (so the container is alive from minute one); creating more is an
  admin action (name + position, text-only). The Discord lesson the plan's sketch
  already banked: a channel is *our* row pointing at a chat room — the transport never
  learns groups exist (§4.2). The marginal cost of multi-channel over single-channel is
  a list screen, so deferring it buys almost nothing.
- **Pinned content** — admins pin messages or events to the group's pin bar. Pins are
  references, not copies (unpin = the reference vanishes, the content stays where it
  was).
- **No separate "post" object** (decided): a post is a message; a pinned post is a
  pinned message. This mirrors the Profile decision (session=post, no separate posts
  object — `project-profile-page` / `profile-settings.md`) and keeps the write model
  one thing. If long-form group posts ever matter, they arrive as a message kind, not a
  new table.

### 2.4 Events — the RSVP name-list pattern, reused verbatim

`social-tab.md` §3's EventCard, unchanged in shape: **title, when, meeting-point pin
(opens in Map), optional Route link, RSVP as a visible who's-coming name list, "I'm in /
out" toggle for self.** Capacity, waitlists, payments, recurrence: not at MVP —
big-club features friend groups don't need (decided; recurrence is the first honest
candidate if real usage asks).

One correction against reality: the **Route attachment is deferred** until shared-route
machinery exists (plan §6 S6's save-to-library / shared-routes work). Routes today are
local rows (016) on the creator's phone — a server event cannot reference one. The
meeting-point pin is fine now: it's member-typed coordinates (like writing an address in
a message), not track-derived geometry, so the privacy-geometry line isn't in play.
Events live in a channel (default #general) and render as cards in the chat stream plus
a group-level Events list of upcoming ones.

### 2.5 Join governance — invite links, with an informed-join preview

- **Invite-link/token join is the MVP door** (the Discord model): any member can mint
  an invite link (decided default: members can invite — friends bring friends; admins
  can revoke any invite and can restrict minting to admins per-group later if abused).
  Tokens are unguessable, revocable, optionally expiring.
- **Pre-join preview:** opening an invite shows group name, avatar, blurb, member count
  — nothing else — via a token-gated RPC. Joining a room you can't see anything about
  isn't informed consent (same principle as the plan §2.3 tag-preview grant).
- **Public/searchable groups: deferred, ⚑G1.** Discovery search at MVP finds *accounts*
  (plan §2.6); whether groups should also be findable is a real growth-vs-quiet product
  call, not an engineering default. The schema carries nothing that forecloses it (a
  `discoverable` flag and a search RPC are additive).

### 2.6 Leave / removal / deletion / block semantics (decided defaults)

- **Leave (or admin removal):** membership row deleted → all group content instantly
  unreadable (RLS). The member's **messages persist** (they were addressed to the room;
  deleting them guts conversations — standard chat semantics). Their **board entries
  are deleted** (a standing score is an ongoing publication, not a conversational
  artifact — the un-share principle from backend spec §9.4 applies: revoking the scope
  removes what was published into it). Their events persist ownerless-editable by
  admins; their segments persist (group property once published — the group shouldn't
  lose its course because its author moved away; admins can archive).
- **Group deletion (creator only):** everything cascades — channels, their chat
  threads, events, segments, entries, pins, invites. Warned plainly in the confirm UI;
  honest consequence of deleting the place.
- **Block inside a shared group:** the base block (backend spec §4 B1) severs
  follows/DMs/tags both ways. In shared group channels, Discord's collapse pattern
  (decided): a blocked member's messages render collapsed behind a "blocked member —
  show" affordance; their board entries stay ranked (you blocked them socially, not
  competitively — the contest is the group's, not yours). The group-level remedies are
  leaving, or an admin removing someone. Report (backend spec §4 `reports`) extends to
  group content: `message_id` already covers chat; add event/segment references when
  G1 lands.

## 3. Membership is a scope, not a friendship

Stated as its own section because every policy in §4 hangs on it: **group membership is
a SEPARATE visibility scope from the follow graph. Joining a group grants group content
only.**

- Joining grants: the roster (handles, display names, avatars — the same
  public-identity atoms an Instagram-private account shows), channels and their
  history, pins, events, segments, boards.
- Joining does **not** grant: anything from the 3-layer session-visibility model (plan
  §1.1). A co-member who doesn't follow you sees none of your sessions, logbook,
  benchmarks, or gear — a private account's approval gate is not bypassed by sharing a
  room. The §5.1 resolution algebra (backend spec) has no group input at phase 1, and
  gains none from this spec.
- The only session-derived data that ever reaches a group is what a member
  **deliberately posted into it**: a board entry ({value, date} — §5.4, no geometry, no
  session link at MVP), or later a session shared into a channel via the S6 mechanic
  (which runs the full 3-layer share path, not a group bypass).
- **DMs stay mutual-follow-gated regardless of co-membership** (decided): plan §1.5's
  spam-resistant rule holds — sharing a group with an influencer doesn't open their
  inbox. The channel is the shared room; that's what you joined.

## 4. Data model on Supabase

Extends backend spec §4; same conventions (snake_case, uuid PKs, client-authored rows
keep uuid v7, RLS enabled in the same migration that creates each table — its
guardrail 1). Server migrations are timestamp-named — **no local migration number is
consumed by anything in this section** (two-ledgers rule, backend spec §8). Sketches
are shapes, not DDL.

### 4.1 The community spine (new tables, B5 — inside G1/G2/G3)

- `activity_groups` — `id uuid PK, creator_id → profiles, name, blurb, avatar_path,
  sport_tag?, created_at`. (Named `activity_groups`, not `groups` — clear of SQL
  keyword ambiguity and it's the product's own term.) Avatar rides the existing public
  `avatars` bucket under a `groups/{id}/` path (backend spec §6.2 pattern) — it must be
  invite-preview-visible, so public-bucket is correct.
- `group_members` — `(group_id, profile_id) PK, role ∈ creator|admin|member,
  joined_at`. Exactly one `creator` row per group (partial unique index). Per-channel
  mute lives on `thread_members` (§4.2), not here.
- `group_invites` — `id uuid (the token), group_id, created_by, created_at,
  expires_at?, revoked_at?`. Join = a security-definer RPC `join_group(token)` that
  validates the token and inserts the membership; the pre-join preview is
  `preview_invite(token)` returning name/avatar/blurb/member-count only.
- `group_channels` — `id, group_id, name, position, thread_id → threads, created_by,
  created_at`. **The load-bearing row** (plan §3's finding, honored): the community
  layer points at chat rooms; the transport only ever sees threads.
- `group_pins` — `id, group_id, channel_id?, message_id?, event_id?, pinned_by,
  pinned_at`, CHECK exactly-one-of message/event (the polymorphic-reference pattern
  `notifications` already uses).
- `group_events` — `id, group_id, channel_id, title, details?, starts_at,
  meeting_lat?, meeting_lng?, created_by, created_at, canceled_at?`. No route
  reference at MVP (§2.4). `event_rsvps` — `(event_id, profile_id) PK, status ∈
  in|out, decided_at`. Rendered as the name list, never a count-only summary (a count
  is permitted now, but the name list *is* the feature — who's coming is the
  information).

### 4.2 The transport seam — how channels use B4 chat without the transport learning about groups

B4's RLS gates everything on `thread_members`. A channel's readers are the *group's*
members — so the two must agree without teaching thread policies about groups (which
would put the community layer inside the transport, exactly what plan §3 forbids).
Decided: **a membership-sync trigger.** `create_channel(...)` (admin RPC) creates the
thread + the `group_channels` row and copies current members into `thread_members`;
triggers on `group_members` INSERT/DELETE fan the change out to every channel thread of
that group. Join/leave is rare and groups have few channels, so the write amplification
is trivial — and in exchange, B4's policies, broadcast delivery, replay, mute flag, and
`last_read_at` receipts all work on channels **unchanged**. DM/ad-hoc reachability RPCs
(`create_dm`, `create_group_thread`) are simply not used for channels; channel threads
are minted only by the group RPCs. (Optional hygiene: a `kind ∈ dm|adhoc|channel`
column on `threads` so nothing else ever adds members to a channel thread directly.)

### 4.3 Segments + boards (new tables, B6 — inside G4)

- `group_segments` — `id uuid PK, group_id, created_by, name, kind ∈ geo|manual,
  sport?, geometry jsonb? (geo only: RoutePoint[]-shaped snapshot + computed length_m),
  unit ∈ duration|distance|count|load (manual only; geo is always duration),
  sort ∈ asc|desc (derived from unit: duration asc, the rest desc), created_at,
  archived_at?`. Geometry is a **snapshot owned by the segment** — copied at creation
  from whatever authored it, so deleting the source route later breaks nothing.
- `segment_entries` — `id uuid PK (client v7 — posted from the phone, idempotent
  upsert), segment_id, group_id (denormalized, trigger-enforced), profile_id, value
  numeric (elapsed seconds / meters / count / kg), occurred_at (the session's date, or
  member-stated for manual), source ∈ auto|manual, created_at`. **No geometry column
  exists — entries structurally cannot carry a track** (§5.5). No session reference at
  MVP (§5.4).
- `get_leaderboard(segment_id, window ∈ all|year)` — one RPC: best value per member in
  the window (window function), ranked by the segment's sort. Reads are member-gated
  like everything else; the RPC exists because best-per-member dedup + ranking is
  nicer in SQL than in the client, not because table RLS is insufficient.

### 4.4 RLS shape

Group tables are the same class as chat (backend spec §5.2's third bullet family):
**membership-gated per-row policies via one helper** —
`private.is_group_member(viewer, group_id)` (SECURITY DEFINER, `private` schema,
STABLE, one PK probe), used in every policy `TO authenticated`. Reads: member-only,
every table. Writes, per role: `activity_groups` UPDATE admin+, DELETE creator;
`group_members` DELETE self-or-admin (creator row undeletable except via transfer RPC);
`group_channels`/`group_pins` writes admin+ (via RPCs where a thread must be minted);
`group_events` INSERT any member, UPDATE/cancel author-or-admin; `event_rsvps` self
only; `group_segments` INSERT any member (**member-set is the product**), archive
author-or-admin; `segment_entries` INSERT/DELETE self only (and only into segments of
groups you belong to — the denormalized `group_id` + helper makes that one probe).
Owner-only base tables (`observations`, `media`, `share_grants`) are untouched — no
group policy is ever added to them (backend spec guardrail 2 inherited; the group scope
grants group rows, never spine rows — §3).

### 4.5 Data touchpoints, local side

- **Nothing in this spec touches the local engines or the local `observations` table.**
  Group content arrives as query responses rendered and cached ephemerally
  (`feed_cache`-KV style, backend spec §9.5) — never engine-readable.
- **The one relational local need is segments** (§5.6): the matcher wants segment
  geometry and past match results queryable offline. One local migration, **claiming
  the next free local number ≥018 at build time** (the ledger rule — behind S0.8's
  media table and B2's `sync_outbox`, whichever land first; no number pre-assigned).
- Entry posting rides the existing `sync_outbox` drain (backend spec §9.2) with a new
  entity kind — local act completes first, network follows; idempotent by client v7 id.

## 5. Segments in detail — the KOM mechanic, scoped clean

### 5.1 What a segment is

Two kinds, one table, one board UI:

- **Geo segment** (the headline): a named, member-authored stretch of geometry with a
  direction — "the Lower Gorge sprint," "launch-to-landing XC line," "the mile loop."
  Concretely: an ordered `RoutePoint[]` snapshot (same wire shape as the 016 Route
  entity), a computed length, an implied start gate (first point) and end gate (last
  point). Always ranked by **elapsed time, ascending**.
- **Manual board**: a named, member-authored self-reported ladder for things GPS can't
  time — "strict pull-ups in one set" (count), "deadlift 5RM" (load), "longest swim of
  the season" (distance), "500 m erg" (duration). Entries are typed values members
  post by hand. This is what makes segments real for Body-dimension groups and half
  the 17-sport matrix; without it, "member-set segments" is a cardio-only feature.
  **Excluded by construction: body-mass units.** There is no bodyweight unit in the
  enum, and entries are typed values, never references to weigh-in observations (which
  have no share path of any kind — rule 5(c), backend spec guardrail 5). Human intent
  can't be engineered away, but the app offers no board type whose subject is the
  body's size.

A segment is **not** tied to the Spot entity: a Spot is a point (014) and a timed
stretch is a line. A future optional `spot_id` label ("this segment lives at the White
Salmon put-in") is a cheap nicety, deferred — geometry is the authority either way.

### 5.2 How a member sets one

Any member, from the group's Boards screen:

- **Geo:** three doors, all producing the same snapshot — (a) **draw it** with the
  existing straight-line route builder (the 016/S9 Routes work — reused as a component,
  building geometry that happens to be saved as a segment, not a route); (b) **from a
  route in your library** (copy its points); (c) **from a span of your own recorded
  track** — scrub start/end on a past session's map, and the conversion **strips all
  timestamps** (the Gaia track→route rule the repo already holds: a plan is geometry,
  not performance data — and it also means the segment can't leak your pace).
  Name it, confirm direction, publish to the group.
- **Manual:** name + unit. Two taps. Born empty — the creator's own entry is a post
  like anyone else's.

**Publishing a geo segment is deliberate geometry publication**, and it inherits the
shared-route privacy machinery rather than inventing its own: the creator's privacy
zones + the default ~200 m endpoint trim are checked at publish (creation is blocked
with a plain warning if the segment starts/ends inside the creator's own zone — the
researchers' endpoint-clustering lesson, plan §5). Consequence, recorded honestly:
**geo segments sit behind the Map track's privacy-zones workstream, exactly like S6
shared routes** (plan §8 ripple). If zones lag and G4 arrives first, the honest
de-scope is builder-drawn/library geometry only with the track-conversion door
disabled — not shipping track-derived geometry without the filter (decided default;
the gate is the same one S6 already stands behind, so in practice they land together).

### 5.3 How a time is produced — matching runs on the phone, always

The matcher is **local-only**. Segment definitions sync *down* to members' devices
(they're group content you can read); the matcher runs on-device against the session's
GPS track after save (and on demand against past sessions from the session detail).
The track **never leaves the phone** — matching is not a server feature, and there is
nothing to send: the server-side entry has no geometry column to receive (§4.3).
This is the privacy-geometry line (`map-tab.md`'s hardest rule) held structurally: the
only thing that can cross accounts is `{value, occurred_at}`.

Match definition (tunable heuristics, documented honestly per the conventions rule —
these are starting values with an expected error band, not truth): entering the
**start gate** (within ~30 m of the first point), track staying within a **corridor**
of ~40 m for ≥90% of segment points, then the **end gate** (~30 m of the last point),
in direction. Elapsed = end-gate crossing minus start-gate crossing, gate crossings
interpolated between fixes. Same family of tolerances Strava uses; friends-scale
doesn't need better, and the values live in one constants file when built.

### 5.4 How a leaderboard entry is created — detected automatically, posted deliberately

**Auto-detection, manual publication.** After a session with GPS saves, the matcher
runs against the cached segments of your groups; a match surfaces on the save flow and
the session detail: *"Matched 'Lower Gorge sprint' in Gorge Paddlers — 4:32. Post to
board?"* One tap posts `{value, occurred_at}`. Nothing posts on its own — and this is
not squeamishness bolted onto the override, it's rule 5(a) verbatim: **"a
privately-saved session is never scored."** An auto-posting matcher would score every
Saved session that happened to cross a member's segment — publish-by-ambush, the exact
thing the Share/Save architecture exists to make impossible. The same one-deliberate-
act grammar runs the whole social layer: Share/Save for the feed, post-or-don't for
the board.

Consequences, all decided:

- Posting a time does **not** share the session — no feed entry, no logbook exposure,
  no session link behind the board row at MVP (a group-scoped session projection is
  real machinery; when session-into-channel sharing lands via the S6 mechanic, "attach
  the session" can become an optional second tap).
- Your own unposted matches render privately on your own session detail — elapsed
  time as a fact, your history on that stretch over the years. That's `map-tab.md`
  §1's long-blessed self-vs-self territory, buildable without any of this. **Your
  rank renders only on the group's board surface, never in the mirror** — "you're #2
  in Gorge Paddlers" on your own logbook would be importing the scoreboard into the
  mirror (plan §2.2's rendering discipline, applied).
- Manual-board entries are posted from the board itself (value + optional date).
  `source = manual`; geo posts are `source = auto` (meaning machine-timed, not
  machine-published).
- Retract any of your entries any time — delete, gone, no tombstone (the revocation
  principle).
- Past sessions can be posted per-session from their detail screens (the matcher runs
  on demand); no automatic backfill sweep over your history — same deliberate-act
  grammar.

### 5.5 What's ranked, over what window

- **Ranked value:** geo = elapsed time (asc). Manual = the unit's value (duration asc;
  distance/count/load desc).
- **The board shows best-per-member** — one row per member, their best value in the
  window, with the date; tapping a member row lists their own entry history on that
  segment (their entries are group-published facts). Windows at MVP: **all-time
  (default) and this-year** — two read-time filters on `occurred_at`, no season
  machinery. Time-boxed boards (start/end dates — i.e. `cohorts-spec.md`'s
  "challenges") are the obvious later layer on the same tables and stay deferred (§9).
- Ties: shared rank, chronological within (first to set it holds the line).

### 5.6 Local storage + sync (the build-real details)

- Local: one migration (**next free ≥018, claimed at build time** — §4.5) adding
  `group_segments_cache` (id, group_id, kind, name, geometry, unit, fetched_at) and
  `segment_matches` (id, segment_id, observation_id, elapsed_s, matched_at, posted
  boolean) — so matches are queryable offline and never recomputed per render.
  Engines never read either table (guardrail).
- Down-sync: segment definitions refresh with group content reads (ephemeral cache
  discipline everywhere else; segments are the one cached-relational exception because
  the matcher needs them offline, at trailheads, where this product actually lives).
- Up-sync: entry posts ride the `sync_outbox` (§4.5); retract = outbox delete.

### 5.7 Confirming the shape against the settled decision

**This is the same mechanic as a Strava KOM** — a member-authored stretch of geometry,
auto-timed by gate-crossing detection against a recorded track, producing a ranked
best-per-member leaderboard — **made clean by the member-created-group scoping the
constitution sanctions** (rule 5(b): member-authored inside a member-made group, never
app-authored, never global, never a default), with rule 5(a) supplying the second
structural difference: entries exist only by deliberate post, so a privately-saved
session is never scored. Everything Strava wraps around the mechanic that made it a
global performance economy is refused surface, not missing scope: no public segment
catalog, no segment search/explore, no crowns or trophies, no cross-group aggregation,
no "beaten" pushes (decided-by-default OFF, §1.2), no times on profiles or in feeds.
Anti-cheat honesty, recorded once: entry values are client-computed and self-posted —
spoofable in principle. At member-created-group scale the leaderboard's integrity is
the group's own social business (as it is for every manual board in every gym), and
that is the point of the scoping: Strava needs anti-cheat because strangers compete
globally; a room of people who know each other doesn't. No flagging/verification
machinery at MVP.

## 6. Notifications — rule 6 applied to groups

All group notifications are human-action pings, per-type toggleable, riding the
existing B3/B4 pipeline (backend spec §6.3 — webhooks on human-authored rows; no
client INSERT on `notifications`; no cron, ever):

- **Channel messages** — already covered by B4's message webhook; per-channel mute via
  `thread_members.muted` (free, via the §4.2 sync). New-member joins your group: no
  notification (a join is a fact you see in the roster, not a ping — decided default).
- **Event changes on events you RSVP'd "in" to** — new `event_update` notification
  type (time/place change, cancellation). The `social-tab.md` §5 line contemplated
  exactly this; a human edited a plan you committed to.
- **New event in your group** — decided default ON, toggleable (a member proposing a
  plan is the human action the group exists for); mute-per-group covers the noisy case.
- **NOT built:** digests, "your group was active," presence, "someone beat your time"
  (§1.2), anything fired by silence. The `type` CHECK stays a closed enum — adding a
  type is a visible migration diff, which is the structural guarantee inherited from
  the backend spec.

## 7. Build ladder — G-passes (the S9 bucket, sized)

Turns plan §6's unsized S9 "Groups + events + segments" into real passes. G-passes are
product passes; each ships its server half as timestamp-named Supabase migrations
(continuing the B-series pattern — informally B5 = G1–G3's spine, B6 = G4's), its RLS
+ tests in the same migration set, and zero dashboard-edited schema (backend spec §8).
Base-ladder dependencies are hard: **B1/S1 (identity, graph, blocks, reports) and
B4/S5 (chat transport) precede G1.** Nothing in the G-track depends on S2/S3/S4
(share grants, feed, kudos) — a group is chat + events + boards, not a feed — though
S6's share-into-channel and segment-entry session-attach both arrive only after the
share machinery exists.

- **G1 — Container + roster + invites + #general (L).** `activity_groups`,
  `group_members`, `group_invites`; role model + transfer/join/leave/remove RPCs;
  invite links + pre-join preview; the auto-created #general channel on B4 threads +
  the membership-sync trigger (§4.2); block-collapse rendering; `reports` extension to
  group content; group list + group screen with chat backbone. First community pass,
  the governance surface lands whole — sized L honestly.
- **G2 — Channels + pins (M).** Multi-channel CRUD (admin), channel list UI, pin
  bar (`group_pins`), per-channel mute surfaced. Small server delta; mostly product
  surface.
- **G3 — Events (M).** `group_events` + `event_rsvps`; EventCard reused verbatim
  (§2.4, minus route attachment); event cards in-channel + upcoming list;
  `event_update` + new-event notification types. Meeting pin opens the Map tab.
- **G4 — Segments + leaderboards (L).** `group_segments` + `segment_entries` +
  `get_leaderboard`; the local matcher + the ≥018 local migration
  (`group_segments_cache`, `segment_matches`); the three geo-creation doors (builder
  reuse from the 016/S9 Routes work) + manual boards; post/retract flow through the
  outbox; Boards UI + member-history drill-in. **Geo segments gate on the Map track's
  privacy zones** (§5.2; same gate as S6 shared routes) — manual boards have no gate
  and could even ship as a G4a slice if zones lag.

Sequencing within the track: G1 → G2 → G3 → G4 is the default; **G4 needs only G1** —
if segments are the pull (they're the headline of the whole feature), G4 can jump G2/G3
(⚑G2). Against the base ladder: the plan's arc structure (⚑N7) puts S1–S5 as arc 1 and
S6/S7 as arc 2; the G-track is a coherent arc of its own after S5 — and the plan's own
revisit trigger ("after Messages has real usage — thread behavior will show whether
communities are being emulated in ad-hoc threads") is the honest go-signal for G1.
Dylan has already decided groups are wanted (this spec exists because segments live
here); *when* the track starts relative to arc 2 is his priority call, folded into ⚑G2.

## 8. Guardrails — binding on every G-pass

1. **The group is born empty.** No app-authored channels beyond #general's empty
   shell, no starter segments, no suggested boards, no template events, no seeded
   content of any kind — rule 5(b): never app-authored, never a default, never a thing
   the app starts for you.
2. **No auto-posting of member activity into any channel, ever** — no "Alex logged a
   session" cards, no join announcements, no milestone posts. Every message has a
   human author who typed it (or deliberately shared it, once S6 exists).
3. **A leaderboard entry exists only by a member's deliberate post** — the matcher
   detects, the member publishes. A Saved session is never scored (rule 5(a)); there
   is no auto-entry code path to erode.
4. **Segments and their boards render only inside their group.** No times on
   profiles, in feeds, or on any mirror surface; own-rank never appears in the
   own-logbook view; no cross-group or global aggregation; no aggregate boards built
   from counts (plan §2.2).
5. **`segment_entries` carries no geometry and no session reference at MVP** — the
   schema cannot transport a track; matching is on-device only. Geometry crosses
   accounts solely as member-authored segment definitions, zone-checked + trimmed at
   publish, behind the zones gate (§5.2).
6. **No manufactured rewards for rank**: no crowns, badges, trophies, streaks, or
   milestone artifacts anywhere in the group surface. Rank in the board is the whole
   of it.
7. **The app never ranks anyone who didn't enter**: no "most active member," no
   most-kudo'd lists, nothing ranked that members didn't author as a contest (§1.4).
8. **Group notifications fire on human actions only, per-type toggleable** — no
   digests, no presence, no activity summaries, no re-engagement of any kind; the
   `notifications.type` enum stays closed (rule 6, backend spec guardrail 6).
9. **Membership grants group content only** — no policy anywhere may consult
   `group_members` to widen session/logbook/profile visibility; the base owner-only
   tables gain no group-aware policy, ever (§3, backend spec guardrail 2).
10. **Body-change content has no board**: no body-mass unit, no weigh-in-derived
    entries (rule 5(c)); the weigh-in-aggregate question stays deferred with
    challenges and reopens only aggregate-only, if ever (`social-tab.md` §10.6,
    carried).
11. **The transport never learns about groups**: community structure lives in our
    tables pointing at thread ids; chat policies gate on `thread_members` only,
    populated by the sync trigger (§4.2, plan §3's load-bearing finding).

## 9. ⚑ Flags for Dylan + deferred remainder

**Open (product calls, yours):**

- **⚑G1 — RESOLVED 2026-07-15 (Dylan): invite-link-only to start** (the Discord model) —
  avoids stranger-moderation overhead; searchable public groups may be evaluated later.
- **⚑G2 — RESOLVED 2026-07-15 (Dylan): the G-track starts after Messages (arc 1) has real
  usage** — i.e. in/after arc 2, alongside S6/S7. Leaderboards and advanced chat are
  explicitly "slotted after messages"; segments (G4) do not jump the queue ahead of that.
- **⚑G3 — RESOLVED 2026-07-15 (Dylan): show member counts** — informational, on
  GroupCard + invite preview. Matches the recommendation.

**Decided-by-default in this spec (flag only if you disagree):** no moderator tier at
MVP; admins can mint admins; pinning is admin-only; members can mint invites; no
separate post object; no event recurrence/capacity; event route-attachment deferred to
post-S6; DMs stay mutual-follow-gated across co-membership; leave deletes your board
entries but not your messages; block = collapsed messages in shared channels, entries
stay ranked; "your time was beaten" notifications OFF; new-event notification ON
(toggleable); joins don't notify; matcher tolerances (30 m gates / 40 m corridor /
≥90% coverage) as documented tunables; geo segments behind the zones gate with
builder-only as the de-scope; no anti-cheat machinery; boards show best-per-member
with all-time/this-year windows.

**Deferred remainder of the old S9 bucket (not specced here, on the record):**
time-boxed challenges (a start/end-dated board on these same tables — first candidate
when a group asks); live location (fenced in plan §5, rides Session-8 GPS, unrelated
to groups); Close-Friends-style per-session audience; weigh-in aggregates
(challenges-gated, aggregate-only, if ever); public/creator cohorts at scale; voice
channels (not constitutional, just XL and unneeded).

## 10. Dependencies & doc ripple

- **`social-expansion-plan.md`** — §6's S9 bucket is now sized as G1–G4 (§7 here);
  its §3 Groups sketch is superseded by this spec (the sketch's compatible/refused
  fence carried into §1.2 unchanged); segments confirmed riding the group container
  exactly as its §2.4 resolved.
- **`supabase-backend-spec.md`** — B5/B6 extend its §4 schema per §4 here; the §4.2
  member-sync trigger is the one addition to its B4 chat design (plus the optional
  `threads.kind` column); `reports` gains event/segment references at G1;
  `notifications.type` gains `event_update` + `new_event` at G3. No change to its
  guardrails — 1, 2, 5, 6 are load-bearing here and inherited.
- **`social-tab.md`** — its Groups section (§2) and guardrail 2's member-count line
  are superseded by this file (banner when S0.5-style doc hygiene next runs); its
  EventCard/RSVP pattern (§3) is adopted verbatim; its §10.1 open question (group ↔
  cohort mapping) resolves as: the activity group IS the container,
  `cohorts-spec.md`'s challenges become future time-boxed boards (§9).
- **`map-tab.md` / privacy zones workstream** — gains one consumer: geo-segment
  publish runs the zones + 200 m trim check (§5.2), same gate as S6 shared routes.
  The Routes builder (016, Session 9) is reused as the geo-authoring component —
  build it componentized enough to mount outside the Routes screen.
- **Local migration ledger** — one future claim recorded: G4's matcher tables take
  the next free local number ≥018 at build time (queued behind S0.8 media and B2's
  outbox; no number pre-assigned — the ledger rule).
- **Constitution** — no new amendment needed: this spec builds inside the 2026-07-11
  rule 5 + 6 text and quotes it as its boundary (§1.1); every refused shape maps to
  an existing reject-test.

---

**Summary.** An activity group is a member-created, invite-joined persistent community
— roster with creator/admin/member roles (no moderator tier at MVP), text channels
pointing at the roll-your-own Supabase chat rooms (the transport never learns groups
exist), admin-pinned content, events reusing the RSVP name-list card, and the
constitution's one sanctioned competition surface: member-set segments and
leaderboards. Membership is its own scope — joining grants group content only, never
logbook or profile access, and DMs stay mutual-follow-gated. Segments come in two
kinds: geo segments (member-authored geometry, zone-checked at publish, auto-timed by
an on-device matcher — the track never leaves the phone, and the entries table has no
geometry column to receive one) and manual boards (self-reported units for gym and
non-GPS sports, with no body-mass unit by construction). It is the Strava KOM
mechanic, made clean by rule 5(b)'s member-made-group scoping plus rule 5(a)'s
deliberate post — detected automatically, published only by a tap, so a Saved session
is never scored. Boards show best-per-member over all-time/this-year windows, rank
renders only inside the group, and nothing is rewarded with crowns or badges. Build
lands as G1 container+roster+#general (L) → G2 channels+pins (M) → G3 events (M) →
G4 segments+leaderboards (L, geo half behind the privacy-zones gate), the whole track
gated on S1 identity and S5 chat. Three flags for Dylan: ⚑G1 discoverability
(invite-only recommended), ⚑G2 track timing + whether segments jump ahead of events,
⚑G3 member-count display (recommended: show).
