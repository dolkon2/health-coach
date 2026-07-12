# Social layer — expansion brief for Fable

v1 — 2026-07-11, from a scoping talk-through with Dylan. **This is a research + planning
handoff, not a build spec.** It does not replace `planning/rework/tabs/social-tab.md`
(the consolidated, constitution-aligned Social spec) — it sits on top of it, records the
scope Dylan confirmed in this session, and flags where his current thinking *diverges*
from what that spec has locked so Fable resolves the fork instead of silently picking a
side.

**Read `social-tab.md` first.** It already owns: the "logbook IS the feed" model, the
grant-layer visibility architecture, the no-counts/no-app-authored-content guardrails,
the structurally-unshareable non-session kinds, privacy zones as a hard gate, and the
S0–S7 build ladder. Everything below assumes that foundation and only adds to or
questions it. Where this brief and `social-tab.md` disagree, **that disagreement is the
point** — it's a decision flagged for Dylan, not a resolved fact.

## 0. Decisions Dylan locked in this session (2026-07-11, round 2)

These resolve several of the flags below — recorded here up top so Fable treats them as
settled inputs, not open questions. Details folded into the relevant sections.

- **Photos are first-class, Strava-style.** Confirmed (§2). Not optional, not secondary.
- **Share is in, and it means re-sharing a friend's entry** — "yo check out the homie
  did a cool route, I wanna try that." So sharing another person's session outward IS the
  intended use, within grant limits (§2, ⚑B resolved).
- **Messages first; Groups is a soft research side.** Resolves ⚑G: build **Messages**
  (DMs + simple threads) as the MVP chat surface; the Discord-vibe **Groups** concept
  becomes an exploratory research track, deferred — not MVP (§3).
- **Heatmap = historical** for the map layer (§4). Confirmed.
- **Live location is a separate, opt-in feature** tied to when live tracking is on —
  a "Find My Friends"-style live line of your current location, opt-in only. In scope as
  a *future* layer on the background-GPS work, not the heatmap MVP (§4, ⚑C resolved).
- **Follow model, Strava/Instagram-style** — asymmetric follow, not mutual-friends-only.
  This **overrides** `social-tab.md`'s locked ⚑4 (mutual-only). Founder call made; the
  constitution tension it raised still needs careful privacy defaults (§5, ⚑F resolved).

## 1. The shape Dylan confirmed (this session)

Four pillars, in his words:

1. **Feed** — the logbook entry *becomes* a post. Photos are first-class (see §2 — this
   is the biggest delta from the current spec), plus the route map, a headline/stat
   block, and a highlight/statement. Likes (kudos), comments, and **shares**.
2. **Messages (DMs)** — WhatsApp-style 1:1 and small ad-hoc group chats.
3. **Groups** — Dylan is now leaning toward these being **a separate, more structured
   thing than chat — a "Discord server vibe": persistent communities with things
   happening inside them**, not just a named WhatsApp thread. See §3 — this is a real
   architectural fork from `social-tab.md`.
4. **Friend heatmap** — a map layer showing where your friends/followers are active.
   See §4 — the historical-vs-live distinction is the whole ballgame here.

Plus the depth pieces Dylan endorsed from the earlier pass (§5): partner tagging,
segments/leaderboards-as-a-question, follow-vs-friend, moderation floor, notification
line. He liked "not just DM/group chats but more structured too — that was the OG idea."

## 2. NEW: photos as first-class in the logbook post

`social-tab.md`'s `FeedEntryCard` currently leads with *the fact of the session* (who /
sport / when / duration), treats numbers as secondary, and mentions only a **route
thumbnail** — photos aren't in the model at all. Dylan wants **photos to be a key part of
the post**: "key photos, also the map, or like a highlight or a statement."

This is additive, not a conflict, but it's real new work and it touches the record, not
just the feed:

- **A logbook entry needs a photo attachment model.** There's an existing camera/photo
  pipeline to build on — `planning/ring2-camera-build.md` (camera + barcode merged to
  main; photo→LLM on a branch). Whether session photos reuse that capture path or get
  their own is a Fable question. Storage of the image blobs (local + eventual sync/CDN)
  is a backend-era cost to scope.
- **The feed card becomes photo-forward** when a photo exists, and falls back to the
  route-map hero (the current design) when it doesn't. Both already have precedent in
  the Strava screenshot Dylan referenced.
