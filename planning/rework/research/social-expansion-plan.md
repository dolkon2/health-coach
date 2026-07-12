# Social layer — expansion plan (follow-model resolution, research, revised ladder)

v2 — 2026-07-11. Research + planning pass `social-expansion-brief.md` §8 commissioned;
**revised same day (round 3) after Dylan deliberately overrode the mirror-preserving social
posture** — see the banner immediately below. Lineage: sits on
`planning/rework/tabs/social-tab.md` (v1, the consolidated spec) and
`social-expansion-brief.md` (round-2 decisions). Authority: `social-tab.md` remains the spec
for everything this plan does not touch; where this plan revises it — the audience model (its
⚑4), the reaction model (its ⚑5), the audience values (§4), the guardrails (§6), and the
build ladder (§7) — **this plan wins**, because it records decisions Dylan made deliberately,
not because the original reasoning was wrong. `social-tab.md` carries a banner pointing here.
No code, no schema changes — planning only.

> **ROUND-3 OVERRIDE (2026-07-11) — the deliberate founder decision, on the record.** The
> constitution requires a feature that crosses a north-star line to be flagged once, plainly,
> then honored if the user overrides deliberately (`claude-md.md` rule 5 + intro). This pass
> flagged the full case in v1 §1 (the kudos-study performance-audience risk); Dylan considered
> it and **chose a full public social system with kudos counts.** His words, verbatim as the
> model: *"full social asymmetric… private or unprivate… follow gym influencers, see their
> split, grab that split off their profile… generic, public, or private… if you're public you
> get strong controls of what you want on, the kudos and all that. I'm not stressed about it."*
> Resolved with him this session: **(1) account is public or private** (public = anyone
> follows, no approval; private = approve followers — the Instagram model); **(2) the profile
> is sections** — logbook, gear quiver, benchmarks, identity — **each independently
> public/private, defaulting public ("assumed"), each privatable on its own**; **(3) every
> session, on finish, is a two-button choice: Share or Save** (Share publishes to feed/
> followers; Save logs privately — so a public logbook shows only what you shared); **(4) full
> kudos with visible counts** (likes, follower counts — the normal social experience);
> **(5) influencer-follow + program-grab** is a first-class use case. This **reverses** v1's
> entire §1 (which held approve-gated / no-public-tier / countless / invite-link-only) and
> v1 §2.2 (the countless ack). The override stands. What follows rebuilds the plan around it,
> keeps the guardrails that are *orthogonal* to the audience model (they survive on their own
> merits, not as resistance), and reopened the two whose foundation the override actually moved
> (segments, notifications).
>
> **Second decision round, same day:** Dylan then resolved the reopened calls and the open
> flags — **segments** = member-set inside member-created activity groups (§2.4); **notifications
> ON**, human-action triggers only (§2.5); **Share/Save** side-by-side, no default (§1.1);
> **search** for discovery (§2.6); **chat** = roll-your-own on Supabase (§3) — and instructed
> **"amend the constitution,"** so `planning/claude-md.md` rules 5 + 6 are now amended to record
> the public/kudos/notifications posture (§8). The mirror is preserved by the boundary Dylan's
> own Share/Save model creates: counts and applause live only on deliberately-shared content;
> every descriptive/private surface stays pure.

Codebase facts below verified against `main` this session (they correct several assumptions
in the sibling docs): **migration 017 is already claimed** by `recording_buffer` (016 stays
reserved for routes; the next free number is **018**, not 017 as several specs still say);
**no photo is ever persisted today** (food photos go base64 → Claude and are discarded;
`expo-image-manipulator` and `expo-image-picker` are not installed; no attachment/media field
exists on any payload); **no caption/highlight field, no partner field** exists on the session
record; **privacy zones have zero code**; the `supersedes` chain exists in schema but the
shipped edit path is destructive overwrite ("deferred to Ring 2"); MapLibre v10's heatmap
layer type ships in the installed package but is not exposed in the `mapLibre.ts` adapter
(a one-line addition).

## 0. What this plan settles vs. what needs Dylan

Settled here (decided with rationale, on the record): the account + profile-section + per-
session privacy model (§1); the guardrails that survive the override on their own merits and
the ones that die with it (§1); caption ≠ notes (⚑A, §2.1); full kudos with counts (§2.2);
partner-tag consent architecture (⚑D, §2.3); "add friend"/discovery lives on Profile (§2.6);
moderation floor scope incl. the App Store gate (§2.7); grant-layer seam reconfirmed (⚑3,
§2.8); chat build-vs-buy recommendation (§3); photo pipeline verdict + storage model (§4);
heatmap architecture + the zero-new-exposure rule (§5); the revised ladder (§6).

Resolved with Dylan 2026-07-11 (second round): Share/Save side-by-side no-default (⚑N1);
social notifications ON, human-triggers only (⚑N2); username search for discovery (⚑N3);
segments member-set inside member-created activity groups (⚑N4); chat = roll-your-own on
Supabase (⚑N6, lean); **and the constitution amended** (rules 5 + 6) to record the public/
kudos/notifications posture — done at his instruction (§8).

Still needs Dylan (§7): photos-local early ship (⚑N5); the MVP arc cut (⚑N7); program-grab
timing — launch hook or fast-follow (⚑N8); carried ⚑2 (placeholder tab).

## 1. The social model (post-override) — accounts, sections, per-session share

The v1 stress-test is preserved for the record in git history; its conclusion (hold the line
with approve-gated / no-public / countless / invite-only) was **overridden deliberately** —
see the banner. This section specifies what replaces it.

### 1.1 The three privacy layers Dylan defined

Privacy is now **layered**, each layer a control the owner holds — this *is* the "strong
controls" he asked for:

1. **Account level — public or private.** Public: anyone can follow, no approval; your
   public sections are visible to any viewer and discoverable. Private: you approve each
   follower; nothing is visible to non-approved accounts. This is the Instagram toggle, and
   it's the coarse default that the finer layers refine.
