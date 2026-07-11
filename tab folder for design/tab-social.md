# Social Tab

Core infrastructure, not a deferred nice-to-have (2026-07-09 reframe). Renamed from **Groups** (2026-07-11). Two top-level sections: **Feed** (public logbook activity across friends/followers, Strava-shaped, descriptive only) and **Groups** (WhatsApp-shaped DMs + group chats, posting into a group in scope).

## Current shape / status

- Bottom nav position: 5th of 5. Status: **"Mockup only"** — zero code.
- The dedicated Notion "Social" page exists but is **blank** (no content beyond its summary properties) — the real detail lives in the two repo/Notion specs listed below.
- `planning/social-tab-spec.md` is referenced by Notion as the "full design-basis framing" doc but **was not found in this repo checkout**. `planning/cohorts-spec.md` (present, thorough) covers the deeper cohort/challenge/events model and is this doc's primary source.
- Profile is explicitly **not part of this tab** — it's a separate, non-tab surface (persistent top-right avatar / tap-through from any name in Social).

## Structural pieces / modules

- **Feed** — public logbook activity across friends/followers, Strava-shaped, purely descriptive (what happened, not scored).
- **Groups** — WhatsApp-shaped: DMs + group chats, posting into a group in scope. Maps onto `cohorts-spec.md`'s cohort model (a group with a Feed + DMs + optional Challenges + Events), though the exact **group↔cohort mapping is explicitly still open**.
- **Friends/follow graph** — connective tissue underneath both Feed and Groups; mechanic (mutual friend vs. asymmetric follow) not yet decided.
- **Challenges** (optional, cohort-scoped) — group-authored, time-bound; leaderboard exists only inside the active challenge, never persistent, never leaks outside the cohort.
- **Events** — planned within a cohort (a race, a group hike, a gym meetup); not a discovery marketplace at MVP. Local + benchmark-aligned discovery is directional, deferred.

## Full-screen features needing their own design pass

### Feed
Chronological (vs. algorithmic) activity stream from friends/followers — chronological is the pull-not-push-aligned default but doesn't scale to large cohorts; open question on how it degrades.

### Group / cohort view
Per-cohort Feed + DM entry point; cohort selector for users in multiple cohorts. Needs a "which cohort am I looking at" top-level pattern.

### Direct messages
Member-to-member messaging within cohort context, and possibly outside it via the friends/follow graph. Build-vs-buy for the chat layer is an open engineering decision, not just a design one.

### Challenge creation & leaderboard
Group defines the metric and duration; app scores mechanically but never judges (no "falling behind" nudges, no celebratory animation). Needs a creation flow and a leaderboard display that reads as data, not competition theater.

### Event planning
Create/RSVP flow for a cohort-internal event (race, group hike, meetup). Discovery surface (local + benchmark-aligned filtering) is explicitly deferred — do not design it yet.

### Profile (reached from Social, not itself a tab)
Customizable modules: blurb, gear quiver, splits, pinned benchmarks, element identity; field-level public/private toggles. Defaults shown: training split/routine, nutrition approach (not detailed macros), current benchmarks in the user's own words. Fully private by default — nothing public until the user opts in. Not started.

## Open decisions

- **Group ↔ cohort mapping** — how the Social tab's "Groups" concept maps onto `cohorts-spec.md`'s cohort object (1:1, or Groups is a UI view over cohorts).
- **Feed content mix** — pure activity stream vs. member-authored posts/conversation mixed in.
- **Friends/follow graph mechanic** — mutual-friend vs. asymmetric follow; how it relates to cohort membership.
- **Chat build-vs-buy** — engineering decision with design implications (feature ceiling, notification model).
- **Notification policy for social** — current position is *none* (no "your friend logged a session," no challenge-standings pings); flagged in `cohorts-spec.md` as something that "will be tested hard" against product pressure to add it.
- **Profile deep-dive** — card layout, how benchmarks render socially — explicitly deferred until the core app is running.
- **Data-model question** — does the Session/Observation type need a `visibility` field now, or is privacy scoping a layer added later? Affects how early GPS/session data must be built with sharing in mind (see `tab-map.md`'s privacy-zone gate).
- `planning/social-tab-spec.md`, cited by Notion as the primary design-basis doc, is missing from the repo.

## Out of scope

- **Global/public leaderboards, KOMs, or any cross-stranger competitive ranking** — explicitly refused (constitution rule 5, reinforced in `cohorts-spec.md`). Only cohort-internal, time-bound challenge leaderboards are allowed, and even those must never leak outside the cohort or attach a manufactured reward (badge, confetti, title).
- **Any app-authored or app-suggested challenge type** — the group must originate every challenge; the app never templates a "weight loss challenge" starter. This line is called out in `cohorts-spec.md` as "real but thin" — flagging it here as something to hold carefully in design (e.g. no default/template gallery for challenge creation).
- **Any social notification the app initiates** — "your friend logged," "you're behind in the challenge," streak reminders — all refused. A human choosing to message a friend is fine; the system nudging on the app's own initiative is not.
- Event discovery marketplace (local + benchmark-tag search) — directional only, not in this build.
- Creator cohorts, creator economics/tooling, moderation tooling for large cohorts — explicitly deferred to a later phase once the core mechanic is proven with friend groups.
- Live/real-time location tracking of friends — a separate safety feature (per `gps-mapping-spec.md`), not part of the social map/feed, and must not block or be blocked by it.

## Sources used

- Notion: "Social" page (summary properties only — page body is blank), "Pages and Features" (Social summary row).
- Repo: `planning/cohorts-spec.md` (full cohort model: feed, DMs, challenges, events, friends/follow layer, profiles, constitutional reconciliation, build implications, open questions), `CLAUDE.md` / `planning/claude-md.md` (constitution — no gamification, pull-not-push).
- Gap: `planning/social-tab-spec.md`, cited by Notion as the primary design-basis doc for this tab, not present in repo; this doc leans on `cohorts-spec.md` instead, which covers the deeper mechanics but not tab-level UI framing.
