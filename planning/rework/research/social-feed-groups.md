# Social feed + groups MVP — precedent research + data-model analysis

*Research date: 2026-07-11. Input to the product-rework planning pass. Extends — does not
restate — `social-tab-spec.md` (REF social branch, the authority on the Feed/Groups two-section
shape), `cohorts-spec.md` (the deeper cohort/challenge/events model), and the constitution's
social framing (`product-overview.md` § Social layer; `claude-md.md` "showing up, never
outcomes," privacy scoping designed in from Ring 1). Web findings gathered 2026-07-11;
codebase facts verified against the working tree.*

**Scope note:** the locked decisions are treated as fixed: the Social tab is Feed + Groups;
the training logbook lives on Profile and **the logbook IS the feed** — shared logbook entries,
per privacy scoping, are the feed content. This doc asks: what do the precedent apps teach,
what does logbook-as-feed do to the data model, what audience model fits a mirror-not-coach
product, and where the anti-gamification line sits. MVP coordination scope remains genuinely
open (⚑ throughout) — this doc narrows it, it does not close it.

---

## 1. Logbook-as-feed precedents

### Strava (following feed + profile)

The canonical activity feed: every upload is implicitly a post; the profile is the athlete's
activity log; the feed is the union of followed athletes' logs. Two lessons stand out:

- **The feed and the log are the same object.** Strava never made users "post" their runs —
  logging *is* publishing (subject to visibility). This is exactly the locked decision here,
  and it's the right one: no duplicate "share step," no divergence between what you did and
  what you showed.
- **Algorithmic ordering was a disaster.** Strava replaced the chronological feed with an
  algorithmic one in late 2017 and reversed it under sustained user revolt by
  [March 2020](https://tidbits.com/2020/03/06/strava-finally-listens-to-its-users-brings-back-chronological-feed/);
  today ["Latest Activities" (chronological) is a settings option alongside "Personalized"](https://support.strava.com/hc/en-us/articles/115001183630-Feed-Ordering).
  The complaint was constitutional in our terms: an algorithmic feed is push wearing a feed's
  clothes — the app deciding what "matters." **Decision (obvious call):** chronological only,
  ever. This also answers `cohorts-spec.md` open question #2 for the MVP; the "doesn't scale
  to large cohorts" worry belongs to the deferred creator ring, not to friend groups.

**Steal:** log-is-feed unification; per-activity visibility (below). **Refuse:** kudos counts,
segments/KOMs (already refused), trophies, "Personalized" ordering, app-generated milestone
cards in the feed.

### 8a.nu — the cautionary tale

The oldest logbook-as-feed in any sport: public scorecards of ascents. It is also the clearest
demonstration of what happens when a logbook gets a **score** attached — 8a.nu assigns points
per ascent style/grade and ranks climbers globally, and the result is a well-documented culture
of grade-chasing, soft-grading incentives, and scorecard performance. The logbook stopped being
a mirror and became a leaderboard, and the *content of people's climbing changed to feed it*.
This is the single strongest argument that our feed must carry **no aggregate numbers of any
kind** — the entry is the atom, and nothing sums entries into a rank.

### Mountain Project ticks / UKC logbooks

- **Mountain Project:** ticks were public-by-default for years; user pressure eventually forced
  a [private-ticks option (Oct 2020)](https://www.mountainproject.com/forum/topic/119774692/ticks-can-now-be-private).
  Precedent: retrofitting privacy onto a public logbook is painful and comes after harm.
  We already know this — it's why privacy scoping is a Ring-1 design constraint.
- **UKC:** each logbook has a three-tier visibility setting — [Public / Partners / Private](https://www.ukclimbing.com/logbook/help.php).
  "Partners" (a mutual, hand-picked circle) is the interesting tier: it's an audience model
  built for accountability among people who actually climb together, not broadcast. Closest
  existing analog to our friends layer.

### Slopes

The most privacy-aligned social model found anywhere in this research:
[no public profiles, no usernames, no follower counts — friends connect only via an explicit
invite link, mutually](https://slopes.helpscoutdocs.com/article/188-sharing-your-location-with-friends).
Friends see derived stats, not raw recordings; live location is opt-in, scoped to
same-resort-same-day friends, and deleted from servers after the day. Slopes proves a sport
app's social layer can work with **zero broadcast machinery** — the entire graph is mutual and
deliberate. (Its "private leaderboard for friends" is the one piece we'd refuse outside
member-created challenges.)

---

## 2. Privacy-first sharing — what the floor looks like

Strava's current privacy stack, after a decade of stalking/doxxing incidents, is effectively
the industry's minimum bar
([Privacy Controls FAQ](https://support.strava.com/hc/en-us/articles/360025920332-Strava-s-Privacy-Controls-FAQ),
[Activity Privacy Controls](https://support.strava.com/en-us/articles/15401987-activity-privacy-controls)):

1. **Per-activity visibility** — Everyone / Followers / Only You, plus a user-set default that
   each upload inherits and can override.
2. **Privacy zones** — map trace auto-hidden within radii of home/work; multiple zones.
   Already a hard gate in `gps-mapping-spec.md` § Privacy: zones exist **before** any route is
   cohort-visible.
3. **Field-level hiding** ("Hidden Details") — hide start time, heart rate, calories, gear per
   activity, independent of entry visibility.

The structural insight: visibility is **three separable layers** — *who* can see the entry,
*which fields* of it they see, and *what the geometry reveals*. Our model needs all three from
day one, but tuned to our defaults: Strava is public-by-default with opt-out; we are
private-by-default with opt-in (`cohorts-spec.md` § Profiles), which is also Slopes' posture.

**Decision (obvious call):** a user-level **default audience** setting must exist (per-entry
friction on every log would kill the feed — Strava's default-visibility precedent), but it
**ships set to Private**. Sharing is always a deliberate act at least once (raising the
default), never an ambush.

**Decision (obvious call):** the `notes` free-text field on a session is excluded from the
shared projection by default, with an explicit per-entry include. Notes are where the felt
sense lives — "knee felt wrong," "fight with L before the gym" — the highest-sensitivity field
on the record.

---

## 3. What "the logbook IS the feed" does to the data model

This is the section with teeth. Five consequences:

### 3a. The feed is a projection, not a post store

No `Post` entity for activity items — a feed item **is** a read of someone's session
observation through a permission filter, exactly as `cohorts-spec.md` already frames the
profile ("a view over the user's own data, filtered by privacy settings — not a separate data
structure"). Consequences that fall out for free if we hold this, and become bugs if we don't:

- **Un-sharing is retroactive.** Revoke the grant → the entry vanishes from everyone's feed,
  because the feed never copied it. (Strava gets this right; most "share to feed" designs
  denormalize and then leak.)
- **Edits propagate.** The observation's append-only `supersedes` chain (`data-model.md`)
  means the feed renders the latest version — no stale copies.
- **Deletion is deletion.**

### 3b. Visibility is a grant layer, not a field on Observation

`cohorts-spec.md` open question #6 asked: does the Session/Observation type need a `visibility`
field now, or is it a layer on top? The codebase check confirms nothing exists yet (no
visibility/privacy/share field anywhere in `core/src`). Recommendation: **a separate sharing
grant keyed by observation id** — conceptually
`{ observationId, audience: 'friends' | groupId[], fieldOverrides?, grantedAt }` — not a field
baked into the versioned record. Three reasons:

1. **Changing your mind about visibility is a permission change, not a data event.** Baking
   visibility into the Observation means every share/unshare mints a new version via
   `supersedes`, polluting the edit history and forcing the trend/stimulus engines to know
   about a concern that is none of their business. The constitution's own words — "visibility
   toggling should be a permission change, not a schema migration" — point at the grant layer.
2. **Engines stay pure.** `core/` never reads grants; the correlation engine runs on the
   owner's full data regardless of what's shared. Sharing lives entirely in the sync/backend
   layer.
3. **It matches the Route precedent.** `routes-spec.md`/`gps-mapping-spec.md` (REF) already
   resolved route visibility as a per-object permission (`private | cohortId`) on the Route
   entity. Sessions should use the same mechanism, not a parallel one.

### 3c. Only sessions are feedable — enforce it in the type

`ObservationKind` is `weighIn | session | foodEntry | sleep | steps | subjective`. The feed
consumes **`session` only** at MVP. This is the "no shareable body-change content" rule encoded
structurally: `weighIn`, `foodEntry`, `sleep`, `steps`, `subjective` have **no grant path at
all** — not "private by default," but *unshareable*. A constitution rule that exists as a type
constraint can't erode in a UI sprint.

One noted tension, not resolved here: `cohorts-spec.md` sanctions group-authored challenges
including weight-based ones ("allowed by group, never by app"), which would eventually need
scoped access to weigh-in *aggregates*. That belongs to the challenge build (post-MVP);
making weighIn unshareable now is correct for the feed and can be revisited with a
challenge-specific, aggregate-only mechanism then. ⚑ only when challenges get scoped.

### 3d. The shared projection is a defined subset, not the raw payload

A shared session renders: sport + dimension, when, duration, route (after privacy zones),
and the stats the user's field settings allow — in the "showing up" register: the fact of the
session leads, numbers are secondary. Internal bookkeeping — `fidelity`, `tier`, capture
method — is **not** surfaced socially (obvious call: your friends see what you did, not a
confidence audit of your logging).

### 3e. The real cost is the backend, not the UI

Everything above assumes accounts, a server, and sync — none of which exist (the app is
local-first, single-user). "MVP coordination scope" (⚑ open decision) is therefore mostly a
question about **how much backend to stand up**, and only secondarily about screens. Any
honest MVP scoping conversation should price: identity/accounts, the grant store, server-side
shared projections, and the messaging transport (build-vs-buy chat is already flagged open in
`social-tab-spec.md`; chat-as-a-service — Stream/Sendbird-class — is the plausible MVP answer
precisely because chat is *not* an Observation-shaped problem and carries zero constitutional
IP).

---

## 4. Audience model — friends, not followers

The research divides the field into two families: **asymmetric follow** (Strava, 8a.nu —
broadcast, audience-building, public profiles) and **mutual connection** (Slopes friend-links,
UKC "Partners" — deliberate, small, reciprocal).

The behavioral evidence says the follow model actively distorts the mirror. The Groningen
["Kudos make you run!" study](https://www.sciencedirect.com/science/article/pii/S0378873322000909)
(329 Dutch club runners, 11 months of complete network data) found runners **changed what they
trained to make it more kudos-worthy** — running farther and chasing segments for the audience.
An audience you perform for turns the logbook into content; the log stops being what happened
and becomes what was worth posting. A mirror product cannot have that dynamic at its base
layer.

**Recommendation ⚑ (contestable — `cohorts-spec.md` explicitly deferred this):** mutual
friends + group membership as the only two audience primitives at MVP. No asymmetric follow,
no public profiles, no "Everyone" visibility tier. Visibility values: `private | friends |
specific groups`. The one-to-many case (creator cohorts) is already deferred and is better
served by *membership in a public cohort* than by a follow graph — so deferring follow
forecloses nothing. Slopes is the existence proof that this works in production. Flagged
rather than decided because it shapes the product's growth mechanics, which is a
founder-level call.

---

## 5. The ack question — kudos is a score with a thumb icon

The evidence that kudos-counting is gamification, not decoration:

- Strava recorded [14+ billion kudos in 2025, +20% YoY](https://trophy.so/blog/strava-gamification-case-study)
  — it is the engagement engine, and Strava treats it as such.
- The Groningen study: receiving kudos → more/longer runs; behavior warps toward
  kudos-worthiness; reciprocity obligations form ("kudos-friends"). Notably, **peer influence
  (seeing what friends actually did) mattered more than kudos in 4 of 5 clubs** — i.e., the
  *feed itself* carries the accountability value; the applause layer is separable.
- Instagram's like-count-hiding experiments ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0191886920307005),
  [rollout coverage](https://digitalwellbeing.org/instagram-extends-hiding-likes-to-promote-digital-wellbeing/))
  found visible counts amplify negative affect from social comparison; hiding the *number*
  while keeping the gesture reduced the comparison dynamic (results mixed but directionally
  consistent). The number is the harmful part.

Constitutional read: a kudos **count** fails "does this reward the user with anything that
doesn't already exist in the world" — an aggregate applause score exists nowhere outside the
app. A **comment** passes — a friend saying "nice one, that line looked spicy" is a text
message that happens to live next to the entry; it's precisely the friend-to-friend
accountability channel the whole social thesis is built on.

**Decision (obvious call):** comments on shared entries are in — they're the product's entire
social point. No counts displayed on anything, anywhere (comments render as the words, not a
number badge).

**⚑ Genuinely contestable — a countless ack:** is there room for a single lightweight
acknowledgment ("seen/felt by *Alex, Priya*" — rendered only as a **name list**, never a
numeral, no aggregate anywhere, no notification)? For: the Groningen data shows lightweight
social recognition does sustain showing up, and demanding a typed comment as the only response
channel may mean most entries get silence, which reads as absence of witness — and *witness*
is the accountability product. Against: any one-tap gesture drifts toward reciprocity-theater,
and the name-list-not-number discipline will be under permanent pressure to "just show the
count when it's >5." This is a real fork; both positions are defensible under the
constitution. Needs the user's call before the Social design pass.

---

## 6. Groups: MVP coordination vs engagement theater

Precedent scan: [Strava clubs](https://support.strava.com/hc/en-us/articles/221622188-Clubs-on-the-Mobile-App)
(events = title + date/time + dropped-pin meeting point + optional route; public/private
membership), [Heylo](https://www.heylo.com/running-club) (the current best-in-class for real
group logistics: events with routes/pace groups, RSVP + capacity/waitlists, event chats,
member profiles — but also attendance milestone badges, i.e. gamified retention),
[komoot group Tours](https://newsroom.komoot.com/236064-komoot-launches-group-tours-for-easier-than-ever-social-adventures/)
(turn any planned route into a joinable group outing), Discord (persistent chat as the
community substrate — `cohorts-spec.md`'s "the fitness app *is* the server" thesis).

**What coordination actually requires (the MVP floor):**

1. **Group container** — name, members, invite-only private. (Public/discoverable groups:
   deferred with creator cohorts.)
2. **Group chat** — persistent thread. This is the backbone; Heylo and Discord both show the
   chat *is* the community, everything else decorates it.
3. **Events** — title, date/time, meeting point pin, optional attached Route (the Route entity
   from `routes-spec.md` — one more reason routes are first-class), RSVP with visible
   who's-coming list. Strava's minimal event shape is the right size; Heylo's
   capacity/waitlists/payments are big-club features friend groups don't need.
4. **DMs** — ⚑ scoping question: `cohorts-spec.md` ships DMs with Ring 4, but for a
   friend-group MVP, group chat may carry coordination alone and DMs could follow. Cheap if
   chat is bought, so this is a scope-discipline call, not a technical one.

**Engagement theater to refuse** (each fails a constitution test): attendance streaks and
milestone badges (Heylo's "reward regulars" — manufactured reward); persistent club
leaderboards (Strava's weekly club leaderboard — leaderboards exist *only inside
member-created challenges*, per `cohorts-spec.md`); app-authored challenge templates ("start
a weight-loss challenge!" — the app suggesting what to put in the container); weekly digests /
"your group was active" notifications (push, trigger = "it's been a while"); auto-posted
join/milestone cards in the feed (app-authored content in a user-authored stream).

**Challenges and events-discovery:** defer both from the MVP. Challenges carry the thinnest
constitutional ice (`cohorts-spec.md` § reconciliation) and need the feed + groups substrate
proven first.

**⚑ The notification line — needs an explicit ruling:** `cohorts-spec.md`'s current position
is *zero* social notifications, and "the medium is the nudge" is right for everything
app-initiated. But a **human-authored direct/group message** is a different object: a friend
chose to say something *to you*; suppressing its delivery makes the coordination layer fail at
its one job (an event time change that nobody sees until they happen to open the app). The
defensible line: notifications may carry only messages a human deliberately addressed to you
(DM, group chat, event you RSVP'd to changing) — never activity, never presence, never
"X posted." `social-tab-spec.md` already lists message notifications as undecided; this is the
decision to make, and it should be made once, in the constitution's language, before the
Social build.

---

## 7. Guardrail summary (the checklist for the Social build pass)

- Feed = shared session entries only; chronological only; no app-authored items ever.
- No counts anywhere: no followers, no kudos totals, no comment-count badges, no member
  counts as status.
- No public tier at MVP: `private | friends | group(s)`, default private, sharing opt-in.
- Grant layer separate from the Observation record; engines never see visibility.
- Non-session observation kinds structurally unshareable (no grant path).
- Privacy zones are a hard gate before any geometry is ever group-visible (existing rule).
- `notes` excluded from shared projections by default.
- Comments yes; ack-without-count ⚑ pending user call; nothing tappable that aggregates.
- Notifications: at most human-authored messages ⚑ pending user call; all else pull.
- No badges, streaks, digests, club leaderboards, or challenge templates — ever.

## Sources

[Strava Privacy Controls FAQ](https://support.strava.com/hc/en-us/articles/360025920332-Strava-s-Privacy-Controls-FAQ) ·
[Strava Activity Privacy Controls](https://support.strava.com/en-us/articles/15401987-activity-privacy-controls) ·
[Strava Feed Ordering](https://support.strava.com/hc/en-us/articles/115001183630-Feed-Ordering) ·
[TidBITS on the chronological-feed reversal](https://tidbits.com/2020/03/06/strava-finally-listens-to-its-users-brings-back-chronological-feed/) ·
[Franken et al., "Kudos make you run!" (Social Networks, 2023)](https://www.sciencedirect.com/science/article/pii/S0378873322000909) ·
[Canadian Running summary of the kudos study](https://runningmagazine.ca/the-scene/new-study-says-strava-kudos-motivate-you-to-run-more/) ·
[Trophy.so Strava gamification case study](https://trophy.so/blog/strava-gamification-case-study) ·
[Hiding Instagram Likes (Pers. & Individual Differences, 2021)](https://www.sciencedirect.com/science/article/pii/S0191886920307005) ·
[digitalwellbeing.org on Instagram's like-hiding rollout](https://digitalwellbeing.org/instagram-extends-hiding-likes-to-promote-digital-wellbeing/) ·
[Slopes: location sharing & friend model](https://slopes.helpscoutdocs.com/article/188-sharing-your-location-with-friends) ·
[Slopes privacy policy](https://getslopes.com/data) ·
[UKC Logbooks help (Public/Partners/Private)](https://www.ukclimbing.com/logbook/help.php) ·
[Mountain Project: "Ticks Can Now Be Private" (2020)](https://www.mountainproject.com/forum/topic/119774692/ticks-can-now-be-private) ·
[Heylo for run clubs](https://www.heylo.com/running-club) ·
[Strava Clubs on mobile](https://support.strava.com/hc/en-us/articles/221622188-Clubs-on-the-Mobile-App) ·
[komoot group Tours announcement](https://newsroom.komoot.com/236064-komoot-launches-group-tours-for-easier-than-ever-social-adventures/)