2. **Section level — each profile section independently public/private, defaulting public
   ("assumed").** The profile is composed of sections — **logbook, gear quiver, benchmarks,
   identity** (extend as Profile grows) — and each carries its own visibility toggle. A public
   account can keep benchmarks public but gear private; a private account's sections only ever
   reach approved followers regardless. "Assumed public" = the toggles ship on for a public
   account, off is one tap. (This maps onto `profile-settings.md`'s already-planned per-field
   visibility toggles — §2 identity header, "all social-facing fields carry per-field
   visibility toggles when the backend era arrives" — now promoted from per-field to
   per-section + per-field, and no longer private-by-default at the section level.)
3. **Session level — every session, on finish, is Share or Save.** The save sheet
   (`map-tab.md` §2 save state; the Body/Training save path) presents two actions **side by
   side, neither pre-selected — you pick** (⚑N1 RESOLVED 2026-07-11, Dylan: "share save are
   just side by side you pick"): **Share** (the session enters your feed and your public
   logbook) and **Save** (logged privately — in your own logbook, never published). So even
   with a public account and a public logbook *section*, an individual session is only ever
   public if you tapped Share. The logbook section being "public" means visitors see the union
   of your Shared sessions; Saved ones are yours alone. No default means no publish-by-ambush —
   the deliberate act is structural, which is what keeps the mirror clean under a public
   account.

This composes cleanly: the effective visibility of any one shared session = account type ∩
logbook-section setting ∩ the per-session Share act. The grant layer (§2.8) still stores it as
a record keyed by observation id — the model got richer (a `visibility` that resolves through
three layers) but the architecture is unchanged.

### 1.2 What the audience model becomes

Audience is no longer a small enum on each entry; it's **resolved from the layers**. A Shared
session on a public account reaches followers + public/discoverable viewers; a Shared session
on a private account reaches approved followers only. MVP needs no "specific group" or "close
friends" audience primitive — that's a later refinement (Instagram's Close Friends is the
model if wanted; noted, not scoped). **Asymmetric follow is the graph:** you follow whom you
like; being followed grants nothing in return. Following a public account shows you its public
sections in your feed; following a private account requires their approval first.

### 1.3 Influencer-follow + program-grab (the first-class use case Dylan named)

"Follow gym influencers, see their split, grab that split off their profile" is a genuine
product pillar, and it lands **cleanly on machinery that already exists** — no constitution
tension in the mechanism:

- An influencer's **split/program is their shared session templates** (`session_templates`
  already exists in code; `cohorts-spec.md`'s benchmark/program concepts). A public **benchmarks
  section** and a public **logbook** already expose "what they did"; a program is the reusable
  recipe behind it.
- **Grabbing it = the existing library/draft-session import**, sourced from another user
  instead of from your own creation or a PT. The constitution already blesses this exact shape:
  *"A workout saved from the library is a draft Session… It becomes a real Session when the
  user actually does it and logs the outcome"* (`claude-md.md` Architecture). Grabbed programs
  enter your library as **drafts you chose to pull** — logged only if you actually do them.
- **The one guardrail that carries into this feature intact:** the app may *host* and let you
  *pull* influencer programs, but must never **push** them — no "recommended splits for you,"
  no algorithmic "creators to follow," no "trending programs." The constitution's line is
  explicit and survives untouched: *"The system never pushes 'recommended for you' content from
  the library"* (`claude-md.md`). Discovery of creators is pull (search/browse), never a fed
  recommendation. This is the live edge to hold on this feature; flag any drift.
- Ties into the existing save-to-library flows (routes, spots) — grabbing a route/spot from a
  public profile is the same act (§6 S6 shares).

### 1.4 Guardrails: which survive the override, which die with it

The override moved the *audience* foundation. Some guardrails rested on that foundation and
**die honestly** rather than being kept as zombie rules; others are **orthogonal** and survive
on their own merits. Naming both so nothing is silently kept or silently dropped:

**Die with the override (do not enforce these against the new model):**
- No-public-tier (`social-tab.md` §6.3) — reversed by decision.
- No-counts / countless-ack (§6.2, v1 §2.2) — reversed: full kudos with counts (§2.2).
- Approve-gated-everyone, invite-link-only, countless-graph (v1 §1) — reversed: public
  accounts follow openly and are discoverable; follower counts show.
- Mutual-only default-private-per-entry as the *baseline* — replaced by the layered model
  (sections default public; per-session Share/Save is the deliberate act instead).

**Survive on their own merits (orthogonal to audience — keep enforcing):**
- **`notes` stays private by default.** The felt-sense field is not the audience's business
  regardless of how public the account is; excluded from every shared projection unless the
  owner explicitly includes it per entry. (Caption is the public-facing text — §2.1.)
- **No app-authored content in the stream; no algorithmic feed ordering.** Chronological, no
  "recommended for you," no auto-posted milestone cards. This is a *push-vs-pull* rule, not an
  audience rule — it's untouched by going public. (Kudos/comments are user-authored, fine.)
- **EXIF-strip on photos + privacy zones on geometry** stay hard gates (§4, §5). A public
  account makes these *more* load-bearing, not less — public reach is exactly when a leaked
  home coordinate hurts.
- **Notification discipline** — *partly* survives: the "app never fires because it's been
  quiet too long / no digests / nothing app-authored" half is untouched and binding (amended
  rule 6). The "no social notifications at all" half **died** — Dylan turned social
  notifications on (§2.5): human-action pings (message, comment, like, follow) are fine; the
  app-initiated nudge never is. The surviving line is *human-caused vs. app-initiated*, not
  *social vs. none*.
- **The mirror surfaces stay clean by construction.** Kudos live on *shared/public* content;
  a session you **Saved** (private) is never public, so it carries no count — your private
  logbook and Reflect never become a scoreboard, without any special rule, because the count
  only exists where you chose to publish. (This is the reconciliation that lets full counts
  coexist with the mirror: 8a.nu's failure was a score welded onto the logbook itself; here the
  score lives only on the copy you deliberately pushed to a feed.)

### 1.5 The DM-reachability seam (brief §5)

Under asymmetric follow, DMs need a reachability rule that isn't "anyone who follows you can
DM you" (that's a spam surface, especially for public accounts). Recommendation: **DMs require
mutual follow** — you can message accounts you both follow each other. For public
accounts/influencers this means a follower can't DM the creator unless the creator follows
back — the standard, spam-resistant default. Ad-hoc group threads: the creator adds their own
mutuals; thread members needn't be mutual with each other (a thread carries no logbook access,
so being added by a common friend leaks nothing). No message-request inbox from non-mutuals at
MVP. Block (§2.7) overrides all of this.

