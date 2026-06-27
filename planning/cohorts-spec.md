# Cohorts — Spec (v0.1)

*Companion to `product-overview.md`. The social layer — ring 4 in build order, but architecturally important enough to spec now so the core loop is built with cohort visibility in mind.*

---

## The thesis

The core loop is a mirror for the individual. Cohorts extend that mirror into a group — friends who can see whether you're doing what you said you'd do, without the app mediating the judgment.

Every competitor's social layer is **broadcast**: shareable PR cards, streak celebrations, AI-generated highlights pushed to a feed. Ours is **accountability**: a private (or public) group where the data speaks and the humans do the interpreting. The app hosts the group's own goals and never authors, scores, or nudges on their behalf.

This is the constitutional extension: pull-not-push and no-app-defined-success, applied to the social layer. Accountability flows friend-to-friend. The app is infrastructure for the group the same way the core loop is infrastructure for the individual.

**Why this matters strategically:** Cora can copy integration surfaces and borrow "outcome-measured" language. They structurally cannot copy a social layer where friends replace the AI nudge — because their engagement model needs the *app* to be the source of motivation, not the user's friends. The moment a friend group provides the accountability, Cora's DAU engine loses its reason to exist. Cohorts are structurally incompatible with the VC playbook the same way the quiet core loop is.

---

## What a cohort is

A cohort is a group — friends, training partners, a gym community, followers of a creator, people training for the same race. A user can belong to multiple cohorts. Cohorts can be:

- **Private** — invite-only, visible only to members.  
- **Public** — discoverable, anyone can join or request to join.

Cohorts are not typed by the app into categories. A cohort is a cohort — whether it's five friends, a climbing gym's community, a creator's following, or everyone training for the same ultra. The members and their shared context define its character, not an app-imposed category system.

---

## Inside a cohort

### Navigation