- **Constitution check:** photos are self-expression, not an outcome metric, so they
  don't trip rule 5. But "highlight/statement" text is a new authored field on the entry
  — confirm it's owner-authored prose, never app-generated, and that it inherits the
  same `notes`-style privacy sensitivity (excluded from shared projection unless
  explicitly included? or is the statement *meant* to be the public caption? — a genuine
  design question, flag ⚑A).
- **Shares — RESOLVED IN (⚑B).** The third reaction Dylan named, absent from
  `social-tab.md` (which has only comments + the ⚑5 "ack"). Dylan's intended use is
  explicitly **re-sharing a friend's entry**: "yo check out the homie did a cool route, I
  wanna try that." So a share re-broadcasts another person's session — that's the desired
  behavior, and it makes shares constitutionally spicier than a like. The grant model
  still binds: **a share can never widen the original owner's grant.** Fable to design the
  seam — likely a per-entry `shareable` bit the owner controls (a friends-visible entry
  the owner marked shareable can be re-shared *within its allowed audience*, e.g. into a
  DM/thread with someone who already has access, or onward only to people the owner's
  grant reaches). The "save this route to try it" action (save-to-own-library) is the
  concrete payoff and ties into the Route entity + Pinned Spots save-as-spot flow.

## 3. FORK: Messages vs Groups — Dylan is reconsidering the locked shape

**RESOLVED (⚑G): Messages first; Groups = soft research, deferred.** Dylan's call this
session: build **Messages** (DMs + lightweight ad-hoc group threads — WhatsApp-shaped) as
the MVP chat surface. The **Discord-vibe Groups** idea (structured communities, channels,
roster, events) is real and still wanted, but becomes an **exploratory research track**,
not an MVP build — Fable should research and cost it as a future direction, not spec it
for the first ship. The rest of this section is the reasoning behind the two shapes, kept
so the research track has the framing.