## 2. Flag resolutions

### 2.1 ⚑A — highlight/statement is a caption, and it is NOT notes

**Two fields, two registers.** The highlight/statement is a **caption**: owner-authored prose
written *for the audience*, included in the shared projection **by default**. `notes` stays
what it is — the private felt-sense field, excluded by default. Do not collapse them into one
field with a visibility toggle: a single field means text written as a private note can be
ambushed into publicity by a later share (or vice versa), and the sensitivity boundary becomes
a checkbox instead of a structure. Confirms the brief's lean (Strava-style caption = meant to
be seen). Discipline riders: owner-authored only, never app-generated, never prompted (no
"add a highlight!" nudge — an empty caption is a valid state); editable/deletable with edits
propagating through the projection. Code fact: no such field exists — it's a payload-level
addition alongside `notes` when the logbook pass that renders it lands (no migration; payload
is JSON).

### 2.2 ⚑5 resolved by the override — full kudos with visible counts

**Decided (2026-07-11): full kudos with counts**, reversing v1 §2.2 and `social-tab.md` ⚑5's
countless-ack position. Dylan chose the normal social experience — like counts, follower
counts, the works — with the performance-audience risk flagged and accepted. What ships:
likes on shared entries and posts, rendered **with their numeral**; follower/following counts
visible on public profiles. This is the biggest single reversal in the plan and it is on the
record as his deliberate call.

The reconciliation that keeps this from re-creating 8a.nu (§1.4, restated because it's the
load-bearing detail): **counts exist only on content you deliberately Shared.** A session you
**Saved** is private, so it is never liked and never counted — your own logbook and Reflect,
the *mirror* surfaces, stay countless by construction, without a special rule. 8a.nu's failure
was a score welded onto the logbook itself; here the score lives only on the copy you pushed to
a feed. Two disciplines that remain worth holding even under full counts, because they cost
nothing and protect the mirror half: (a) **do not surface a kudos/like count on the private
logbook view of your own entry** — if a shared entry also appears in your own-logbook mirror
view, the count belongs on the feed/detail projection, not on the mirror card (small rendering
call, not a founder decision); (b) **no aggregate leaderboards built *out of* counts** — a
like count on a post is fine; a ranked "most-kudo'd athletes this week" board is the
app authoring competition and is the §2.4 segment question, not this one. Ships with the
comments pass (S4→ renamed S4 comments + kudos).

### 2.3 ⚑D — partner tagging is consent-first, structurally

- **A tag renders nowhere socially until the tagged person accepts it.** Pending tags are
  visible only to tagger and taggee. (Decline-after-visible is not consent — co-presence is
  the sensitive fact, and it would already be leaked.)
- The tag invite carries a **scoped single-entry preview grant** so the taggee can see what
  they'd be attached to before accepting — accepting a tag on an entry you can't read is not
  informed consent. The preview grant does not widen anything else.
- **Untag any time, retroactively, no tombstone.** The projection model makes this free —
  the tag vanishes from every render because nothing was copied.
- Accepted tags render on the **owner's entry only** (visible to whoever the owner's grant
  reaches — which is why acceptance comes first). No auto-cross-posting into the taggee's
  logbook or their followers' feeds at MVP; the taggee's own log stays theirs.
- Blocks sever tags both directions (existing and future).
- Code fact: no partner/with field exists on any payload — additive payload field + a
  consent record on the backend. Sized M as its own pass (S8, §6).

### 2.4 ⚑E/⚑N4 — segments: RESOLVED — member-set inside member-created activity groups

**Decided 2026-07-11 (Dylan: "the segments would be self set in activity groups").** Segments
and leaderboards are **in**, but only in one shape: a **member creates an activity group and
the members set their own segments/leaderboards inside it.** Never global, never app-authored,
never a default the app starts for you. This is the cleanest possible resolution — it's
*exactly* the container the constitution already sanctioned even before the override
("leaderboards exist only inside a member-created challenge/group"), so it needs no new
constitutional ground; the override only made the surrounding kudos/counts fine, and this lands
segments in the one place that was always allowed. It's now written into amended rule 5:
"members may set their own segments and leaderboards inside activity groups they create…
member-authored inside a member-made group, never app-authored, never global, never a default."

Consequences for the ladder:
- **Segments defer with Groups (S9).** "Activity groups" is the Groups concept (§3's deferred
  Discord-vibe research track, or its lighter first form) — segments are a *feature inside a
  group*, so they ride whenever groups ship, not the main arc. No global/spot-level ranked
  board appears anywhere in S1–S8.
- **The lighter witness surface still stands, separately:** on a spot/route detail, an
  **unordered name list of connections who've shared sessions there** ("Alex and Priya have
  paddled this stretch" — no times, no ranking) can ride S7 with the heatmap. It's a read over
  existing grants, not a competition, and it needs no group. Keep it distinct from group
  segments: this is witness, the group leaderboard is the sport.
- **Personal self-vs-self segment history** (your own times on a stretch over the years) is
  the constitution's long-blessed `map-tab.md` §1 territory — not social, buildable anytime,
  independent of all this.

### 2.5 ⚑6/⚑N2 — social notifications: RESOLVED — ON (standard social)

**Decided 2026-07-11 (Dylan: "the notifications are cool I changed my mind for real for
reals").** Social notifications are **on** — the standard experience: a message addressed to
you, a comment, a like, a new follower all notify, **per-type user-toggleable** so anyone who
wants quiet can have it. This is now written into amended rule 6: "the opt-in social layer may
notify on things a person did… because a human acted, not because the app grew impatient."

**The one line that did not move, and never does** (amended rule 6, restated so no build pass
erodes it): **no digests, no "you haven't logged in a while," no app-authored nudge engineered
to pull you back.** A notification may carry only something a *person did* — every allowed
trigger is a human action (their message, their comment, their like, their follow). The app
never fires because it's been quiet too long. That is the whole distinction rule 6 was built on
and it survives the override intact: what's now allowed is *human-caused* pings, not *app-
initiated* ones.

Implementation consequence unchanged: whatever push infrastructure ships must let *us* own the
trigger list — an SDK that force-sends its own engagement/digest pushes fails the requirement
(§3 criterion). The roll-your-own-on-Supabase option (§3) satisfies this by construction; a
bought SDK must be configured to send nothing on its own.

### 2.6 Connections + discovery (carried open Q4, ⚑N3) — Profile-hosted, and now findable

**Profile hosts Connections** (follower/following lists **with counts** now — §2.2, follow/
request state, the shareable profile link) — the graph is identity-shaped, matching
`profile-settings.md`'s §2.5 connections slot. Settings carries the privacy side (account
public/private toggle, per-section visibility).

