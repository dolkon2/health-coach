# Social layer — consolidated build spec (the implementation map, S0–S9)

v1 — 2026-07-15. Commissioned as the single document a future implementation session
works from to build the social layer. **This doc consolidates; it does not re-decide.**
Every decision below is cited to the file + section that made it; where two source docs
disagree, §6 reconciles the conflict on the record instead of silently choosing.

Authority lineage (highest first):

1. `planning/claude-md.md` — the amended constitution (rules 5 + 6, 2026-07-11;
   verified present in the file this session).
2. `planning/rework/research/social-expansion-plan.md` (v2) — the post-override
   authority for the whole layer: the S0–S9 ladder (§6), the flag resolutions (§2),
   the three-layer privacy model (§1).
3. The four sibling specs it spawned, each authoritative for its slice:
   `supabase-backend-spec.md` (backend/B-passes), `privacy-zones-spec.md` (the
   geometry gate, Z-passes), `session-photos-spec.md` (photos, PH-passes),
   `activity-groups-spec.md` (the S9 bucket sized as G-passes).
4. `moderation-legal-starter.md` — the compliance gates (App Store checklist §1,
   ⚑L flags).
5. `rework/master-plan.md` — how Phase 6 slots into the whole rework; **its own
   Phase-6 ladder text is pre-override and superseded** (§6.1 below).

Where this doc and any source disagree on a **code fact**, this doc wins — every code
fact below was re-verified against the working tree **2026-07-15** (§1). Where this doc
and a source disagree on a **decision**, the source wins and the discrepancy is a bug
here; nothing below intends to reopen anything.

Planning only — no code, no migrations, nothing provisioned.

## 0. How to use this doc

An implementation session picks a pass from §3, reads the cited source sections for the
full design (this doc deliberately does not re-explain them), checks the pass's gates
against §2 and its flags against §7, builds, and closes out against the pass's
definition of done. §5 says what to pick up first. §4 is the whole layer on one page.

## 1. Repo baseline — code facts verified 2026-07-15

These correct stale claims in every source doc; trust this list over their
"verification posture" sections, which were true on 2026-07-11 and have since drifted.

- **Local migration ledger** (`src/storage/migrations/index.ts`): registry runs
  001–009 + 014–**018**; 010–013 permanently burned. **018 = `benchmark_groups`**
  (Phase 4 B4, shipped ~2026-07-13) — NOT media. The session-photos spec's hard claim
  of 018 (`session-photos-spec.md` §2.2) was displaced by benchmark_groups shipping
  first. **The consolidated ledger for this layer, binding: 019 = `media`
  (session-photos, renumbered), next free for every other claimant = 020, claimed at
  build time only.** Queued ≥020 claimants, in likely build order: `sync_outbox` (S2),
  Z1's local `privacy_zones` mirror, G4's `group_segments_cache` + `segment_matches`.
  Every "next free is 017/018 / queue ≥019" line in the source docs is superseded by
  this paragraph.
- **Platform**: Expo SDK 56 (`expo-camera ~56.0.8`), **MapLibre v11.3.6** — the
  SDK 53→56 + v10→v11 upgrade the master plan gated as map ⚑3 has landed. The
  expansion plan's §5 heatmap mechanics (stacked translucent LineLayers via the
  ShapeSource/LineLayer adapter) are unaffected; the adapter lives at
  `src/components/mapLibre.ts` (not `src/lib/`).
- **S0 is shipped**: `app/(tabs)/social.tsx` exists — the quiet one-sentence
  placeholder, implemented per ⚑2's recommended shape (see §7 close-out).
- **Profile P2 logbook is built** (`app/profile.tsx`, list + calendar over
  `useSessionHistory`; entry tap → `/log-session?editId=`) — the "Profile logbook
  before sharing" gate is **satisfied** for S0.8 and S2.
- **No backend exists**: no `supabase/` directory, no `@supabase/supabase-js` in
  `package.json` — B0 has not started. The Supabase project "avatar training" exists
  per `supabase-backend-spec.md` (created 2026-07-11) but is unlinked.
- **`.gitignore` still covers only `.env*.local`, not plain `.env`** — the backend
  spec's §7 hygiene fix is outstanding, in a public repo. B0 work item; cheap; do it
  first (§5).
- **Photos deps not installed** (`expo-image-picker`, `expo-image-manipulator` absent)
  — PH1 unbuilt; its new-dev-client-build requirement stands.
- **Constitution amendments are in place**: `planning/claude-md.md` carries the
  2026-07-11 rules 5 + 6 text verbatim. No S0.5 constitution work remains.
- **Privacy zones: zero code** (unchanged). **No caption, partner, or media field on
  any payload** (unchanged). **`supersedes` chain is schema-only; edit path is
  destructive overwrite** (unchanged — but see §6.7: the backend spec already decided
  how S2 handles this).

## 2. The hard gates — cross-pass, non-negotiable

Restated once here so every pass below can cite them by number:

- **HG1 — Privacy zones before any shared geometry.** No surface renders another
  user's geometry before the Z2 server filter is live: S3 route thumbnails, S6 shared
  routes, S7 heatmap, G4 geo segments all degrade to stats-only/absent without it.
  Enforced structurally: the v1 projection RPCs have **no geometry output column at
  all**; adding one requires the zones + 200 m trim pipeline in the same change
  (`supabase-backend-spec.md` §5.3 guardrail 4; `privacy-zones-spec.md` §6.1).
- **HG2 — Moderation floor + App Store checklist before the first public social
  binary.** Apple Guideline 1.2 is a launch gate, not ethics garnish. The floor is the
  plan's §2.7 (block / remove-follower / report) **plus** the moderation-legal §1B
  gap items — filtering, published contact info, ToS "I Agree" gate, 24-hour
  remove/eject tooling, in-app account deletion, neutral age gate, copy truth-sweep
  (B3–B7, B9, B11). All land inside S1 (§3, and §6.3 for the scope reconciliation).
  Two §1A items bind even earlier, on **any** public build: the privacy-policy link
  (A1) and the third-party-AI disclosure for food photos (A3).
- **HG3 — Profile logbook before sharing.** Satisfied (§1) — recorded here because
  the source ladders carry it as a live gate; no pass below waits on it anymore.
- **HG4 — The constitutional invariants**, enforced in schema, binding on every pass:
  counts only on deliberately-Shared content; no app-authored content, ranking signal,
  or push; notifications from human-authored rows only; `notes` excluded by default;
  non-session kinds structurally unshareable; others' content never enters the local
  engines. The test-backed forms are `supabase-backend-spec.md` §11 (guardrails 1–10),
  `privacy-zones-spec.md` §9, `session-photos-spec.md` §9, `activity-groups-spec.md`
  §8 — each pass's definition of done includes its guardrail set having tests.

## 3. The ladder — pass by pass

Sub-pass vocabulary, so the source docs' numbering stays navigable: **B0–B6** are the
server halves (`supabase-backend-spec.md` §10, extended B5/B6 by
`activity-groups-spec.md` §7), **Z1–Z3** the privacy-zones track
(`privacy-zones-spec.md` §8), **PH1–PH4** the photos slices (`session-photos-spec.md`
§7), **G1–G4** the groups track. They slot *inside* S-passes as noted; they are not
extra rungs.

---

### S0 — Placeholder tab (S) — ✅ SHIPPED

Verified in code (§1). Nothing to do. ⚑2 close-out in §7.

---

### S0.5 — Doc reconciliation remainder (S, docs only)

- **Scope:** the still-open ripple: (a) this doc now *is* the consolidated migration
  ledger for the layer — add pointer banners where source docs carry stale numbers
  (`session-photos-spec.md` §2.2/§11, `supabase-backend-spec.md` §8/§9.2,
  `privacy-zones-spec.md` §3.2, `activity-groups-spec.md` §4.5, `master-plan.md` §6);
  (b) `social-tab.md` §6 gains **guardrail 9 = EXIF-strip at ingest** (pending since
  the photos plan — `session-photos-spec.md` §11); (c) `master-plan.md` §4 item 34 +
  §6 chat/visibility/audience rows get a superseded-by banner pointing at
  `social-expansion-plan.md` §6 and this doc (§6.1 below).
- **Sources:** `social-expansion-plan.md` §6 S0.5; ripple lists in every sibling §11–13.
- **Tables / migrations:** none.
- **Dependencies / gates:** none. **Size:** S.
- **Done when:** no doc in `planning/` claims a migration number without either being
  right or pointing here; the three banners are in place.

---

### S0.8 — Photos, local-first (M) — = PH1, + PH2 (S) follow-on