**This is the most important thing in this brief.** `social-tab.md` locked (decision #4)
that the **Social tab = Feed + Groups**, where "Groups" is WhatsApp-shaped: named group
chats that also hold lightweight posts and events, with DMs folded *inside* the Groups
section (MVP inclusion flagged ⚑1). Chat — DMs and groups alike — was treated as **one
transport**, build-vs-buy, "not an Observation-shaped problem."

Dylan is now floating a **different split**:

- **Messages** = the chat transport. 1:1 DMs + lightweight ad-hoc group threads.
  WhatsApp. This is *conversation*.
- **Groups** = something bigger and more structured — **"a Discord server vibe, things
  happening etc."** A persistent *community/place*, not a thread. This implies:
  multiple channels or sections inside one group, a member roster with maybe roles,
  events, posts, pinned content, an identity of its own. This is *place*.

This is a real product fork, and Fable should treat it as one to research and cost, not
assume away:

| | `social-tab.md` (locked #4) | Dylan's current lean |
|---|---|---|
| Chat | One transport; DMs live inside Groups | **Messages** is its own surface (DMs + simple threads) |
| Groups | A named group chat + posts/events | A **structured community** (channels, roster, events, posts) — Discord/Heylo-shaped |
| Tab count | Feed + Groups (2 sections in 1 tab) | Possibly Feed + Groups + Messages, or Messages as a top-right surface like a chat inbox |

Consequences Fable must weigh:
- **Where does Messages live?** A third section of the Social tab? A chat-inbox behind
  the top-right message icon (the screenshot's speech-bubble glyph, top-right of Home)?
  The latter keeps the tab as Feed + Groups and matches Strava/Instagram's inbox pattern.
- **Discord-model Groups is materially more backend and UI** than WhatsApp-groups:
  channels, roles/permissions, membership tiers, discovery. It pushes hard on the
  build-vs-buy chat evaluation (a Discord-like needs more than a chat SDK's default group
  primitive) and on the "coordination, not competition" guardrail (a busy multi-channel
  community is where app-authored engagement creep sneaks back in — see `social-tab.md`
  §6.8 and risk R9).
- **The constitution still binds.** A Discord-vibe group is fine *as long as* the app
  remains a host that never authors, scores, or nudges. Fable should explicitly map the
  Discord feature set against rule 5 and flag anything that can't survive it (e.g.
  activity leaderboards-as-a-channel = no; a "planning" channel = yes).

**Recommended framing for Fable:** research the Discord-vibe-Groups vs
WhatsApp-groups-plus-separate-Messages options as an explicit design comparison with
cost/complexity per side, and bring Dylan a recommendation — do NOT just pick one. This
supersedes-or-confirms locked #4, which is a founder call.

## 4. NEW: the friend heatmap — pick historical, not live (probably)

`social-tab.md` mentions a "cohort route layer" deferred to S7 and owned by `map-tab.md`.
Dylan wants this more prominently: **"heat mapping of your friends/followers on the map …
that'll be a layer to it all."** Two very different products hide under one word:

- **(a) Historical heatmap** — aggregated *past* routes of your friends, à la Strava's
  global heatmap scoped to friends. Reuses GPS data the app already captures. Privacy
  story is the existing privacy-zones gate (`map-tab.md` §6) plus aggregation. **Medium
  lift, on-brand, recommended.**
- **(b) Live location** — where friends are *right now*, Life360-style. **Massive** lift:
  real-time location transport, continuous background GPS, battery, and it directly
  overlaps the background-GPS recording work already queued for Session 8. Privacy load
  is an order of magnitude higher. This is a different app.

**RESOLVED (⚑C).** Both, but staged and cleanly separated:
- **MVP heatmap = (a) historical**, friends-scoped, behind privacy zones. This is the
  map layer.
- **(b) Live location = a separate, opt-in feature** — Dylan: "when live tracking is on,
  like Find My Friends, that's more of a line with your live location — opt-in." So it's
  a **live-line-of-your-current-position** surface (Strava Beacon / Find My-shaped),
  switched on only while a live-tracking session is recording, strictly opt-in per share.
  It rides on the **background-GPS recording work (Session 8)** — Fable should treat it as
  a future layer on that, NOT part of the heatmap MVP, and scope its real-time transport
  + battery + granular opt-in consent separately.

Either way the heatmap **hard-depends on privacy zones existing** (the Strava military-base
heatmap incident is the standing precedent — `social-tab.md` §6.6 already makes zones a
gate). Fable should treat zones as a prerequisite row for the heatmap, same as for feed
route thumbnails.

## 5. Depth pieces Dylan endorsed (carry into research)

From the prior pass, all confirmed "great additions":

- **Partner tagging.** Tag who you trained with; mutual verification; seeds both feed
  richness and group/DM formation ("you did this together" → suggests a thread). New
  field on the session record; grant/consent implications (tagging someone exposes that
  you were together — the tagged person should be able to decline/untag). Flag ⚑D.
- **Segments / leaderboards.** Strava's other social pillar. Maps onto existing
  conditions/spot data (river gauge, climbing routes, ski runs — the Pinned Spots
  entity). **But it is the sharpest edge against rule 5** (persistent leaderboards are
  refused outright in `social-tab.md` §6.8; leaderboards may exist *only* inside a
  member-created challenge). Research question, not a build item: is there *any*
  constitution-safe form of "who's logged this spot / this stretch" that is witness, not
  competition? (e.g. a name list of who's been here, never ranked/timed). Flag ⚑E — this
  is a genuine tension, don't paper over it.
- **Follow vs friend — RESOLVED to the follow model (⚑F).** Dylan's call: **asymmetric
  follow, like Strava/Instagram** — not mutual-friends-only. This **overrides
  `social-tab.md`'s locked ⚑4** (which chose mutual-only on the grounds that "an audience
  you perform for warps the log"). That research concern doesn't vanish just because the
  model changed — so Fable must carry it forward as **privacy-default discipline**:
  sharing still ships default-Private (opt-in per entry), notes still excluded, and the
  follow model must not add app-authored performance pressure (no follower counts as
  status — the no-counts guardrail §6.2 still binds even with a follow graph). Mutual
  connection likely still governs **Messages** (you DM people you're connected to, not
  anyone who follows you) — Fable to define the follow-graph vs DM-reachability seam.
- **Moderation floor.** Block + unfriend + report, required the moment accounts exist —
  block especially before any DM ships. Non-negotiable, belongs to the identity pass.
- **Notification line.** `social-tab.md` ⚑6: zero app-initiated notifications; the only
  defensible exception is a message a human deliberately addressed to you (DM, group
  chat, an RSVP'd event change). Messages-as-first-class (§3) makes this ruling *more*
  urgent — a chat product with zero notifications is broken, so the line has to be drawn
  before the Messages build.

## 6. The five sub-systems, sized (for phasing the research)

These are wildly different in size — Fable should scope and phase them, not research
"social" as one blob (the failure mode is shallow-across-all-four instead of solid on
what ships first):

| Sub-system | Rough size | New vs `social-tab.md` |
|---|---|---|
| Identity + **follow** graph (Strava/IG-style) | L (backend era begins here) | Follow model overrides spec's mutual-only ⚑4 (§5) |
| Feed + reactions + **photos** + comments + shares | M, **+ photo model is new** | Photos & shares are new (§2) — both locked in |
| **Messages** (DMs + simple threads) — **MVP** | M (chat SDK buy-candidate) | Split out from Groups, built first (§3) |
| **Groups (Discord-vibe)** — **soft research, deferred** | **L+** (research track only for now) | Not MVP; research/cost as a future direction (§3) |
| Friend heatmap (historical) — **MVP map layer** | M, depends on privacy zones | Promoted from a deferred S7 map layer (§4) |
| Live location (Find-My-style) — opt-in future | XL, rides on Session-8 background GPS | Separate opt-in feature, not the heatmap (§4) |

## 7. Open questions / flags for Fable to resolve or bring back to Dylan

**Resolved this session (settled inputs, not open):**
- **⚑B ✓ Shares IN** — re-sharing a friend's entry is the intended use, within grant
  limits; owner-controlled `shareable` bit; save-to-own-library is the payoff (§2).
- **⚑C ✓ Heatmap historical** for MVP; live location a separate opt-in future layer on
  Session-8 background GPS (§4).
- **⚑F ✓ Follow model** (Strava/IG asymmetric), overriding spec ⚑4; privacy defaults +
  no-counts guardrail carry forward (§5).
- **⚑G ✓ Messages first**, Groups-as-Discord = deferred soft research (§3).

**Still open — for Fable to resolve or bring back to Dylan:**
- **⚑A** — Is the post's "highlight/statement" a public caption (meant to be seen) or a
  private note (sensitive, excluded by default)? Shapes the shared-projection rule.
  (Lean: Strava-style caption = meant to be seen, but confirm.)
- **⚑D** — Partner tagging consent: tagged person can decline/untag; tagging exposes
  co-presence.
- **⚑E** — Any constitution-safe form of segments/"who's logged this spot"? Or fully
  deferred with challenges? (Sharpest rule-5 edge.)
- Carried from `social-tab.md`: ⚑1 MVP cut, ⚑2 placeholder tab, ⚑3 grant-table seam,
  ⚑5 the ack, ⚑6 notification line, plus its §10 open questions (chat build-vs-buy,
  where "add friend" lives, moderation floor).

## 8. Suggested handoff instruction to Fable

> Read `planning/rework/tabs/social-tab.md` (the consolidated Social spec) and this
> brief. Do NOT re-derive the constitution guardrails — they're locked. §0 records
> decisions Dylan already made (follow model, Messages-first, historical heatmap, shares
> in, photos first-class) — treat those as settled and build the plan around them. Your
> job: (1) resolve or cost the still-open flags ⚑A/⚑D/⚑E and the carried `social-tab.md`
> flags; (2) do the build-vs-buy chat evaluation the spec calls for, sized primarily for
> **Messages** (DMs + simple threads), with the **Discord-vibe Groups** as a separate,
> clearly-labeled soft-research track (cost + shape, not a first-ship spec); (3) research
> the photo attachment model (reuse `ring2-camera-build.md` pipeline or new) and its
> storage cost; (4) research the historical friend heatmap (reuses existing GPS + privacy
> zones) and separately sketch the opt-in live-location layer as a future rider on the
> Session-8 background-GPS work; (5) produce a revised, phased build ladder that extends
> `social-tab.md`'s S0–S7 with the follow graph, photos, shares, Messages, the historical
> heatmap, and partner tagging slotted in. Bring recommendations, not just options, on
> every remaining founder call — but flag each so Dylan rules. Do not write code; this is
> a planning pass.