**Discovery is in (⚑N3 RESOLVED 2026-07-11, Dylan: "there will need to be a search for
discovery").** Public accounts — influencers above all — are useless if they can't be found,
so v1's invite-link-only door is gone. The discovery surface:
- **A shareable profile link / handle** — the primary door, how an influencer is followed off
  their bio/other platforms. Accounts get a username/handle so profiles have a stable address.
- **Username/name search** — the confirmed core mechanism; find a public account and follow it.
- **Deliberately still OFF at MVP** (each a separate later lever, none required by the
  use-case): contact-import (privacy-heavy), and algorithmic "suggested users"/"creators to
  follow" — that last one stays off not as a scope choice but because it's the
  pushed-recommendation line the constitution still forbids (§1.3; amended rule 5/6 sanction
  *human* social actions, not app-authored recommendation feeds). Search is pull; a
  suggestions feed is push.

Private accounts still connect by approval (search finds them, follow is a request). Blocking
(§2.7) removes an account from your search/discovery entirely.

### 2.7 The moderation floor (carried open Q5) — scoped, and it's an App Store gate

Ships **inside S1**, not after it. Floor: **block** (hard: severs follow both ways silently,
prevents follow/tag/DM/comment/re-share, hides all content both directions), **remove
follower** (revoke one approval without the nuclear option), **report** (user + content,
delivered to an owner-monitored queue — at MVP an admin email/dashboard is honest and
sufficient, with a stated response practice). Note for scoping honesty: Apple's UGC
guidelines (App Review 1.2) require reporting, blocking, a filtering mechanism, and published
contact for **any** app with user-generated content — including a Messages-only ship. So the
floor is not just ethics; it is a launch gate for the first social binary, and one criterion
in §3's build-vs-buy (bought chat SDKs ship block/report primitives; self-built means
building them).

### 2.8 ⚑3 — grant layer reconfirmed (the layered model needs it more, not less)

The three-layer privacy model (§1.1: account × section × per-session Share/Save) makes the
grant-record argument *stronger*, not weaker. Visibility now resolves through three
independently-changeable inputs — flip your account private, toggle the logbook section, or
Save-not-Share one session — and each would, under a visibility-column-on-the-record design,
either mint `supersedes` versions on untouched observations or force the `core/` engines to
learn about audiences. A **sharing grant keyed by observation id** absorbs all three layers
plus follower-set churn without touching a single record or the engines. Reconfirmed;
`social-tab.md` §4's architecture stands. The resolved audience is computed at read time from
(account setting, section setting, the per-entry Share grant, the follower graph) — the grant
record stores the per-session Share decision + any per-entry overrides; account/section
settings live on the profile/settings record; the projection endpoint joins them.

New code fact attached to this seam: the `supersedes` chain is schema-only today — the shipped
edit path is destructive overwrite. The feed's "edits propagate / deletion is deletion"
properties (§4) assume versioned-or-authoritative server state; **S2 must include either
finishing the supersede path or making the server projection the authority on current-version**.
Recorded as an S2 work item so it's priced, not discovered.

## 3. Messages — chat build-vs-buy; Groups as a costed future

Evaluation run 2026-07-11 (current pricing verified on vendor pages, not recalled) against
the criteria this product actually imposes: Expo SDK 53/dev-client fit; **full ownership of
the push trigger list** (§2.5's ruling must be enforceable — an SDK that force-sends
engagement pushes is disqualified); block/report primitives (the §2.7 floor); cost at honest
scale (<1k MAU year one, maybe 10k later); data export / migration-off; offline behavior;
ad-hoc group threads now with a channels-in-a-community path later.

