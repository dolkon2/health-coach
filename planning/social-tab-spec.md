# Social — Tab Spec (v0.1, design-basis draft)

*Renamed from "Groups" (2026-07-11 talk-through). Companion to `cohorts-spec.md`, which owns the deeper cohort/challenge/events model. This doc exists to give the design pass a simple top-level shape — it is not a full technical spec.*

---

## Shape

One tab: **Social**. Two top-level sections, switched at the top of the screen:

- **Feed** (default landing)
- **Groups**

---

## Feed

A public activity feed — logbook activity across the people you follow/are friends with. Strava-shaped: scroll a stream of what your friends and followers have been doing.

- Populated from sessions/logs that are visibility-scoped as shareable (see `cohorts-spec.md` § Friends / follow layer and the privacy-scoping note in `CLAUDE.md` § Forward reference).
- Descriptive only — the feed shows what happened, in the same "showing up, not outcomes" register as the rest of the app (see the 2026-07-09 constitution amendment on shareable content). No app-generated highlights, no auto-praise, no scores.
- Design open question: does the feed show raw activity only, or does it also carry member posts (text/photo updates)? `cohorts-spec.md` describes cohort-level feeds as a mixed activity + conversation space — decide whether the top-level Social feed inherits that mixed character or stays activity-only, with posting reserved for Groups.

## Groups

Messaging, WhatsApp-shaped: direct messages and group chats.

- **Direct messages** — 1:1, member to member.
- **Group chats** — many-to-many, persistent, named/organized like a cohort.
- Posting into a group (not just chatting) is in scope per the framing conversation — treat a group as able to hold both a message thread and lightweight posts, not chat-only.
- Underlying cohort concepts (challenges, events, leaderboards-within-challenges) from `cohorts-spec.md` live *inside* a group, not as separate tabs.

---

## Open questions (for design + later technical spec)

- Does a "group" in this tab map 1:1 to a "cohort" in `cohorts-spec.md`, or is a group a lighter-weight chat-only construct with cohorts as a superset?
- Feed content mix (activity-only vs. activity + posts) — see above.
- Friends/follow graph mechanic (mutual vs. asymmetric) — still deferred per `cohorts-spec.md`.
- Messaging is architecturally distinct from the rest of the app (not an Observation-shaped data problem) — build-vs-buy (in-house chat vs. a chat-as-a-service provider) is an open technical decision, out of scope for this design-basis doc.

---

## Explicitly not decided here

Everything about entry point (tap-to-profile from Groups), notifications for messages, read receipts, challenge/event UI, and MVP scope of the coordination layer remains open per `planning/screens-features-status.md` open decision #6. This doc only fixes the two-section shape (Feed / Groups) so design work has a frame to work inside.