- **Scope:** the full `session-photos-spec.md` build: `MediaRef` on `SessionPayload`;
  **local migration 019 = `media`** (§1 — renumbered from the spec's stale 018);
  `src/lib/media/` prepare/commit ingest, delete cascade, janitor; picker attach on
  the log-session detail step; logbook thumb strip; detail gallery + pager. PH2 (S,
  any time after): in-session capture door, hero-pick/reorder.
- **Sources:** `session-photos-spec.md` (whole; §7 PH1/PH2), `social-expansion-plan.md`
  §4.
- **Supabase tables:** none — pre-backend by design; every row `local_only`.
- **Dependencies / gates:** Profile P2 (satisfied, §1). New native deps → **new
  dev-client build**, installed from the main worktree session only. Independent of
  everything else in the ladder; PH3/PH4 (backend halves) ride S2/S3 later.
- **Flags:** ⚑N5 (queue position — recommended: build it now), ⚑P1 (mid-recording
  capture — recommended: defer).
- **Size:** M (+S for PH2).
- **Done when:** the PH1 verify bar in `session-photos-spec.md` §7 passes verbatim —
  headline items: the **EXIF fixture test** (GPS-tagged JPEG in, provably clean
  renditions out) is in the suite; delete-session cascades files + rows; a photo-less
  entry renders exactly as today.

---

### S1 — Identity + accounts + follow graph + discovery + moderation floor (L) — = B0 + B1 + the §1B gap items

The biggest single pass, deliberately budgeted as such (`social-expansion-plan.md` §6
sequencing note). Three layers inside it:

**B0 — project wiring (S, do first, separable):** `supabase/` scaffold committed; CLI
linked to "avatar training"; **the `.gitignore` fix** (§1 — add `.env`, `.env.*`,
`!.env.example`, `supabase/.env`, `supabase/.temp/`); publishable key into
`.env.example` + `.env.local` + EAS env; `@supabase/supabase-js` + the LargeSecureStore
client module; type-gen script. Before linking: **verify the project's region against
⚑L4** (Frankfurt recommended; the choice is effectively one-way and the project already
exists — if it was created in the wrong region, recreate it now while it's empty).
Source: `supabase-backend-spec.md` §7/§10 B0.

**B1 — the social spine:** auth (native Apple + email 6-digit code; no Google, no
passwords, no anonymous — decided defaults, backend §3); `profiles` (+ handle claim
flow) · `profile_sections` · `follows` (public→accepted / private→pending trigger) ·
`blocks` · `reports` · `push_tokens` · `notification_prefs`; public `avatars` bucket;
`search_profiles` + `get_profile` projection RPCs; the `private.*` helper family + the
RLS test suite. Product surface: account public/private toggle, section-level
visibility toggles (logbook/gear/benchmarks/identity, default public), Connections on
Profile **with counts**, username search + shareable profile link, block /
remove-follower / report UI. Sources: `social-expansion-plan.md` §1.1, §2.5–2.7;
`supabase-backend-spec.md` §3–§5, §10 B1.

**The §1B additions (HG2 — the scope grew, priced here, see §6.3):** word-list text
filter on user-entered text (handle/display name/bio now; caption at S2, comments at
S4, chat at S5) + auto-hide-on-report (B3); support email + public contact URL, in
Settings and App Store Connect (B4); explicit ToS "I Agree" gate at signup with
zero-tolerance language (B5); admin remove-content/suspend-account runbook, tested,
executable from a phone within 24 h, with immediate push/email alerting on every
report (B6, ⚑L1); **in-app account deletion** — whole-account cascade teardown (B7);
neutral birth-date age gate + verify then-current age-assurance law status (B9); copy
truth-sweep — the Settings "Private. Nothing you log is shared…" copy changes, and the
promised **one-button JSON export ships by S1** (B11, also the GDPR export answer).
Legal artifacts that must exist before this binary submits: privacy policy (+ in-app
link), community guidelines, ToS, the hand-written **Washington MHMDA standalone
page** (⚑L5), signed Supabase DPA, the HealthKit/health-data consent screen
(moderation-legal §3.6). Source: `moderation-legal-starter.md` §1B, §2–4.

- **Supabase tables:** `profiles`, `profile_sections`, `follows`, `blocks`, `reports`,
  `push_tokens`, `notification_prefs` (+ `avatars` bucket). All RLS-in-same-migration
  (backend guardrail 1).
- **Local migrations:** none.
- **Dependencies / gates:** B0 inside it. **This pass IS HG2** — nothing public with
  social live ships before all of it. Flags that bite here: ⚑L1 (accept the 24 h
  pager), ⚑L3 (ask a lawyer the entity question before this ships), ⚑L4 (region — at
  B0), ⚑L5 (write the page), ⚑L2 (the liability-stack lawyer spend).
- **Size:** L — honestly larger than the plan's original S1 even before the §1B items;
  treat B0 as a separable S-sized head.
- **Done when:** both sign-in doors work on device; handle claim + search + profile
  render; follow semantics correct for public and private accounts (approval flow);
  block severs everything both ways and report alerts immediately; section toggles
  resolve in `get_profile`; **RLS test suite green and zero Supabase advisor findings**
  (backend §8 — pass-exit criterion, same rank as jest/tsc); every §1B row in the
  table above demonstrably done, runbook drill included; account deletion verified to
  leave nothing server-side.

---

### S2 — Share/Save + grant store + shared projection (M) — = B2 + Z2 + PH3

- **Scope:** the per-session **Share / Save** choice on the save sheet — side by side,
  neither pre-selected (⚑N1 resolved); the grant store; the projection layer; the
  upload-on-share sync boundary; photos' server half; **the zones filter turning the
  geometry column on** (or shipping geometry-less if Z2 slips — HG1's honest fallback).
  Server projection is current-version authority (supersede chain stays local — §6.7).
  Un-share = full server teardown (grant + observation + media + objects). Z3 (S)
  rides here/S3: "Share without map" toggle, "View as others see it" self-projection
  preview, zone delete/move confirmation copy, the ⚑Z1 first-share door if approved.
- **Sources:** `social-expansion-plan.md` §1.1 layer 3, §2.8; `supabase-backend-spec.md`
  §4 B2, §5, §9, §10 B2; `privacy-zones-spec.md` §5–§6, §8 Z2/Z3;
  `session-photos-spec.md` §4.2/§6 (PH3).
- **Supabase tables:** `observations` (server mirror — owner-only RLS, **no
  cross-account policy ever**), `share_grants` (kind-check trigger: sessions only),
  `media` (server) + private `media` bucket + signed-URL delivery, `privacy_zones`
  (server, Z2). RPCs: `get_feed`, `get_shared_session` (field-subset projections;
  geometry only through the Z2 filter). Server migrations timestamp-named — no local
  number consumed.
- **Local migrations:** `sync_outbox` — **claims the next free number ≥020 at build
  time** (§1). Z1's local zones mirror likewise ≥020 if it hasn't already claimed.
- **Dependencies / gates:** S1. **Z2 is scheduled with this pass** (HG1); S3 route
  thumbnails do not ship until Z2 is live. PH3 is B2's client media slice, not a
  separate rung. Flag ⚑Z2 (shared stats = visible-line, the Relive posture) bites
  here — the projection's stats computation implements whichever way it lands.
- **Size:** M (B2) + M (Z2) + Z3 S — budget them together; they land together.
- **Done when:** Share writes locally first and never spins on network; drain order
  observation → media → grant holds (nothing visible remotely until everything under
  it landed); un-share leaves nothing server-side; edits propagate; the zones §9
  guardrails have tests **at the density the backend spec assigns its §11 invariants**
  (this is the hardest line in the app); backend guardrails 2–5, 8, 10 have tests;
  own-logbook "Shared" markers render.

---

### S3 — Feed (M) — + PH4

- **Scope:** chronological feed + SharedSessionDetail; photo-forward cards (hero photo,
  fixed ratio) with route-map-thumbnail fallback **only behind the zones gate**, else
  stats-only; content from followed accounts per the resolved three-layer visibility;
  signed-URL consumption + client cache (PH4); ephemeral `feed_cache` KV for offline
  "showing last sync" — short-lived, never engine-readable, never persisting others'
  geometry long-term (`privacy-zones-spec.md` §7 rider).
- **Sources:** `social-expansion-plan.md` §6 S3; `supabase-backend-spec.md` §5.4, §9.5;
  `session-photos-spec.md` §5/PH4.
- **Supabase tables:** none new (reads the S2 projections).
- **Local migrations:** none (KV, not a table).
- **Dependencies / gates:** S2; Z2 for any thumbnail (HG1). ⚑N8's lightweight
  program-grab could ride here/S4 if Dylan pulls it forward.
- **Size:** M.
- **Done when:** the feed's only ordering input is `occurred_at DESC` (backend
  guardrail 9 — no ranking column exists to drift toward); others' content never
  enters local `observations` or any engine input (guardrail 8 test); thumbnails
  absent-not-broken pre-Z2; photo cards render from cached signed URLs offline.

---

### S4 — Comments + kudos (M) — = B3

- **Scope:** comments under shared entries; **full kudos with visible counts** on
  shared content (⚑5 override, on the record); the notifications pipeline —
  `notifications` rows written only by triggers, Database Webhook → Edge Function →
  Expo push, per-type toggles, human-action triggers only; text filter extends to
  comments (HG2 rider).
- **Sources:** `social-expansion-plan.md` §2.2, §2.5, §6 S4; `supabase-backend-spec.md`
  §4 B3, §6.3, §10 B3.
- **Supabase tables:** `kudos`, `comments`, `notifications` (+ `EXPO_ACCESS_TOKEN`
  Edge secret; `notification_prefs` enforcement).
- **Local migrations:** none.
- **Dependencies / gates:** S3.
- **Size:** M.
- **Done when:** the rule-6 structural guarantees have tests (backend §11 guardrail 6:
  no client role can INSERT a notification; no cron/scheduled function exists; the
  delivery function maps one row → one push, no aggregation); counts render **only** in
  shared projections, never on the owner-mirror view (guardrail 10); per-type toggles
  gate push while in-app rows persist.

---

### S5 — Messages (M) — = B4

- **Scope:** DMs (mutual-follow reachability) + ad-hoc group threads, **roll-your-own
  on Supabase** (⚑N6 resolved; Stream fallback moot — the backend is Supabase);
  Broadcast-from-database private channels; replay-on-reconnect; unread via
  `last_read_at`; block enforced in-thread; push via the message webhook honoring
  `muted` + prefs; no message-request inbox; text filter extends to chat.
- **Sources:** `social-expansion-plan.md` §1.5, §3; `supabase-backend-spec.md` §4 B4,
  §6.1, §10 B4.
- **Supabase tables:** `threads`, `thread_members`, `messages`; policies on
  `realtime.messages`; RPCs `create_dm` (mutual follow), `create_group_thread`
  (creator mutual with each member).
- **Local migrations:** none.
- **Dependencies / gates:** S1 (graph + blocks); B-series lands in order after B3
  (backend §10). **End of arc 1** (⚑N7).
- **Size:** M (the honest 2–4-agent-week estimate lives in plan §3 — most of it is
  offline/retry edge cases; budget accordingly).
- **Done when:** reachability rules enforced in the RPCs (not the client); a missed
  broadcast loses nothing (table reconciliation verified); the join-time
  channel-authorization caveat (removed member keeps receiving until JWT refresh,
  ≤1 h) is recorded and the block/removal RPCs force-close topics; block severs
  visibility and sending.

---

### S6 — Shares + program-grab (M)

- **Scope:** re-share a visible session/route/spot (owner's `reshareable` bit, default
  ON — a re-share never widens the owner's audience); **grab an influencer's shared
  split/program → local library as a draft** — the named use-case, wired to existing
  `session_templates`/save-to-library flows; the one sanctioned projection→local
  crossing (a draft template, logged only if done). The live edge: host + pull, never
  push — no "recommended splits," no "trending," no "creators to follow."
- **Sources:** `social-expansion-plan.md` §1.3, §6 S6; `supabase-backend-spec.md` §4
  (program-grab sketch), §9.5.
- **Supabase tables:** `shared_templates` (+ the section-visibility gate). Shared-route
  geometry passes the Z2 filter against the **route owner's** zones (HG1).
- **Local migrations:** none (drafts land in the existing library storage).
- **Dependencies / gates:** S2/S3; Z2 for shared routes. ⚑N8 (timing) is this pass's
  flag. ToS license carve-out for grabbed copies (moderation-legal §4.4) should exist
  by the time this ships.
- **Size:** M.
- **Done when:** a grabbed program is a draft (no timestamp, browsable, logged only
  when done); nothing anywhere recommends, ranks, or pushes shareable content;
  re-share reaches only where the owner's own grant already reached.

---

### S7 — Historical friends heatmap (M)

- **Scope:** a Map-tab layer (Map owns surface, toggle, styling; Social's grants feed
  it) rendering **only geometry already individually granted to the viewer**, restyled
  as heat — stacked translucent LineLayers, one FeatureCollection, client-side; no tile
  pipeline. **Refused permanently: any anonymized-aggregate tier.** The "connections at
  this spot" unordered name list (no times, no ranking) rides here. Per-user "appear in
  connections' heat" toggle (default on).
- **Sources:** `social-expansion-plan.md` §5, §2.4 (the witness list);
  `privacy-zones-spec.md` §6.2.
- **Supabase tables:** none new (a heatmap projection read over existing grants +
  zone filter; one settings row for the toggle).
- **Local migrations:** none.
- **Dependencies / gates:** S2 + S3 + **Z2 (HG1 — hard)**. MapLibre v11 note: §1 —
  mechanics unchanged.
- **Size:** M.
- **Done when:** zero-new-exposure holds by construction (only granted, zone-filtered
  projection geometry ever enters the layer — test that the heat source is the same
  filtered endpoint the feed uses); pull-only (a layer toggle, never a notification or
  card).

---

### S8 — Partner tagging (M)

- **Scope:** consent-first tagging: a tag renders nowhere socially until accepted;
  the invite carries a scoped single-entry preview grant; untag any time,
  retroactively, no tombstone; accepted tags render on the owner's entry only; blocks
  sever both directions. Additive payload partner field + a consent record
  server-side.
- **Sources:** `social-expansion-plan.md` §2.3.
- **Supabase tables:** a tag/consent table — deliberately **not** pre-schema'd by the
  backend spec; schema it in-pass following the B-series conventions (client v7 ids,
  RLS-in-same-migration, the preview grant as a scoped read the projection honors).
- **Local migrations:** none expected (payload field is JSON-additive).
- **Dependencies / gates:** S3.
- **Size:** M.
- **Done when:** a pending tag is visible only to tagger + taggee (test at the
  projection layer); the preview grant widens nothing else; untag removes every
  render; block severs existing and future tags.

---

### S9 — Activity groups + events + segments — = G1 (L) → G2 (M) → G3 (M) → G4 (L)

The former "deferred, unsized" bucket, now fully specced and sized by
`activity-groups-spec.md` — that file is the authority for everything in this row;
this entry is only its slot in the ladder.

- **Scope per pass:** **G1** — container + roster (creator/admin/member, no moderator
  tier) + invite links with pre-join preview + auto-created #general on B4 threads +
  the membership-sync trigger + block-collapse rendering + `reports` extension (L).
  **G2** — multi-channel CRUD + pin bar + per-channel mute (M). **G3** — events +
  RSVP name lists + `event_update`/`new_event` notification types (M; route
  attachment deferred post-S6). **G4** — segments + leaderboards: geo segments
  (member-authored geometry, zone-checked + trimmed at publish) + manual boards
  (no body-mass unit, by construction) + the **on-device matcher** (track never leaves
  the phone; `segment_entries` has no geometry column to receive one) +
  `get_leaderboard` best-per-member over all-time/this-year (L).
- **Sources:** `activity-groups-spec.md` (whole); `social-expansion-plan.md` §2.4, §3.
- **Supabase tables:** B5 (G1–G3): `activity_groups`, `group_members`,
  `group_invites`, `group_channels`, `group_pins`, `group_events`, `event_rsvps`.
  B6 (G4): `group_segments`, `segment_entries` + the `get_leaderboard` RPC.
- **Local migrations:** G4's `group_segments_cache` + `segment_matches` — next free
  ≥020 at build time.
- **Dependencies / gates:** **G1 needs S1 + S5** (identity/blocks + chat transport);
  nothing in the G-track needs S2–S4. **G4 needs only G1**; its geo half sits behind
  the zones gate (HG1) — the honest de-scope if zones lag is builder/library geometry
  only, or manual boards first (G4a). Flags: ⚑G1 (discoverability), ⚑G2 (track
  timing / segments jumping G2–G3), ⚑G3 (member counts).
- **Size:** L + M + M + L.
- **Done when:** the `activity-groups-spec.md` §8 guardrails have tests — headline
  items: the group is born empty; no auto-posting ever; a leaderboard entry exists
  only by deliberate post (a Saved session is never scored); rank renders only inside
  the group; membership grants group content only (no policy consults `group_members`
  to widen session visibility); the transport never learns groups exist.

---

### The Z-track (Map-owned, scheduled by this ladder)

- **Z1 — zone entity + editor, local (M).** Buildable **now**, pre-backend,
  parallel-safe with everything: local `privacy_zones` mirror (claims ≥020 at build
  time), cloak generation at creation, Settings → Privacy → "Private places" list +
  map editor. No user-visible effect until sharing exists — it ships the vocabulary
  and the data.
- **Z2 — the server filter (M).** Lands **inside/alongside S2** (HG1): server table +
  sync, the §5 suppression mask (in-zone anywhere + 200 m trims, drop-points-only,
  split-never-bridge, decimate-after-mask), stats-from-visible (⚑Z2), the geometry
  column turning on.
- **Z3 — share-surface integration (S).** Rides S2/S3: "Share without map," the
  self-projection preview, delete/move confirmation copy, the ⚑Z1 door if approved.
- **Source:** `privacy-zones-spec.md` (whole; §8).

## 4. Dependency graph & critical path

```
PRE-BACKEND — all parallel, each independently shippable, no ordering among them
  S0   placeholder tab ..................... ✅ shipped
  S0.5 doc-reconciliation remainder (S)
  S0.8 photos local (M, migration 019) ──→ PH2 capture/hero (S)
  Z1   zones entity + editor (M, ≥020)
  LEGAL PREP: ⚑L1–⚑L5 rulings; policy/ToS/MHMDA drafts; lawyer ask (⚑L2/⚑L3)

BACKEND SPINE — strict order; each pass gates the next
  B0 project wiring (S)  ← .gitignore fix; verify region (⚑L4) BEFORE linking
   └─ S1 identity + graph + moderation floor + §1B items (L)   ══ HG2: the App Store gate
       └─ S2 Share/Save + grants + projection (M) ══ Z2 filter (M) + Z3 (S) + PH3
           └─ S3 feed (M) + PH4          ← thumbnails require Z2 (HG1)
               └─ S4 comments + kudos (M)
                   └─ S5 messages (M)    ←── end of arc 1 (⚑N7)

ARC 2 — after arc 1; order among the three is free
  S6 shares + program-grab (M) ← needs S2/S3; Z2 for shared routes; ⚑N8 may pull a lite grab to S3/S4
  S7 friends heatmap (M) ....... ← needs S2/S3 + Z2 (HG1, hard)
  S8 partner tagging (M) ....... ← needs S3

G-TRACK — after S5 (⚑G2 for when); independent of S2–S4
  G1 container (L) ─→ G2 channels+pins (M) ─→ G3 events (M)
        └────────────→ G4 segments (L; geo half behind Z2; manual boards ungated)
```

**Critical path:** B0 → S1 → S2(+Z2) → S3 → S4 → S5. S1 is the longest pole —
everything backend queues behind it, which is exactly why the pre-backend passes
(S0.8, Z1, legal prep) should run before/alongside it rather than after.

**The two cross-cutting schedules:** zones (Z1 anytime → Z2 pinned to S2) and legal
(⚑L rulings before S1's build finishes; artifacts before its submission).

## 5. What the first implementation session should pick up

In order, with reasoning:

1. **B0 + the `.gitignore` fix (S).** The `.env` gap is a live hazard in a public repo
   today (§1) and B0 is the head of the entire backend spine — an afternoon of wiring
   with no product surface, independently shippable. One pre-step: confirm the
   "avatar training" project's region against ⚑L4 (one-way choice; the project is
   still empty, so recreating it in Frankfurt is free *now* and never again).
2. **S0.8 / PH1 photos (M, migration 019)** — assuming ⚑N5's recommended "yes." Fully
   specced, gate satisfied, pre-backend, standalone value (a visual logbook), and
   everything social later reuses it. Requires the dev-client rebuild, so coordinate
   the dep install with the main worktree session.
3. **Z1 zones editor (M)** — parallel-safe, pre-backend, and it front-loads the
   hardest gate's groundwork so Z2 is a filter-and-sync job at S2 rather than a
   from-scratch scramble.
4. **S0.5 remainder (S, docs)** — can ride any of the above as a closing chore.

**Do not start S1's build** until Dylan has walked the §7 roster — S1 is where most
open flags bite (⚑L1–L5), and it's the pass whose scope the flags actually change.
Everything above this line is flag-independent (⚑N5's "yes" is the only assumption,
and it's the recommended default).

## 6. Contradictions between source docs — reconciled, on the record

1. **`master-plan.md` Phase 6 (§4 item 34) and §6 tooling rows are pre-override.**
   Its ladder ("S1 accounts + *mutual invite-link friends*… S5 *groups + chat
   (build-vs-buy)* … S6 events"), its chat row ("lean **buy**, Stream/Sendbird-class"),
   and its §8 social flags (⚑3/⚑4/⚑5/⚑6, #10/25–28) all predate the round-3 override
   and the second decision round. **Superseded by `social-expansion-plan.md` §6 + §7**
   (public/private accounts; S5 = Messages, roll-your-own on Supabase; groups/events →
   the G-track; ⚑4/⚑5 overridden, ⚑3/⚑6 resolved). Banner lands via S0.5 remainder.
   The master plan stays authoritative for how Phase 6 slots after Phases 0–5 — just
   not for the ladder's contents.
2. **The migration ledger.** `session-photos-spec.md` §2.2 hard-claims **018**; the
   repo's 018 is `benchmark_groups` (shipped first). Reconciled per §1: **media = 019,
   everything else ≥020 at build time.** Worth naming: the photos spec's hard-claim
   itself bent the "claim at build time only" rule, and the displacement is the rule
   proving its point. This doc honors 019 as the head-of-queue claim (matching
   `profile-settings.md`'s 2026-07-13 correction, "next free remains 019") and
   restates claim-at-build-time for every later claimant.
3. **S1's scope: plan §2.7 vs moderation-legal §1B.** Not a contradiction of decisions
   but a scope completion that changes the pass's price: the plan's floor
   (block/remove-follower/report) covers 2 of Apple's 4 UGC bullets; the legal doc's
   verdict adds B3–B7, B9, B11 to S1 (filter, contact info, ToS gate, 24 h tooling,
   account deletion, age gate, copy sweep + JSON export). **Consolidated S1 = the
   union** (§3). S1 was already flagged as heavy; it is heavier — budget it as
   L-with-a-tail, or split the §1B items into an S1b rider that must land before
   submission.
4. **Stale platform facts** (every 2026-07-11 doc): SDK 53 / MapLibre 10.4.2 /
   `expo-camera ~16.1.11` / adapter at `src/lib/mapLibre.ts` → now SDK 56 /
   **MapLibre v11.3.6** / `expo-camera ~56.0.8` / `src/components/mapLibre.ts` (§1).
   No architecture decision is affected; master-plan map ⚑3 (upgrade sequencing) is
   resolved by events.
5. **⚑2 (placeholder tab content) is overtaken by events**: the expansion plan carries
   it as open, but S0 shipped the quiet one-sentence panel, implemented explicitly
   "per ⚑2" (code comment, verified). Roster below recommends closing it.
6. **`social-tab.md` §6 guardrail 9 (EXIF)** — promised by the plan's ripple, still
   absent from the file. S0.5 remainder item, not a decision conflict.
7. **The supersede-chain question is decided, not open.** Plan §2.8 required S2 to
   "either finish the supersede path or make the server projection authoritative";
   `supabase-backend-spec.md` §9.4 decided: **server holds one row per observation,
   upserted to latest local state; the supersede chain stays a local concern.** S2
   implements that decision — no open item remains, only work.
8. **Chat vendor:** any remaining "Stream is the recommendation" reading of plan §3
   is resolved by ⚑N6 + the backend spec's settled input: the backend **is** Supabase,
   so chat is roll-your-own; Stream survives only as the fallback if the platform
   changed, which it hasn't.

No other conflicts were found: the backend spec, zones spec, photos spec, and groups
spec compose cleanly (each was written against the others and says so), and their
guardrail sets are disjoint-by-surface rather than overlapping.

## 7. ⚑ Open founder flags — the complete deduplicated roster

Every still-open flag across all seven source docs, each with its origin, where it
bites, and a recommended default. Resolved flags (⚑N1–N4, ⚑N6, ⚑A, ⚑D, ⚑E, ⚑3–⚑6,
constitution amendment) are **not** listed — see `social-expansion-plan.md` §7 for
that record.

**Scope / queue (bite: pre-backend and arc planning):**

- **⚑N5** — photos-local early ship (plan §7; photos spec §10). Build PH1 pre-backend
  or hold to S2. *Recommended: yes, build now* — self-contained, gate satisfied,
  everything later reuses it. (§5 assumes this default.)
- **⚑N7** — the MVP arc cut (plan §6/§7). *Recommended: commit arc 1 = S1–S5 with
  zones scheduled alongside (Z1 now, Z2 at S2); hold S6–S8 for reaction to real usage.*
- **⚑N8** — program-grab timing (plan §7). Launch hook (a lite read-only grab riding
  S3/S4 once public template sections render) vs fast-follow at S6. *Recommended:
  fast-follow at S6* — the lite version still needs the template projection, which is
  most of the cost.
- **⚑P1** — mid-recording capture button on the Map live panel (photos spec §10).
  *Recommended: defer* — the after-the-fact picker covers it; PH2's capture door gets
  most of the way.
- **⚑G2** — when the G-track starts, and whether G4 segments jump G2/G3
  (groups spec §9). *Recommended: after arc 1, with "communities being emulated in
  ad-hoc threads" as the go-signal; if segments are the pull, G4 after G1 is
  legitimate.* Interacts with ⚑N7.

**Product posture (bite: at the named pass):**

- **⚑Z1** — the first-share interstitial (zones spec §11; bites at Z3/S2).
  *Recommended: yes* — fires on the user's own action, the one moment the protection
  matters; but it's an interposed screen, so it's Dylan's call.
- **⚑Z2** — shared stats: visible-line totals vs exact totals (zones spec §11; bites
  at Z2/S2). *Recommended: visible-line (the Relive posture)* — the only defense the
  CCS 2022 distance-subtraction attack couldn't break; feed numbers run slightly
  small; the caption can always carry the real number.
- **⚑G1** — group discoverability at MVP (groups spec §9; bites at G1).
  *Recommended: invite-link-only* — quiet, zero stranger-moderation surface,
  influencer groups still work via the link in a bio.
- **⚑G3** — member counts on group surfaces (groups spec §9; bites at G1).
  *Recommended: show them* — permitted post-override; the invite preview needs the
  count for informed joining anyway.
- **⚑B2** — the full backup mirror (backend spec §12; bites after arc 1).
  *Recommended: decide after arc 1 ships, not now* — nothing in B1–B4 forecloses
  either answer.

**Cost / timing:**

- **⚑B1** — when to flip Supabase to Pro ($25/mo) (backend spec §12; bites at first
  external tester). *Recommended: Free through B0–B2 development; flip the day the
  first TestFlight invite with social features goes out* (free projects pause after
  ~7 idle days — a silent outage once a real phone syncs).

**Legal / compliance (all from `moderation-legal-starter.md` §5; all bite at S1):**

- **⚑L1** — accept the 24-hour report-response commitment. *Recommended: accept*;
  wire push/email alerting on every report into S1 and write the phone-executable
  runbook (it's also Apple's de-facto bar — the alternative is not shipping social).
- **⚑L2** — what gets a real lawyer pre-launch. *Recommended: exactly two spends —
  the assumption-of-risk/liability stack (dangerous-sports app hosting others'
  programs and conditions data) and entity formation; everything else ships on
  generator + the starter doc, reviewed at traction.*
- **⚑L3** — entity + jurisdiction. *Recommended: at minimum, ask a lawyer the LLC
  question before S1 ships* — publishing a dangerous-sports social app as a
  personally-liable individual is a real posture.
- **⚑L4** — EU posture + Supabase region. *Recommended: ship globally with the
  cheap-basics GDPR stack (Art. 27 rep consciously deferred) + Frankfurt region.*
  **Bites at B0, not S1** — the region choice is effectively one-way and the project
  is still empty; verify before linking (§5.1).
- **⚑L5** — the Washington MHMDA standalone health-data page. *Recommended: do it* —
  hand-write the one page (Strava's as template) and link it beside the privacy policy
  at S1; the one privacy law with no revenue floor and a private right of action.
- **⚑L6** — Google Play category (Android era only). *Recommended: Health & Fitness*;
  decide with eyes open when Android is real.

**Close-out (needs an ack, not a decision):**

- **⚑2** — placeholder tab content (carried since `social-tab.md`). Overtaken: S0
  shipped the quiet one-sentence panel per the flag's own recommended shape (§1).
  *Recommended: close it* — reopen only if Dylan wants different interim content.

**Count: 17 open flags + 1 close-out.** Only five bite before arc 1's build starts
(⚑N5 for §5's queue, ⚑L1–⚑L4 for S1's scope and B0's region); everything else can
land at its pass.

---

## Summary

The social layer is fully designed across seven documents; this spec is the one map an
implementer follows. The ladder: **S0 (shipped) → S0.5 doc remainder → S0.8 photos
(local, migration 019) → S1 identity + moderation floor + the App Store gate (L, the
critical-path pole, = B0+B1+§1B) → S2 Share/Save + grants + projections with the Z2
privacy-zones filter landing inside it (M+M) → S3 feed (M) → S4 comments + kudos (M) →
S5 messages (M) — end of arc 1 — then S6 program-grab, S7 heatmap, S8 tagging (arc 2),
and the G1–G4 activity-groups track after S5.** Three hard gates cut across everything:
zones before any shared geometry (enforced by the projection having no geometry column
until Z2), the moderation floor + Apple 1.2 checklist before the first public social
binary (S1 is that gate, and it grew — §6.3), and the Profile logbook before sharing
(already satisfied). Repo verification corrected the ledger (018 = benchmark_groups;
**media = 019; next free = 020**) and the platform facts (SDK 56, MapLibre v11), and
confirmed B0 hasn't started — including the still-open `.gitignore` `.env` gap, which
is why §5 says: fix that and wire B0 first, then photos (PH1) and the zones editor
(Z1), both pre-backend and flag-independent, while Dylan walks the 17-flag roster —
of which only ⚑N5, ⚑L1–⚑L4 bite before arc 1's build begins.