**Eliminated:** Sendbird (permanent free tier is only 100 MAU — ~$349/mo from roughly day
one, and data export is paywalled behind the $499/mo tier: paying for the right to leave);
TalkJS ($279/mo with no free production tier, WebView-rendered UI, RN SDK in beta); PubNub
($98/mo at 1k MAU and retention-capped history); Twilio Conversations (now branded
"classic" — Twilio's pre-EOL pattern; do not start on it); self-hosted Matrix/Rocket.Chat/
Tinode (operating a chat server is a second product, and matrix-js-sdk on RN is a known
minefield — wrong for a solo founder even with agents).

**The two defensible answers:**

1. **Stream Chat (buy) — the recommendation.** Free to 1,000 MAU, and the Maker Account
   (≤5 people, <$100k funding) extends a free Start-plan to 2,000 MAU — $0 for the entire
   realistic first arc. Best RN/Expo story of any vendor (official `stream-chat-expo`,
   opt-in SQLite offline support), and block/flag/mute/ban are SDK calls, not projects —
   the §2.7 floor and the App Store gate come mostly built. On the push rule: Stream sends
   nothing unless push is explicitly configured, and the clean pattern is to skip vendor
   push entirely and drive our own Expo-push pipeline from Stream webhooks — the trigger
   list stays in our code, satisfying the ruling. Export APIs exist (channels/messages as
   JSON), so the exit is real. **The known cost is the cliff:** past ~2k MAU the next tier
   is $399/mo — a good problem, but a real one; recorded so it's chosen, not discovered.
2. **Roll-your-own on Supabase (build) — the constitutional-purist alternative.** Four
   tables (threads, members, messages, receipts), RLS policies, Realtime delivery, and an
   edge function doing push fan-out — where "nothing notifies unless a human addressed you"
   is a property of the architecture, not a vendor setting, and data ownership is
   unconditional at $0–25/mo forever with no MAU math. Honest effort: ~2–4 agent-weeks to a
   solid DM+threads MVP (one week happy path; the rest is offline/retry/delivery edge cases
   that bought SDKs have already paid for), plus block/report built by hand (~a day).

**The deciding variable is the backend-platform choice — and Dylan is leaning Supabase**
(⚑N6, 2026-07-11: "the vendor stuff maybe supabase"). S1/S2 need accounts, a grant store, and
server projections regardless of chat. **If the backend lands on Supabase (the lean), option 2
— roll-your-own — wins**: chat becomes four more tables (threads, members, messages, receipts)
+ RLS + Realtime on infrastructure already being operated, the push trigger list is owned by
construction (which is exactly what amended rule 6 requires — no SDK that could fire its own
digests), and there's no MAU cliff or per-message vendor bill ever. The honest cost is ~2–4
agent-weeks to a solid DM+threads MVP plus block/report built by hand (~a day) — real, but
this team ships app dimensions in that time, and the notification-ownership + data-ownership
wins are things the constitution now actively wants. **Stream stays the fallback** if the
backend turns out not to be Supabase (its $0-to-2k-MAU tier and 3–5-day integration are the
fast path there). Recommendation given the lean: **plan S5 as roll-your-own-on-Supabase,
confirm when the S1 platform is locked.** Category color: Strava built messaging in-house
(Dec 2023); Slopes — the privacy north star — ships no chat at all, a reminder that Messages
earns its place by serving coordination, not by being table stakes.

**Groups (Discord-vibe) — the deferred research track, sketched not specced.**
What it adds over Messages: a persistent community *place* with identity — multiple
channels/topics under one roster, roles (admin/mod), pinned content, events, join/invite
governance, and community-scale moderation. Constitution mapping so the track starts fenced
(re-read against the round-3 override — counts and leaderboards are no longer auto-refused):
*compatible* — member-created channels as topics, member-authored posts, events with
RSVP lists, members manually re-sharing sessions into a channel (rides §6's share mechanic),
and (post-override) member counts, like counts, and leaderboards *if Dylan wants them* (⚑N4);
*still refused, because these are orthogonal push/app-authored lines the override didn't
touch* — any channel that **auto-posts** members' activity (app-authored content in a
user-authored stream), **presence** ("3 online" — that's a live-tracking/notification concern,
not a count), and **engagement digests** ("your group was active"). The line moved from
"no counts" to "no app-authored content and no push"; the Groups research track inherits the
new line, not the old one. Cost shape — the load-bearing
finding: **keep the community layer out of the chat vendor entirely.** Communities, rosters,
roles, and channel lists are rows in our own database (`communities`, `community_members`
with a role column, `channels` where each channel points at a chat thread/room id); the
transport never needs to know a "server" exists — it only ever sees rooms. On Stream this
maps onto channel-types + Teams (they publish literal Discord-clone guides); on a Supabase
build it's a migration and three screens. So the deferred Groups direction does **not**
constrain today's vendor pick — the transport upgrade is the smaller half, and the product
surface (roster, roles, events, community-scale moderation tooling) is the L+ half, which
is exactly why it deferred. Revisit
trigger: after Messages has real usage — thread behavior will show whether communities are
being emulated in ad-hoc threads (the signal that Groups is worth building).

**Events defer with Groups.** `social-tab.md`'s S6 (events) lived inside groups; with Groups
deferred, events lose their container and defer too. The likely first Groups-research
deliverable is the lightweight middle: a pinned event object inside an ad-hoc Messages thread
("who's on for the river Saturday" is a thread with a date) — noted for the research track,
not pulled into MVP.

## 4. Photos — pipeline verdict, attachment model, storage cost

**Reuse verdict: the camera pipeline is reusable as a capture primitive only — session photos
need their own persistence path, which does not exist anywhere today.** What
`ring2-camera-build.md` built (verified on main): `expo-camera` capture inside `log-food.tsx`,
base64 → Claude vision, image discarded — nothing is ever written to disk; no photos table,
no media directory, no attachment field on any payload; `expo-image-manipulator` and
`expo-image-picker` are not installed (the ring2 plan's manipulator/secure-store hardening was
deferred). So the food path and the session-photo path share a dependency (`expo-camera`) and
a downscale utility once one exists — but the job is different in kind: ring2 *parses and
discards*; social photos *persist and sync*. Plan them as adjacent consumers of shared
primitives, not as one pipeline.

**Attachment model (local-first now, sync later):**
- Session payload gains `media?: MediaRef[]` (payload JSON — no migration for the refs), a
  local `media` bookkeeping table claims the **next free migration number (018+; 017 is
  burned by `recording_buffer` — several specs still say "next free is 017"; the consolidated
  ledger needs this correction)** carrying id, observationId, file path, dimensions, byte
  size, createdAt, and a future `syncState`.
- Files live under `FileSystem.documentDirectory/media/` (documentDirectory persists and is
  device-backed-up; never cacheDirectory), written at ingest as two renditions via
  `expo-image-manipulator` (new dep): **display JPEG, long edge 2048px at ~80% quality
  (~300–500 KB)** and **thumbnail ~400px (~40 KB)**. Originals are not kept — the display
  rendition is the stored artifact. Precedent check: Strava resizes client-side to exactly
  2048px long edge before anything leaves the device and serves ~600px derivatives;
  Instagram serves 1080px at ~70–80% JPEG — 2048/80 sits between them and is right for a
  map-and-photo detail screen. (Source iPhone HEICs run 2–4 MB+; the ingest downscale is
  a ~10× reduction.)
- **`expo-image-picker` (new dep) is the primary door** — most session photos are added
  after the fact from the camera roll (you photograph the river, not the app). In-session
  capture via the existing camera screen pattern is secondary.
- **Cap ~6 photos/entry with a hero.** Strava stores unlimited but *displays* max 6 on
  mobile — 6 as the actual cap is the honest indie version. Hero = first photo by default
  (Strava's "highlight" pattern; the hero is what the feed card leads with); reordering/
  hero-picking can come later. No per-photo captions at MVP — the entry's caption (§2.1)
  carries the words (also Strava's model: text lives on the activity, not the photo).
- **EXIF is a privacy hard gate, parallel to privacy zones: strip all metadata (GPS above
  all) at ingest.** A zone-filtered route thumbnail beside a photo whose EXIF says exactly
  where the front door is defeats the entire zones investment. Stripping at ingest (not at
  share time) means no code path can leak what was never stored. Add to `social-tab.md` §6
  as guardrail 9. (What the photo *shows* remains user judgment — not engineerable.)
- Feed rendering (S3): photo-forward card when media exists, route-map hero fallback —
  per the brief, both Strava-precedented. No filters/editing; no "add a photo" prompts ever
  (an entry without a photo is a valid state — same rule as the caption).
- Constitution check: photos are self-expression, not an outcome metric — rule-5 clean. The
  photo *pressure* risk (making the feed a stage) is part of the accepted override cost
  (§1.4), managed by the Share/Save deliberate act and the never-prompt rule, not by banning
  imagery.

**Local-first staging (⚑N5):** the local half (capture/pick → downscale → strip → store →
render in own logbook) has standalone pre-backend value — a visual logbook — and de-risks
the later sync. It's separable as an early pass (S0.8, §6) that touches no backend and no
social surface. Founder scope call whether it jumps the queue; recommendation: yes, it's
small (M), self-contained, and everything social later reuses it. Design the media table
for the future now at zero cost: UUID filenames, a relative-path column, and a `syncState`
column (`local_only | queued | uploaded`) — this is the attachment-queue pattern the
local-first ecosystem has converged on (PowerSync's attachments helper is the documented
reference; WatermelonDB's sync protocol assumes the same blob-sidecar shape): metadata rows
sync through the DB layer, blobs ride an upload queue to object storage.

**Storage cost (backend era) — arithmetic, 2026 prices verified.** Assumptions: 2 photos ×
4 sessions/week = ~35 photos/user/month; 440 KB stored per photo (display + thumb); each
photo viewed ~30 times (egress-heavy — the realistic worst case for a feed product).

| | 500 active users | 10,000 active users |
|---|---|---|
| New storage / month | ~7.6 GB | ~152 GB |
| Cumulative, end of year 1 | ~92 GB (~208k images) | ~1.8 TB (~4.2M images) |
| Egress / month | ~230 GB | ~4.6 TB |
| **Cloudflare R2** ($0.015/GB, $0 egress) | **~$1/mo** | **~$31/mo** |
| AWS S3 + CloudFront ($0.023/GB + $0.085/GB egress past 1 TB free) | ~$2/mo | ~$358/mo (84% egress) |
| Supabase Storage (Pro $25 incl. 100 GB + 250 GB egress) | $25/mo flat (within plan) | ~$192/mo |
| Cloudflare Images ($5/100k stored + $1/100k delivered) | ~$16–21/mo | ~$312–416/mo |

**Verdict: Cloudflare R2 + pre-generated thumbnails wins decisively at both scales** —
this workload is egress-dominated and R2's egress is free. Supabase Storage is a perfectly
fine v1 *if* the backend lands on Supabase anyway (within the Pro plan at 500 users — the
same platform-choice variable as §3), frontable with R2/CDN later. Either way, photo
storage is a rounding error at year-one scale — cost is not a reason to trim the photo
feature.

## 5. The historical friends heatmap — and the live-location fence

**The architecture rule that makes this safe: the heatmap renders only geometry already
individually granted to the viewer.** It is an *alternate rendering* of exactly the shared,
zone-filtered tracks the feed already serves — the union of your connections' shared session
geometry, restyled as heat. It therefore adds **zero new privacy exposure** by construction.
This is the structural difference from Strava's incident architecture: their global heatmap
aggregated *non-shared* data under an "anonymized aggregate" theory, and aggregation was the
leak. **Refused permanently: any anonymized-aggregate tier — geometry never granted to the
viewer never renders, at any zoom, in any blur.** No k-anonymity math is needed when the
input set is only-what-was-granted; the zones gate is inherited upstream because projections
are zone-filtered before anything leaves the server.

Consequences and mechanics:
- **Hard prerequisites:** privacy zones (zero code today — the Map track owns the entity,
  editor, and filter; Social S3's route thumbnails, S6's shared routes, and this layer all
  degrade to stats-only/absent without it) and S2's shared-track projection.
- **Rendering is the easy half, verified in code and precedent:** the right technique is
  **stacked translucent lines** — one GeoJSON FeatureCollection of all shared tracks through
  the existing ShapeSource + LineLayer pattern (`RouteMap` already does this with
  `features[]` length 1; N is the same components), styled `line-opacity` ~0.1 so
  overlapping strokes accumulate into heat visually. This is the community-standard MapLibre
  approach for route heat — the built-in `heatmap` layer type takes *points* only (usable
  only by resampling tracks to fixed-interval points; not worth it — lines read better for
  routes; if ever wanted, exposing `HeatmapLayer` in the `mapLibre.ts` adapter is one line).
  Data budget: even ~500 shared activities × 200–500 simplified points ≈ 100–250k vertices —
  one client-side GeoJSON source handles it comfortably. Strava's tile-rasterization
  pipeline (Spark over 7.7T points, CDF-normalized raster tiles) is what *global* scale
  requires; at friends scale none of it applies. No tile pipeline, no server rendering —
  revisit only if "connections" ever becomes "everyone," which is refused anyway.
- **Server-side decimation for display is fine** (RDP-simplify others' tracks in the heatmap
  projection): the never-simplify rule protects the owner's stored session trace, not a
  viewer's display copy.
- **Adopt Strava's post-2023 default in the zones design: trim ~200 m from track start and
  end by default**, zones or no zones (their hardening added exactly this after researchers
  showed endpoint clustering leaks home addresses even with zones available). Belongs to the
  Map track's zones workstream (it protects feed thumbnails and shared routes equally — not
  a heatmap-specific rule); recorded here because this plan is what forces the scheduling.
- **A per-user "appear in connections' heat" toggle** (default on): under zero-new-exposure
  it's technically redundant — every input was individually granted — but aggregate
  rendering *feels* different in kind from per-session viewing, and honoring that intuition
  costs one setting row.
- It's a **Map-tab layer** (map-tab.md §6 already names the "cohort map, descriptive,
  pull-only heatmap" as Ring 4) — Social's grants feed it; Map owns the surface, the layer
  toggle, and the styling. Pull-only: a layer the user turns on, never a notification, never
  a "your friends were here" card.

**Live location — separate feature, fenced off, sketch only (not part of any pass below):**
rides the Session-8 background-GPS work, as its own future spec. The sketch, so scope doesn't
bleed: opt-in **per session at record start** ("share a live line with…"), audience =
hand-picked mutuals only, never a default, auto-off at session end. Transport: the recording
task already runs — the marginal cost is a network POST (position batch every ~15–30 s, the
Strava Beacon / Garmin LiveTrack cadence) to an **ephemeral server channel keyed by an
unguessable token: TTL-bound, deleted at session end, never written to history, never
feeding the heatmap** (Beacon's tokenized-URL-dies-at-stop and Slopes'
deleted-after-the-day are the precedents; viewers poll — no WebSockets needed at this
cadence). Privacy zones apply live (suppress points in-zone — which also means the line
*starting* only outside the home zone). Viewer side is a Map layer. Sized XL end-to-end
(real-time transport + consent UX + battery validation); nothing in §6 depends on it.

## 6. The revised build ladder

Extends and renumbers `social-tab.md` §7 — that ladder is superseded by this one (banner on
the spec). Post-override mapping: old S0/S0.5 unchanged; old S1 → new S1 (public/private
accounts + asymmetric follow + discovery + moderation floor); old S2/S3/S4 keep their slots
with the layered-privacy + full-kudos content; old S5 (groups chat) → S5 Messages (Groups
deferred to §3's research track); old S6 (events) → deferred with Groups; old S7 → S9. New:
S0.8 photos-local, S6 shares + program-grab, S7 heatmap, S8 partner tagging.

Everything from S1 onward is backend-era (identity, grant store, projections, media store,
chat vendor, push — the §4/§5 additions put the media store/CDN and the projection endpoint
on that standing list). Each pass independently shippable; S/M/L as before.

- **S0 — Placeholder tab (S).** Unchanged (⚑2 still Dylan's).
- **S0.5 — Doc reconciliation (S, docs only).** Unchanged, plus this plan's ripple: banners
  on `social-tab.md` (done with this plan) reflecting the override; mark the brief absorbed;
  correct the "next free migration is 017" lines in the consolidated ledger and affected specs
  (017 burned; next free 018).
- **S0.8 — Photos, local-first (M). NEW; pre-backend; independent of everything below.**
  `expo-image-picker` + `expo-image-manipulator`; media table (018+, with `syncState` from
  day one); ingest = downscale + EXIF-strip + store; attach/remove on own logbook entries;
  logbook + session-detail rendering. Gate: Profile P2 (the logbook exists). ⚑N5 for queue
  position.
- **S1 — Identity + accounts + follow graph + discovery + moderation floor (L).** Accounts
  with a **handle**; **account public/private** setting; **asymmetric follow** (open for
  public accounts, approval for private); **username search + shareable profile link** (⚑N3);
  Connections on Profile **with counts** (§2.2, §2.6); **section-level public/private toggles**
  (logbook, gear, benchmarks, identity — §1.1); block / remove-follower / report (§2.7); the
  ⚑N2 notification ruling adopted and push infrastructure baselined against it. First backend
  pass — the biggest single one.
- **S2 — Share/Save + grant store + shared projection (M).** The per-session **Share/Save**
  action on the save sheet (§1.1 layer 3; ⚑N1 default); grant store resolving the three
  layers (§2.8); server-side projection honoring section settings, field subset,
  notes-exclusion, caption-inclusion, zone filtering; media upload + CDN for shared photos;
  supersede-path/current-version authority work (§2.8). Shippable as "Shared" markers on one's
  own logbook.
- **S3 — Feed (M).** Chronological feed + SharedSessionDetail; **photo-forward cards** with
  route-hero fallback; public-account content from followed accounts; route thumbnails only
  behind the zones gate, else stats-only.
- **S4 — Comments + kudos (M).** Words under entries; **full kudos with counts** (§2.2) on
  shared content; comment / like / follow notifications, **on and per-type toggleable** (§2.5),
  fired only on human actions — no digests, nothing app-authored.
- **S5 — Messages (M).** DMs (mutual-follow reachability, §1.5) + ad-hoc group threads;
  **roll-your-own on Supabase** per the §3 lean (Stream fallback if the backend isn't
  Supabase); block binding enforced in chat; push restricted to human-action triggers (§2.5);
  no message-request inbox.
- **S6 — Shares + program-grab (M).** Re-share a session/route/spot from a profile you can
  see; owner's per-entry `reshareable` bit — **default ON** (a re-share never widens the
  owner's own audience — it can only reach where the owner already allowed; prominence, not
  exposure); **grab an influencer's shared split/program → your library as a draft** (§1.3,
  the named use-case) wired to the existing `session_templates`/save-to-library flows; the
  no-app-**push** guardrail is the live edge here (host + pull, never "recommended for you").
- **S7 — Historical friends heatmap (M).** §5's layer; requires S2/S3 + privacy zones (Map
  track). Map owns the surface; Social's grants feed it. The "connections at this spot" name
  list (§2.4 safe end) rides here.
- **S8 — Partner tagging (M).** §2.3's consent architecture; after S3.
- **S9 — Deferred, unsized:** Groups / **activity groups** (Discord-vibe, §3) + events +
  **member-set segments/leaderboards inside them** (§2.4 — segments ride the group container,
  never standalone); challenges; live location (§5 fence; rides Session 8); Close-Friends-style
  per-session audience refinement; weigh-in aggregates (only if challenges land, aggregate-only).

**Sequencing note (⚑N7):** the coherent first arc is **S1–S5** — accounts + follow through
Messages delivers Dylan's pillars (public photo feed with kudos/comments; influencer follow;
DMs/threads) minus shares/program-grab and the heatmap. S6 (shares + program-grab — the
"grab their split" payoff) and S7 (heatmap — pillar 4) are the natural second arc; S8 rides
whenever. Two gates cut across arcs regardless: **privacy zones** (Map workstream) must be
scheduled before S7 and before S3 route thumbnails, and **the S1 backend-platform choice**
(§3) drives the chat build-vs-buy. Recommendation: commit arc 1, schedule zones alongside it,
hold S6–S8 for reaction to real usage — note S1 is now heavier than v1's (public accounts +
discovery + section privacy), so budget it as the large pass it is.