Top-level entry is a cohort selector (the user picks which group they're looking at, since they may belong to several). Within a cohort:

### Feed

A general feed where members can post — questions, plans, updates, conversation. This is the cohort's shared space. Activity from members (sessions logged, benchmarks hit) can surface here, but the feed is not *only* an automated activity stream — it's a place people talk.

### Direct messages

Member-to-member messaging within the cohort context. If you notice a friend hasn't been logging, you can reach out. The app never does this — you do.

### Challenges (optional, not inherent)

A cohort doesn't need a challenge to function. But members can create time-bound challenges the group rallies behind:

- **The group defines the challenge.** "Who can hit a new bench PR this month." "Most consistent with our climbing schedule over 8 weeks." "Who loses the most weight in 3 months." The app provides the container; the members fill it.  
- **Leaderboards exist only within active challenges.** No persistent leaderboard lives on the cohort — leaderboards appear when a challenge is set and scored by whatever metric the group chose. They come and go with the challenge.  
- **The app scores the challenge mechanically** (did the logged data match the goal?) **but never judges it.** No "you're falling behind" nudges. No celebratory animations. The number is the number.

### Events

Groups can plan events — a race, a group hike, a gym meetup. Events are created within the cohort, not discovered from a marketplace. The app is not an event-discovery platform; it's a place where a group that already exists can coordinate getting together.

**Discovery (deferred but directional):** An events discovery surface may eventually exist with two filtering dimensions — **local** (geography) and **benchmark-aligned** (events that match what you're training toward). This is out of scope for the initial build but is noted here so the event data model doesn't foreclose it.

---

## Friends / follow layer

For DMs and cross-cohort visibility to work, there needs to be a friends or follow graph underneath the cohort structure. A user can follow or friend another user independent of any specific cohort. This is the connective tissue that lets you message someone, see their profile, or keep up with a friend who's in a different cohort than you.

Details deferred — the mechanic (mutual friend vs. asymmetric follow) and the UX are not specified yet.

---

## Profiles

Every user has a profile. Profiles are **fully customizable** in terms of what's visible.

**Defaults shown:**

- Training split / routine  
- Nutrition approach (not necessarily detailed macros — just what they're doing)  
- Current benchmarks (from the Reflect mechanic — user-written, in their own words)

**Optionally added or removed:**

- Any stat or data surface the user wants to share or hide. If you don't track nutrition, it's not on your profile, and nobody sees a blank card implying you should be.

**The privacy principle:** Nothing is public by default except what the user explicitly makes visible. Profiles are private by default; users opt in to what they share. This matters more as cohorts scale beyond close friend groups — a five-person group has implicit trust; a 500-person creator cohort does not.

Deep dive on profile design deferred until the core app is running and we can see what's being tracked and how it should look.

---

## The constitutional reconciliation

### Challenges and "no gamification"

The spine says no streaks, badges, scores, points, or shareable body-change content. Challenges with leaderboards are in tension with this — specifically:

**What makes it consistent:** The app never authors the challenge, defines what success means, or rewards completion with anything manufactured (no confetti, no badge, no "challenge champion" title). The group creates the challenge, defines the metric, and the leaderboard shows the data. Friends competing is a real-world social dynamic the app is hosting, not generating.

**What makes it risky:** A "who can lose the most weight" challenge with a leaderboard is, mechanically, shareable body-change content in a competitive frame. The difference from Cora's Moments is **authorship** (friends chose this, not the app) and **context** (visible within a private cohort, not broadcast publicly). That distinction is real but thin — it holds only if the app never suggests challenge types, never templates "weight loss challenge" as a starter, and never surfaces challenge results outside the cohort.

**The line:** The app provides an empty container. The group fills it. The app never suggests what to put in it. Challenge results never leak outside the cohort. No manufactured rewards attach to challenge outcomes. If these hold, challenges are consistent with the spine. If any slip, they aren't.

### "Pull, not push" in the social layer

The app never sends a notification that says "your friend logged a session" or "you're falling behind in the challenge." All social information is pull-based — you open the cohort and see it. If a friend notices you've gone quiet and messages you, that's a human choosing to reach out, not a system-generated nudge.

The pressure to add social notifications will be enormous (every social product does it). The same argument that holds for AI notifications holds here: a notification the app sends because it's been quiet too long is engagement theater, whether the content is AI-generated or friend-generated. **The medium is the nudge, regardless of the content.**

---

## Creator cohorts (directional, deferred)

The shape is visible: a fitness creator runs a public cohort the way they'd run a Discord server. Followers join, communicate, follow the creator's programming, hold each other accountable. This is organic distribution without paid acquisition and maps to the retention-not-acquisition thesis — the cohort itself is the reason people stay.

**Deferred decisions:**

- Creator economics (free vs. paid cohorts, platform cut, Patreon-like model)  
- Creator incentives to host here vs. Discord  
- Creator-specific tooling (pinned posts, announcements, programming distribution)  
- Scale-specific UX (a 500-person cohort doesn't work like a 6-person one)  
- Moderation tooling

All of this requires the system to exist and prove itself first. The initial build serves friend groups. Creator cohorts are the growth channel that sits on top once the mechanics work.

---

## Event-centered cohorts (directional)

A cohort can be centered around an event rather than a person or friend group — "everyone training for Western States 2027." Members may not know each other; the shared context is the race. This is noted as a valid cohort shape but is not prioritized for initial build.

---

## Build implications

### What the core loop must support for cohorts to work later

- **Sessions and benchmarks must be shareable objects** with privacy controls at the data level, not bolted on at the UI level. When a user logs a session, the system needs to know whether it's visible to cohort X, cohort Y, or no one.  
- **The benchmark mechanic (Reflect) is the social atom.** What you're working toward, in your own words, visible to your group. This must be solid before cohorts ship, because it's what people actually see on each other's profiles.  
- **The profile is a view over the user's own data, filtered by their privacy settings.** Not a separate data structure — a projection.

### What ships with cohorts (ring 4\)

- Cohort creation (public/private)  
- Cohort feed \+ DM  
- Member profiles with customizable visibility  
- Challenge creation \+ time-bound leaderboards  
- Event planning within cohorts  
- Friends/follow graph  
- Privacy controls

### What ships later

- Creator-specific tooling and economics  
- Event discovery (local \+ benchmark tags)  
- Moderation tooling for large cohorts  
- Detailed profile design

---

## Competitive read

|  | Cora | Strava | Discord | This product |
| :---- | :---- | :---- | :---- | :---- |
| Social unit | Broadcast (Moments) | Activity feed | Chat server | Accountability cohort |
| Who authors the challenge | The app | The app (monthly) | N/A | The group |
| Nudge source | AI \+ system | System | Members | Members only |
| Body-change content | Encouraged (Moments) | Implicit (KOM/PR) | N/A | Allowed by group, never by app |
| Creator model | N/A | Clubs (limited) | Server owner | Deferred but shaped |

The nearest analog to what's described here is actually **Discord \+ a fitness app**, unbundled. The insight is that the fitness app *is* the server — the data is native, not linked from somewhere else. Your training log lives where your group lives. That's the thing Discord can't do and Strava's clubs don't try.

---

## Open questions (for future sessions)

1. Friends/follow mechanic — mutual vs. asymmetric, and how it relates to cohort membership  
2. Feed algorithm vs. chronological — chronological is more aligned with pull-not-push, but doesn't scale to large cohorts  
3. Profile deep dive — what exactly is shown, what the cards look like, how benchmarks render socially  
4. Challenge UX — how you create one, how the leaderboard displays, what happens when it ends  
5. Notification policy — where exactly is the line for social notifications? (Current position: none. This will be tested hard.)  
6. Data model implications — does the Envelope/Session type need a visibility field now, or is that a layer on top?