## 7. ⚑ Flags for Dylan

*(Updated 2026-07-11 after Dylan's second decision round — ⚑N1/N2/N3/N4/N6 now resolved, and
the constitution amended. Only three product calls remain open, all pure scope/priority.)*

**Still open:**
- **⚑N5 — Photos-local early ship.** S0.8 before the backend era (recommended — self-contained,
  standalone value as a visual logbook) or held to ride S2. Pure scope-queue call.
- **⚑N7 — MVP arc** (§6 sequencing note): S1–S5 as arc 1 (accounts→Messages), S6 (shares +
  the "grab their split" payoff) and S7 (heatmap) as arc 2. Note S1 is heavy post-override
  (public accounts + discovery + section privacy + moderation).
- **⚑N8 — Program-grab timing.** Grabbing an influencer's split (§1.3) is slotted at S6, but
  it's the headline use-case you named — a lightweight version can ride S3/S4 once public
  benchmark/template sections render. Founder priority call: is it the launch hook or a
  fast-follow?
- **Carried: ⚑2** (placeholder tab content, pre-Ring-4) — unchanged, still yours.

**Resolved with Dylan 2026-07-11 (settled inputs):**
- **⚑N1 → side-by-side Share/Save, no pre-selection** (§1.1).
- **⚑N2 → social notifications ON, per-type toggleable, human-action triggers only** (§2.5);
  written into amended rule 6.
- **⚑N3 → username/handle search + shareable profile link** is the discovery surface (§2.6).
- **⚑N4 → segments/leaderboards allowed, member-set inside member-created activity groups
  only** (§2.4); defers with Groups (S9); written into amended rule 5.
- **⚑N6 → chat = roll-your-own on Supabase** (the backend lean), Stream fallback (§3).
- **Constitution amended** (`planning/claude-md.md` rules 5 + 6 + the reject-test) recording
  the public/kudos/notifications posture — done this session at Dylan's instruction (§8).

**Resolved earlier this pass (flag only if you disagree):** the 3-layer privacy model (§1.1),
influencer program-grab on the library/draft mechanic (§1.3), which guardrails die vs. survive
the override (§1.4), DM=mutual-follow (§1.5), caption-not-notes (§2.1), full kudos with counts
(§2.2), tag consent (§2.3), moderation floor in S1 (§2.7), grant layer resolving 3 layers
(§2.8), reshareable-default-ON (§6 S6), EXIF-strip gate (§4), zero-new-exposure heatmap rule +
no anonymized-aggregate tier (§5).

## 8. Dependencies & doc ripple

- **`social-tab.md`** — banners added (this session): ⚑4 overridden → §1 here (now a full
  public/private model, not approve-gated); ⚑5 overridden → §2.2 (full kudos with counts, not
  the countless ack); §6 guardrails partly reversed → §1.4 here (no-public-tier and no-counts
  die; push/app-authored lines survive); §7 ladder superseded → §6 here. Everything not listed
  stands.
- **`map-tab.md`** — privacy zones promoted from "a prerequisite row" to a scheduled
  workstream (gates S3 thumbnails, S6 shared routes, S7 heatmap; + the 200 m endpoint trim,
  §5); heatmap layer lands as a Map-owned toggle; ledger correction: 017 burned, next free 018
  (its §10.7 said "claim ≥017" — the recording buffer did). §6's "real-time location/Beacon is
  a separate safety feature, fully deferred" line matches §5's live-location fence here.
- **`profile-settings.md`** — section-level public/private toggles (§1.1) and Connections
  **with counts** + discovery (§2.6) land in its P-track at S1; the per-field visibility
  toggles it already planned are promoted to per-section + per-field and are no longer
  private-by-default at section level; the per-entry share control (its P6) becomes the
  Share/Save action; S0.8 photos render in its logbook.
- **`training-tab.md` / Pinned Spots / `session_templates`** — program-grab reads shared
  templates (§1.3); the §2.4 name list and save-to-library payoffs read spot/route entities;
  nothing blocks. The constitution's "draft Session from the library, never pushed" line is
  the fence for program-grab.
- **Session 8 (background GPS)** — live location is a future rider on it (§5); nothing in
  this ladder depends on Session 8.
- **Backend-era standing list** (extends `social-tab.md` §4): identity/accounts **+ handles +
  public/private + discovery/search**, follow graph + moderation, grant store resolving the
  3-layer model, server projections (zone-filtering, field subsets, section settings),
  **media store + CDN**, **chat vendor**, **push pipeline owned against the ruling**.
- **Constitution — AMENDED 2026-07-11 at Dylan's instruction** ("ya amend the constitution").
  `planning/claude-md.md` now carries:
  - **Rule 5** rewritten as "No gamification *of the mirror*" — the descriptive surfaces stay
    pure (no streaks/badges/scores/points/meters, ever), and the opt-in social layer is named
    the one sanctioned place applause may live: kudos + follower counts on *deliberately-shared*
    content, member-set segments/leaderboards inside member-created activity groups. The
    boundary is stated structurally (counts only on shared content; competition member-authored
    inside a member-made group, never app-authored/global/default; no shareable body-change
    content).
  - **Rule 6** amended so the opt-in social layer may notify on human actions (message, comment,
    like, follow — toggleable), with the never-moving line restated: no digests, no "it's been
    a while," nothing app-authored to pull you back.
  - **The "line you do not cross" reject-test** on rewards carries the matching exception note.
  Root `CLAUDE.md` has no rule text (verified — only `planning/claude-md.md` does), so no
  second copy to sync. Note: the 2026-07-09 rule-5 amendment (the earlier "outcome-competition"
  wording) still isn't in `planning/claude-md.md` per S0.5 — this 2026-07-11 rewrite supersedes
  and absorbs its intent (mirror stays "showing up, not outcomes"; the social carve-out is
  explicit); S0.5 no longer needs to port the older wording separately.
