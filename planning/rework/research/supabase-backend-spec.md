# Supabase backend — architecture spec (identity, sharing, chat, media, push, sync)

v1 — 2026-07-11. Commissioned by `fable-session-prompts.md` Prompt 1. Authority lineage:
sits under `planning/rework/research/social-expansion-plan.md` (v2, the post-override
authority for the whole social layer) and the amended constitution
(`planning/claude-md.md` rules 5 + 6, 2026-07-11); consumes `social-tab.md` §4 (grant-layer
architecture, still standing), `profile-settings.md` (sections, logbook, P6),
`map-tab.md` (GPS shapes, privacy zones, the hardest line). **This spec is the concrete
architecture for the plan's "backend-era standing list"** (plan §8): identity + handles +
public/private + discovery, follow graph + moderation, grant store resolving the 3-layer
model, server projections, media store + CDN, chat, push-pipeline-owned-against-the-ruling.
Planning only — no code, no migrations, nothing provisioned beyond what already exists.

**Settled inputs honored, not reopened:** backend = Supabase (project **"avatar training"**
exists as of 2026-07-11); chat = roll-your-own on Supabase; full public/private accounts;
per-section profile privacy; per-session Share vs Save; kudos with visible counts;
asymmetric follow; influencer-follow + program-grab; notifications only on human actions.

**Verification posture:** every Supabase capability/price below was checked against
Supabase's own live pages this session (2026-07-11), not recalled — URLs inline. Code facts
verified against `main` this session: the local migration registry runs 001–009 then jumps
to 014–017 (010–013 burned; **017 = `recording_buffer`; next free local number is 018**);
`Observation` is `{id (uuid v7), kind, occurredAt, loggedAt, tz, tier, fidelity, source,
payload, notes?, supersedes?}` stored in one `observations` SQLite table with `source`/
`payload` as JSON text (`src/storage/serialize.ts`); `GeoPoint` is
`{lat, lng, tsSec, eleM?, eleSource?}`; session geometry lives *inside* `payload`
(`gpsPath` on SessionPayload, `track` on the Sky block); `routes` (016) already carries
`visibility TEXT DEFAULT 'private'`; the repo is **public** and `.gitignore` covers
`.env*.local` but **not** plain `.env` (§7 fixes this).

## 0. What this spec settles vs. what needs Dylan

Settled here (engineering defaults, decided with rationale — flag only if you disagree):
platform fit confirmed with numbers (§2); sign-in = native Apple + email code, session in
the encrypted-store pattern, no anonymous accounts (§3); the server schema (§4); the
3-layer visibility model resolved through owner-only RLS + security-definer projection
RPCs, **no** cached-visibility column (§5); chat on Broadcast-from-database private
channels (§6.1); photos as pre-generated renditions in a private bucket with long-lived
signed URLs (§6.2); push fan-out owned by construction — a pure human-action pipeline with
no schedulable path (§6.3); exact key placement for a public repo (§7); versioned-SQL
migrations via the CLI, branch databases for risky changes only (§8); upload-on-share sync
with an outbox, others' content never entering the local engines (§9).

Needs Dylan (§12): ⚑B1 when to flip the project to the paid plan (cost); ⚑B2 whether a
full "everything you log is backed up server-side" mirror is wanted after arc 1
(privacy/product posture). Carried untouched from the plan: ⚑N5, ⚑N7, ⚑N8, ⚑2.

## 1. Purpose & constitution alignment

This backend exists to host **the opt-in social layer and nothing else**. The mirror —
logging, engines, Reflect, the correlation work — stays on the phone, local-first, exactly
as built; no engine ever gains a network dependency. The amended constitution binds the
architecture directly, and §4–§6 encode each rule structurally rather than by policy:

- **Rule 5 (no gamification of the mirror):** counts exist only on deliberately-shared
  content. Structurally: a kudos row can only reference an observation that has a share
  grant; a Saved session has no server row at all (§9), so there is nothing to count.
- **Rule 6 (pull, not push; human-action notifications only):** every push originates from
  a human-authored database row; there is no code path — no cron job, no scheduled
  function, no client insert route — that can compose a notification the app authored
  (§6.3). An agent adding a digest would have to add a new function *and* a schedule, a
  visible repo diff that contradicts the constitution.
- **No app-authored content / no algorithmic feed:** the feed is one SQL function whose
  only ordering input is `occurred_at DESC` (§5.4). There is no ranking column to drift
  toward.
- **The privacy-geometry line (`map-tab.md` §6):** raw geometry never crosses accounts;
  the v1 projection has no geometry field at all until the privacy-zones workstream lands,
  so "zones before any shared geometry" is enforced by the shape of the API, not by
  discipline (§5.3).
- **`notes` stays private:** base tables carry no cross-account read policy, and the
  projection functions simply do not select `notes` unless the grant says so (§5.3). RLS
  is row-level, not field-level — this is *why* the projection layer exists.

## 2. Platform validation — Supabase, verified July 2026

Everything the social plan needs exists on the platform today, at prices that are a
rounding error at year-one scale. Verified on Supabase's own pages this session:

| Need (plan §8 standing list) | Supabase capability, current | Fit |
|---|---|---|
| Identity + accounts | Auth: native Apple/Google ID-token flows, email OTP, 50k MAU free / 100k Pro ([pricing](https://supabase.com/pricing)) | ✓ |
| Follow graph, grants, projections | Postgres + RLS (§5) | ✓ |
| Media store + CDN | Storage: private buckets, signed URLs, Smart CDN (Pro), image transforms (Pro, [$5/1k origin images after 100](https://supabase.com/docs/guides/storage/serving/image-transformations)) | ✓ |
| Chat transport | Realtime Broadcast-from-database + private-channel authorization ([recommended over postgres_changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)) | ✓ |
| Push pipeline we own | Edge Functions + Database Webhooks; official [Expo push tutorial](https://supabase.com/docs/guides/functions/examples/push-notifications) | ✓ |
| Safe schema workflow | CLI versioned migrations; [Branching 2.0](https://supabase.com/blog/branching-2-0) preview databases (Pro, ~$0.013/hr) | ✓ |

**The numbers that matter** (all from [supabase.com/pricing](https://supabase.com/pricing)
unless noted):

- **Free plan** (where "avatar training" starts): 50,000 MAU, 500 MB database, 1 GB file
  storage, 5 GB + 5 GB egress, 500k Edge Function invocations, 200 concurrent Realtime
  connections / 2M messages. **Caveat that will bite: free projects pause after ~7 days of
  low activity** ([docs](https://supabase.com/docs/guides/platform/free-project-pausing)) —
  fine while building (dev traffic keeps it warm), a real failure mode the day one outside
  tester exists. Restorable for 90 days after pausing.
- **Pro plan: $25/mo** — 100k MAU, 8 GB disk, 100 GB storage, 250 GB + 250 GB egress,
  500 Realtime connections (10,000 with spend cap off), 2M function invocations, $10
  compute credit covering the Micro instance. Spend cap **on by default** — quota
  exhaustion throttles instead of billing
  ([cost control](https://supabase.com/docs/guides/platform/cost-control)).
- Pro also unlocks the things this design touches: image transformations, Smart CDN,
  branching databases, 3 MB Realtime broadcast payloads. None are hard dependencies at
  MVP (§6.2 deliberately avoids leaning on transforms).
- New projects run **Postgres 17** ("what we currently default to on the Supabase
  platform" — [changelog](https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change)),
  so everything §5 leans on (security-invoker views, the RLS patterns) applies as
  documented on a fresh project.
- **What changed recently that matters here:** legacy `anon`/`service_role` JWT keys are
  replaced by `sb_publishable_...` / `sb_secret_...` keys (GA mid-2025); **projects created
  after Nov 1 2025 — including "avatar training" — get only the new keys**
  ([announcement](https://github.com/orgs/supabase/discussions/29260),
  [docs](https://supabase.com/docs/guides/api/api-keys)). Where the settled inputs say
  "anon key," read "publishable key"; where "service_role," read "secret key." Same roles,
  new names, individually revocable — strictly better for us (§7).

Cost picture at the plan's own §4 scale model (500 active users): Pro's flat $25/mo covers
storage and egress comfortably; the plan's R2-fronting note stays a later option, not a
launch need. **Verdict: confirmed fit, no changed capability breaks the plan.** The one
scheduling consequence is ⚑B1 (when to start paying $25/mo).

## 3. Auth & identity

### 3.1 Sign-in options (decided defaults)

- **Sign in with Apple, native flow — the primary door.** `expo-apple-authentication` →
  `supabase.auth.signInWithIdToken({provider:'apple', token})`; no web redirect, no
  Services ID — the app's bundle id (`com.dylan.healthcoachproject`, per `app.json`) goes
  in the Apple provider's "Client IDs" list
  ([Supabase's Expo-specific doc](https://supabase.com/docs/guides/auth/social-login/auth-apple?platform=react-native)).
  Apple only supplies the user's name on the *first* sign-in — capture it into the profile
  immediately or it's gone.
- **Email 6-digit code — the fallback door.** `signInWithOtp()` with the email template
  emitting `{{ .Token }}` so the user types a code instead of tapping a magic link — no
  deep-link plumbing on a native app
  ([passwordless docs](https://supabase.com/docs/guides/auth/auth-email-passwordless)).
  Ship on Supabase's built-in sender at MVP; move to custom SMTP (Resend/Postmark-class)
  for deliverability + branding before any real launch — small, deferred.
- **No Google at launch** (decided default): the app is iOS-only; Apple + an email option
  satisfies App Store Guideline 4.8 (a third-party login requires an equivalent
  privacy-preserving option — Sign in with Apple *is* that option, and email-code is ours;
  [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)). Google's
  native ID-token flow is equally documented and is roughly a day whenever an Android era
  makes it matter.
- **No passwords, ever** (decided default): two passwordless doors mean no password reset
  surface, no credential-stuffing surface.
- **No anonymous sign-ins** (decided default): the app already *is* the try-before-account
  experience — everything except social works forever with no account (§9.1). Server-side
  anonymous users would add MAU count and cleanup chores for nothing.

### 3.2 The profiles table + handle

`auth.users` is Supabase-managed; app-visible identity lives in `public.profiles`, one row
per user, created by the standard `AFTER INSERT ON auth.users` security-definer trigger:

- `id uuid PK` = the auth user id · `handle citext UNIQUE` (regex-checked
  `^[a-z0-9_]{3,20}$`, reserved-word list, null until chosen at onboarding — the stable
  address behind the shareable profile link, plan §2.6) · `display_name` · `blurb` ·
  `avatar_path` · **`is_private boolean NOT NULL DEFAULT false`** (the account-level
  toggle, layer 1) · `created_at`.
- The existing local identity fields (settings-KV `profileCard`, per
  `profile-settings.md` §4) migrate *up* into this row when the user creates an account;
  the KV copy remains the offline cache.

### 3.3 Session persistence in Expo

Follow Supabase's current documented Expo pattern — the **"LargeSecureStore"**: an AES-256
key held in `expo-secure-store`, the session ciphertext in AsyncStorage (SecureStore
values cap at 2048 bytes; the session JWT doesn't fit, so Supabase's own guide encrypts
around it —
[Expo tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)).
New deps: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
`expo-secure-store`, `aes-js`, `react-native-get-random-values`. Client init:
`autoRefreshToken: true, persistSession: true, detectSessionInUrl: false`. Keep JWT expiry
at the default (1h) — Realtime private channels re-authorize on token refresh (§6.1).

### 3.4 How accounts map onto the local-first single-user app

The account is **additive**. Signing in never migrates, moves, or gates the local data:

- The local SQLite database remains the single source of truth for the owner's own data.
  No account → the entire existing app works exactly as today, forever.
- Creating an account creates a profile + handle and unlocks the social surfaces. The only
  data that leaves the device is what §9's sync layer explicitly pushes (shared sessions,
  profile fields, media renditions of shared photos).
- One account ↔ one device at MVP (matches reality: the app is Dylan's phone). Multi-device
  is explicitly the ⚑B2 full-mirror question, not an S1 promise.
- Sign-out keeps local data intact (it's the user's, not the account's) and clears only
  the session + server-derived caches.

## 4. Server schema — the social spine

Conventions: snake_case; `uuid` PKs — client-authored rows (observations, media, messages)
keep their local **uuid v7** ids so every sync op is an idempotent upsert; timestamps
`timestamptz`; every table gets RLS enabled **in the same migration that creates it**
(guardrail 1). Sketches below are shapes, not DDL — exact SQL is build-pass work.

**Identity & graph (B1):**

- `profiles` — §3.2.
- `profile_sections` — `(profile_id, section)` PK, `section` ∈ `logbook | gear |
  benchmarks | identity`, `is_public boolean NOT NULL DEFAULT true`. **Absence of a row =
  public** ("assumed public," plan §1.1) — settings UI writes a row only when a section is
  toggled off. Layer 2.
- `follows` — `(follower_id, followee_id)` PK, `status` ∈ `pending | accepted`,
  `created_at`, `decided_at`. A trigger sets status on insert: followee public → `accepted`
  immediately; private → `pending` until the owner approves (the Instagram model, plan
  §1.2). Indexes both directions, filtered on `accepted`.
- `blocks` — `(blocker_id, blocked_id)` PK. Insert trigger severs follows both directions
  and pending tags; every visibility helper checks it first (§5.2); search excludes it.
- `reports` — `id, reporter_id, subject_profile_id, observation_id?, comment_id?,
  message_id?, reason, created_at, status`. Owner-monitored queue (dashboard + email at
  MVP — the plan's §2.7 App-Store-gate floor). Insert-only for users; readable only by the
  service role.
- `push_tokens` — `(profile_id, token)` PK, platform, device label, `updated_at`. Owner-only.
- `notification_prefs` — `(profile_id, type)` PK, `push_enabled boolean`. Governs *push
  delivery* per type (plan §2.5's per-type toggles); in-app notification rows are always
  written (they're the record of a human action).

**Sharing (B2):**

- `observations` — the server mirror of the local spine, same columns as the SQLite table
  (`id uuid PK` (client v7), `owner_id`, `kind`, `occurred_at`, `logged_at`, `tz`, `tier`,
  `fidelity`, `source jsonb`, `payload jsonb`, `notes text`, `supersedes uuid`,
  plus server-side `updated_at`). Index `(owner_id, occurred_at DESC)`. At phase 1 only
  *shared sessions* ever occupy it (§9); the shape is deliberately the full spine so the
  ⚑B2 mirror is "more rows in the same table," not a redesign. **RLS: owner-only, all
  operations. No cross-account policy will ever be added to this table** (guardrail 2).
- `share_grants` — **the grant store, keyed by observation id** (plan §2.8 honored: a
  grant *record*, not a column): `observation_id uuid PK REFERENCES observations ON DELETE
  CASCADE`, `owner_id` (denormalized, trigger-enforced equal to the observation's),
  `include_notes boolean NOT NULL DEFAULT false` (§2.1's per-entry include),
  `reshareable boolean NOT NULL DEFAULT true` (plan §6 S6), `shared_at`. One row = the
  Share act. **Un-share = DELETE** — and §9.4 deletes the observation row and media with
  it, so revocation leaves *nothing* server-side ("nothing was copied," strengthened).
  An insert trigger **rejects any observation whose `kind != 'session'`** — weigh-ins,
  food, sleep, steps, subjective stay structurally unshareable (guardrail 5; amended
  rule 5(c)).
- `media` — one row per shared photo: `id uuid PK` (client id), `observation_id FK ON
  DELETE CASCADE`, `owner_id`, `position int`, `width`, `height`, `bytes`, `created_at`.
  Files live in Storage (§6.2); this row is the pointer + ordering. Owner-only RLS;
  viewers get signed URLs through the projection, never table access. Mirrors the local
  S0.8 media table (plan §4), whose `syncState` column drives the upload (§9.3).
- `privacy_zones` — sketched for completeness, **owned by the Map track**: `id, owner_id,
  lat, lng, radius_m, created_at`. The projection function (§5.3) is its consumer, along
  with the default 200 m start/end trim (plan §5). Zero code today, and the projection
  ships without geometry until this lands.

**Reactions (B3):**

- `kudos` — `(observation_id, profile_id)` PK, `created_at`. Insert policy: self only, and
  only on entries the viewer can see (§5.2 helper). Counts render with numerals on shared
  projections (plan §2.2) — and only there.
- `comments` — `id uuid PK, observation_id FK CASCADE, author_id, body, created_at,
  deleted_at`. Same visibility gate; authors and the entry owner can delete.
- `notifications` — `id bigint identity, recipient_id, actor_id CHECK (actor_id <>
  recipient_id), type` ∈ `follow | follow_request | comment | kudos`, exactly-one-source
  polymorphic reference (CHECK per type), `created_at, read_at`. **Recipients can SELECT
  and mark read. No role has INSERT** — rows are written exclusively by security-definer
  triggers on `follows`/`comments`/`kudos`. This table *is* rule 6 in schema form (§6.3).
  (Chat pushes ride the `messages` row itself rather than minting a notification row per
  message — §6.3.)

**Chat (B4, plan §3's four-tables sketch made concrete):**

- `threads` — `id uuid, created_by, is_group boolean, title?, created_at`.
- `thread_members` — `(thread_id, profile_id)` PK, `joined_at`, **`last_read_at`** (the
  receipt — unread counts derive from it, no per-message receipt rows), `muted boolean
  DEFAULT false`.
- `messages` — `id uuid PK` (client v7 — offline-queued sends stay idempotent),
  `thread_id FK`, `sender_id`, `body`, `created_at`, `deleted_at`.
- Membership-gated RLS all the way down (§5.2); thread *creation* goes through RPCs that
  enforce the reachability rule — `create_dm(other)` requires **mutual follow** (plan
  §1.5), `create_group_thread(...)` requires the creator be mutual with each added member;
  blocks sever visibility and sending. Delivery is §6.1's broadcast.

**Program-grab (S6, sketch only):** an influencer's shared split is a
`session_templates`-shaped payload published to their profile (its own small
`shared_templates` table + the section-visibility gate); "grab" is a projection read that
the client saves into the local library as a **draft** — the constitution's blessed
library mechanic, no new copy semantics. Detail deferred to the S6 pass; nothing in B1–B4
forecloses it.

## 5. The load-bearing part — 3-layer visibility through RLS

### 5.1 The resolution algebra

A session observation `O` owned by `owner` is visible to `viewer` iff:

```
visible(viewer, O) =
      viewer = owner
   OR (  grant_exists(O)                             -- layer 3: the Share act
     AND section_public(owner, 'logbook')            -- layer 2: section toggle
     AND ( NOT owner.is_private                      -- layer 1: account type
           OR accepted_follow(viewer, owner) )
     AND NOT blocked_either_way(viewer, owner) )
```

Account-private beats everything below it; a Saved session (no grant — indeed, at phase 1,
no server row) is invisible regardless of the other layers. Each input is one indexed
lookup: grant existence is a PK probe, the section check is a PK probe on
`profile_sections` (absence = public), the follow check is a PK probe on `follows`, blocks
likewise. The plan's §2.8 requirement — flip any layer without touching a single
observation record — holds by construction.

### 5.2 Where the check runs: helpers + owner-only tables + projection RPCs

Current Supabase RLS guidance, applied ([RLS docs incl. performance section](https://supabase.com/docs/guides/database/postgres/row-level-security);
[RLS performance & best practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv),
whose published benchmarks are the numbers below):

- **Helper functions in a `private` schema**, `SECURITY DEFINER`, `STABLE`, with
  `search_path` pinned empty and every relation schema-qualified —
  `private.can_view_session(viewer uuid, obs_id uuid)`,
  `private.is_accepted_follower(viewer, owner)`, `private.blocked(a, b)`. Security definer
  lets a policy consult `follows`/`share_grants`/`profiles` without recursing through
  *their* RLS (documented benchmark: a wrapped definer helper took a 178 s query to 12 ms);
  the private schema is a hard rule, not taste — Supabase: "Security definer functions
  should never be created in a schema in the 'Exposed schemas'", or the elevated helper
  becomes directly callable through the API.
- **Every policy names its role** (`TO authenticated` — 170 ms → <0.1 ms on anon attempts)
  and wraps per-statement-constant calls as `(SELECT auth.uid())` so they evaluate once as
  an initplan instead of per row (179 ms → 9 ms on the basic wrap; the
  `auth_rls_initplan` advisor lint catches misses automatically). Every column a policy
  references gets an index (the docs' 171 ms → <0.1 ms case).
- **Policies compare a set to the row, never the row to a correlated subquery.** The
  documented trap is exactly our shape: `auth.uid() IN (SELECT ... WHERE x = row.col)`
  re-runs per row (their benchmark: 9 s → 20 ms after inversion); the fast form fetches
  "everything this viewer may see" once — `observation_id IN (SELECT ... FROM
  share_grants ...)` via the helper — and compares the row's column against it.
- **Base data tables get owner-only policies and nothing else.** `observations`, `media`,
  `share_grants`: `USING (owner_id = (SELECT auth.uid()))`. Cross-account reads never
  happen through table selects.
- **Cross-account reads happen only through projection RPCs** — `get_feed(before, limit)`,
  `get_profile(handle)`, `get_shared_session(obs_id)`, `search_profiles(q)` — SQL
  functions that apply §5.1 once, in set-based form, and return **only the projected
  field subset**.
- Tables that genuinely need per-row cross-account policies — `kudos`, `comments`, chat —
  use the helper in their policy (`private.can_view_session(...)` / membership EXISTS).
  Those queries are small (one entry's comment thread, one thread's messages, LIMIT-paged),
  so per-row helper calls are a handful of PK probes — the pattern the performance
  guidance exists to make safe.

### 5.3 Why a projection function is mandatory, not a style choice

RLS is **row**-level. A cross-account SELECT policy on `observations` — however perfect —
would expose whole rows: `notes`, raw `payload` geometry, fidelity, everything. The
plan's requirements are *field*-level (notes excluded by default, caption included,
fidelity/tier never surfaced socially — `social-tab.md` §4) and *transformation*-level
(zone-filtered, decimated geometry — plan §5). Only a projection layer can do that:

- The RPC selects the defined subset: sport + dimension, occurred_at, duration, caption,
  owner-allowed stats, kudos count, viewer-has-kudoed, media signed URLs. It does **not**
  select `notes` unless `share_grants.include_notes`; it never selects fidelity, tier, or
  capture provenance.
- **v1 returns no geometry field at all.** When the Map track ships privacy zones, the
  projection gains a `geometry` output computed as: zone-suppressed points → default
  200 m start/end trim → RDP-decimated display copy (the never-simplify rule protects the
  owner's stored trace, not a viewer's copy — plan §5). Until then, feed cards are
  stats-only — the zones gate enforced by an absent column, not a review checklist.
- The functions are `SECURITY DEFINER` (they must read across owners), which concentrates
  trust: they are the **single auditable gate** in the system. Defense in depth is the
  owner-only RLS beneath them — a bug anywhere else in the API surface cannot leak a row,
  because no other path crosses accounts. These few functions get the densest tests in
  the backend (the §11 guardrails are their acceptance criteria).

### 5.4 Decision: per-read resolution, no cached/resolved visibility column

The three candidate architectures the brief named, decided:

1. **One-policy-per-table with inline joins** — rejected as the *primary* mechanism: it
   can't do field subsetting (§5.3), and policy-embedded joins run per candidate row on
   feed-scale scans, which is exactly the pattern Supabase's performance guidance warns
   about.
2. **Security-definer helpers + projection RPCs** — **chosen** (§5.2/§5.3). The feed
   query becomes one set-based statement: accepted follows of viewer → semi-join grants →
   join observations → layer checks → `ORDER BY occurred_at DESC LIMIT n`, everything
   index-backed. Correct under churn by construction, because nothing is precomputed.
3. **A resolved/cached visibility column (or materialized authorization table)** —
   **rejected at this scale.** Three independently-mutable inputs (account flip, section
   toggle, per-session grant) would each demand trigger cascades rewriting cached state
   across every affected row — the same class of write-amplification the grant layer was
   chosen to avoid (plan §2.8: flipping your account private must not touch a single
   record). Precomputation is a >100k-user optimization; adopting it now buys nothing and
   risks stale-cache leaks, the worst failure mode a privacy system can have. (Postgres
   also can't put RLS on materialized views, so the matview variant needs its own
   definer-function wrapper anyway — community-documented, not a blessed pattern.)
   **Revisit trigger:** sustained feed p95 over ~500 ms at real usage — and the first
   move then is a per-viewer materialized feed (fan-out-on-write), not a visibility
   column.

Also rejected, deliberately: **materializing layer 1 (`is_private`) into JWT claims**
(Supabase's custom-claims/RBAC pattern). It's the documented fit for low-churn
authorization data, but claims only refresh with the token — meaning "flip my account
private" would keep serving the old answer to every holder of an unexpired JWT for up to
an hour. For a privacy control, that staleness window is a leak, not an optimization;
`profiles.is_private` stays a table lookup (one PK probe). Same reasoning bans
`user_metadata` in any policy (user-writable — Supabase's own warning).

Feed ordering is `occurred_at DESC`, full stop — there is no ranking signal anywhere in
the schema for an algorithmic feed to grow from (guardrail 9).

## 6. Realtime, Storage, Edge Functions

### 6.1 Chat transport — Broadcast from database, private channels

Supabase's current, explicit recommendation: **Broadcast, not `postgres_changes`** —
postgres_changes processes on a single thread and authorizes *per subscriber per event*
("100 subscribed users → 100 authorization checks"), with a documented steer to Broadcast
beyond ~3k subscribers
([postgres-changes docs](https://supabase.com/docs/guides/realtime/postgres-changes),
[subscribing guide](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)).
The blessed chat shape, adopted wholesale:

- `AFTER INSERT ON messages` trigger → `realtime.broadcast_changes('thread:' ||
  thread_id, ...)` ([broadcast docs](https://supabase.com/docs/guides/realtime/broadcast)).
  The DB write is the source of truth; delivery is a side effect — offline clients
  reconcile by querying `messages` (§9's read path), so a missed broadcast loses nothing.
- Clients join `thread:{id}` as a **private channel**; Realtime Authorization gates it
  with policies on `realtime.messages` — SELECT = may receive, INSERT = may send, both an
  EXISTS probe on `thread_members`
  ([authorization docs](https://supabase.com/docs/guides/realtime/authorization)).
  (Status note: authorization is labeled Public Beta on the features page while being the
  documented production path for private channels — fine for chat pings whose fallback is
  a table query; recorded so it's known, not discovered.) One documented caveat to design
  around: channel policies are evaluated **at join time and cached until the JWT
  refreshes** — someone removed from a thread (or blocked) can keep *receiving* broadcasts
  on an already-open channel until their token rolls. The table RLS cuts them off from
  history instantly; the default 1 h JWT expiry (§3.3) bounds the live-channel lag, and
  block/removal RPCs can additionally force the topic closed. Acceptable at MVP; recorded.
- **Broadcast replay** (72 h retention, 25 msgs/request,
  [limits](https://supabase.com/docs/guides/realtime/limits)) covers reconnect gaps;
  anything older comes from the table.
- Presence: **not used** at MVP — "3 online" is refused anyway (plan §3 Groups fence), and
  typing indicators are a later nicety (if ever, they ride broadcast, not presence, per
  the presence docs' own steer).
- Capacity check: 200 concurrent connections free / 500 Pro (10k with spend cap off) —
  comfortable past the plan's honest year-one scale.

### 6.2 Photos — private bucket, pre-generated renditions, long-lived signed URLs

The client already produces exactly two renditions at ingest (display 2048 px + thumb
~400 px, EXIF-stripped — plan §4, S0.8). The server design leans on that instead of on
platform image transforms:

- **Bucket `media`, private.** Path scheme `{owner_id}/{observation_id}/{media_id}/
  display.jpg|thumb.jpg`. Storage RLS on `storage.objects`: INSERT/DELETE only where the
  first path folder = the caller's id (the canonical
  [per-user-folder pattern](https://supabase.com/docs/guides/storage/security/access-control));
  no cross-account SELECT policy — viewers never hit the object API directly.
- **Delivery = signed URLs minted inside the projection RPCs** (via a thin Edge-Function
  or PostgREST wrapper holding storage privileges), expiry ~7 days, **cached client-side
  and reused**. This matters for cost and speed: Supabase's Smart CDN caches *per unique
  token* — minting a fresh URL per render means every request hits origin; reusing one
  warm URL per rendition gets CDN cache hits billed at the cheap cached-egress rate
  ([Smart CDN docs](https://supabase.com/docs/guides/storage/cdn/smart-cdn)). Un-share
  deletes the objects, which invalidates every cached copy within ~60 s — acceptable for
  revocation (the row + grant vanish instantly; edge caches drain in a minute).
- Upload from Expo: the documented RN pattern — read file → ArrayBuffer →
  `.upload(path, buf, {contentType})`; our renditions are 40–500 KB, far under the 6 MB
  standard-upload comfort line, so no resumable/TUS machinery
  ([RN storage guide](https://supabase.com/blog/react-native-storage),
  [standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)).
- **Image transforms (Pro-only, WebP,
  [$5/1k origin images past 100](https://supabase.com/docs/guides/storage/serving/image-transformations))
  are an optional optimization, not a dependency** — pre-generated renditions keep the
  design plan-agnostic and match what S0.8 builds anyway.
- **Bucket `avatars`, public** — profile pictures are the one deliberately-public image
  class; upload path gated the same way. (An avatar on a private account is the same
  Instagram-visible fact: name + photo are discoverable; everything else is gated.)
- EXIF stripping stays a **client-side ingest gate** (plan §4) — the server never receives
  metadata to leak. Belt-and-braces server-side re-strip can ride the signed-upload
  wrapper later; not load-bearing.

### 6.3 Push fan-out — owned by construction

The rule (amended rule 6, plan §2.5): every notification carries something a *person did*;
the app is structurally incapable of authoring one. The Supabase shape that makes this
true by construction rather than by policy:

1. **The only sources of push are four human-authored row types** — `follows` (new
   follower / request / acceptance), `comments`, `kudos`, `messages`. Each is
   RLS-guarded so only an authenticated human can create one, and each carries its actor.
2. `follows`/`comments`/`kudos` triggers write `notifications` rows (the in-app inbox —
   the durable record). **No client role has INSERT on `notifications`** — the API cannot
   mint one, an agent cannot "just add" one; only the three triggers write it.
3. **Delivery:** a Database Webhook on `notifications` INSERT (and one on `messages`
   INSERT for chat, which skips the inbox table) invokes an Edge Function that reads
   `push_tokens` + `notification_prefs` (+ thread `muted`), and POSTs to Expo's push API —
   exactly Supabase's own documented Expo pattern
   ([tutorial](https://supabase.com/docs/guides/functions/examples/push-notifications)).
   The Expo access token lives in Edge Function secrets (§7).
4. **What does not exist:** no cron schedule (Supabase Cron never provisioned), no
   scheduled function, no digest composer, no "re-engagement" SDK — the delivery function
   is a pure `row → push` mapper with no aggregation window. Adding an app-authored push
   would require adding a *new* function and a schedule: a loud, reviewable repo diff that
   the constitution already names as a violation. That is the structural guarantee.
5. Reliability posture, decided: webhooks ride `pg_net` (beta, at-most-once, no retry —
   [pg_net docs](https://supabase.com/docs/guides/database/extensions/pg_net)). For social
   pings that's correct-enough: the `notifications` row / unread count is the durable
   truth and renders in-app regardless; a rare dropped push is invisible. If delivery
   ever needs at-least-once, the documented upgrade is Supabase Queues (pgmq) + a worker
   function ([queues + functions](https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions))
   — same ownership properties, more moving parts; not MVP.

Per-type toggles (`notification_prefs`) gate *push delivery*; the in-app record always
exists. Every allowed type is a human action; the list is closed by the `type` CHECK.

## 7. Secrets & config — this repo is public

Exact placement, nothing left to judgment. The naming note from §2 applies throughout:
this project has only the new-style keys.

**Ships in the app (safe by design, with RLS on):**

- `EXPO_PUBLIC_SUPABASE_URL` — the project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the `sb_publishable_...` key. Supabase
  explicitly documents it as safe in "web pages, mobile or desktop app, GitHub actions,
  CLIs, source code" — all authority comes from RLS + the user's JWT, never from the key
  ([API-keys docs](https://supabase.com/docs/guides/api/api-keys)).
- Both go in **`.env.local`** (gitignored) with empty-valued lines added to the committed
  `.env.example`, read through `src/lib/config.ts` like every existing key, and set as
  **EAS environment variables** for cloud builds — the repo's established pattern.
  Committing them would be *safe* per Supabase; we still don't, so forks of a public repo
  don't inherit our project identity.

**Never in the repo, never in the client, no exceptions:**

- The **`sb_secret_...` key** — bypasses RLS entirely. Lives only in the Supabase
  dashboard; Edge Functions receive it auto-injected (`SUPABASE_SECRET_KEYS`) without us
  storing it anywhere
  ([functions secrets docs](https://supabase.com/docs/guides/functions/secrets)).
- The **database password** — password manager only. Agents connect through the CLI's
  access token, not the DB password.
- The **Supabase personal access token** (CLI/`supabase link`) — shell keychain/env, never
  a file in the repo.
- **`EXPO_ACCESS_TOKEN`** (push) and any future provider secrets — Edge Function secrets
  via `supabase secrets set`, or the dashboard.

**Repo hygiene (fix in B0):**

- `.gitignore` currently covers `.env*.local` but **not `.env`** — one careless
  `cp .env.local .env` away from a public leak. Add `.env`, `.env.*`,
  `!.env.example`, plus `supabase/.env` and `supabase/.temp/`.
- The `supabase/` directory (config.toml, migrations, functions) **is committed** — it's
  the schema's source of truth and contains no secrets.
- Standing wart, recorded not scoped: `EXPO_PUBLIC_ANTHROPIC_API_KEY` is inlined into the
  client today, and `config.ts` itself says to proxy it before public distribution — an
  Edge Function is now the natural home. Queue as a fast-follow once B0 exists; not part
  of any social pass.

## 8. Migrations & schema workflow — solo founder + AI agents

**Two ledgers, never conflated** (say it plainly because the local one has burned numbers
before): the **local SQLite ledger** (`src/storage/migrations/`, registry at 001–017,
next free **018**, claimed at build time per the consolidated-ledger rule) governs the
phone database; the **server ledger** (`supabase/migrations/*.sql`, timestamp-named,
tracked in `supabase_migrations.schema_migrations`) governs Postgres. They version
different databases and share nothing — a server migration never consumes a local number,
and vice versa.

- **Versioned SQL migrations, CLI-first**: `supabase migration new` → write SQL →
  verify → `supabase db push`
  ([docs](https://supabase.com/docs/guides/deployment/database-migrations)). **Not**
  declarative schemas: `db diff` explicitly does not capture RLS policy changes — and
  this backend is mostly RLS
  ([declarative-schemas caveats](https://supabase.com/docs/guides/local-development/declarative-database-schemas)).
- **Verification ladder, cheapest-first:** (1) local stack — `supabase start` (needs
  Docker; one-time setup) + `supabase db reset` replays every migration + `seed.sql` from
  scratch, the everyday loop; (2) a **branch database** for the risky ones — destructive
  changes, RLS rewrites, anything touching the projection functions: Branching 2.0 works
  from dashboard/CLI without GitHub, ~$0.01344/hr on Micro, Pro-plan-only, still
  feature-preview ([branching](https://supabase.com/docs/guides/deployment/branching),
  [blog](https://supabase.com/blog/branching-2-0)); (3) `db push` to "avatar training."
  Pre-Pro, the ladder is just (1) → (3) — acceptable while there are no users.
- **Types**: `supabase gen types typescript` → committed `src/lib/database.types.ts`,
  regenerated by a package script whenever a migration lands; `createClient<Database>`
  gives the app end-to-end query typing.
- **Edge Functions** deploy via CLI (`--use-api`, no Docker needed for deploys).
- **The dashboard Security + Performance Advisors are part of the definition of done**
  for every backend pass: the lint set catches exactly this design's failure modes —
  unwrapped `auth.uid()` (`auth_rls_initplan`), RLS-off tables, security-definer
  functions exposed to API roles, definer views
  ([database advisors](https://supabase.com/docs/guides/database/database-advisors)).
  Zero advisor findings is a pass-exit criterion, same rank as jest/tsc locally.
- **Agent rules of engagement** (this repo is built by agents; write them down): schema
  changes are migration files in the repo, never dashboard SQL-editor edits (drift the
  ledger can't see); the RLS test suite runs before any `db push`; if the official
  Supabase MCP server is ever connected, scope it `project_ref`-pinned and
  **`read_only=true`** against production — Supabase's own guidance warns against
  connecting agents to prod at all, citing prompt-injection risk
  ([MCP docs](https://supabase.com/docs/guides/getting-started/mcp)). Default remains
  CLI-in-repo, which leaves a reviewable trail.

## 9. Local SQLite → backend — the first sync boundary

### 9.1 Posture: the phone stays sovereign

The transition rule, stated once and binding: **local SQLite remains the single source of
truth for the owner's own data; the server holds (a) identity, (b) the social graph, and
(c) published copies of exactly what the user Shared.** Nothing else leaves the device at
phase 1. No account = the full app, forever. This is "upload-on-share," and it was chosen
over a full mirror deliberately: it keeps the S1/S2 surface small, it makes the privacy
story one sentence ("private data never leaves your phone"), and it matches the plan's
ladder (media upload rides S2 *for shared photos*). The full mirror — backup +
multi-device — is real future value and is ⚑B2, a posture change Dylan should choose
knowingly, not inherit.

### 9.2 The outbox — how writes reach the server

One new local table (bookkeeping sidecar, **claims the next free local migration number
≥018 at build time** — coordinate with S0.8's media table, which queues the same way):

- `sync_outbox`: `id, entity ('observation'|'media'|'grant'|'profile'), entity_id, op
  ('upsert'|'delete'), enqueued_at, attempts, last_error`.
- **Local write always completes first** — the log is never blocked by the network
  (local-first invariant). Share enqueues three kinds of rows: observation upsert, media
  uploads, grant upsert. A drain worker runs on app-foreground + connectivity-regain,
  oldest-first, marking the S0.8 media `syncState` `local_only → queued → uploaded` as it
  goes.
- **Idempotency is free**: every entity keeps its client uuid v7 id, so every op is an
  upsert/delete against a PK — retries and duplicate drains are harmless, and ordering
  requirements collapse to "observation before its grant" (enforced by enqueue order +
  FK).
- The save sheet's Share button therefore never spins on network: it writes locally,
  enqueues, and the logbook entry shows a quiet "sharing…" state until drained (failure
  = plain retry affordance; `profile-settings.md`'s "grant write fails loud, entry stays
  private" honored — the grant is last in the drain order, so nothing is visible remotely
  until everything under it landed).

### 9.3 The media sidecar

Exactly the plan §4 design, now with its other half: local `media` table rows (S0.8)
carry `syncState`; Share enqueues the two renditions per photo; upload = ArrayBuffer PUT
into the private bucket path (§6.2); the server `media` row is upserted after both files
land. Photos attached to a *Saved* session never upload — `syncState` stays `local_only`
for life. EXIF is already gone at ingest, so no code path can upload what was never
stored (plan §4's gate, inherited).

### 9.4 Edit, delete, un-share — current-version authority

Plan §2.8 flagged that the local edit path is destructive overwrite (supersedes is
schema-only) and demanded S2 either finish the supersede chain or make the server
projection authoritative on current-version. **Decided: the server holds exactly one row
per observation id, upserted to the latest local state — the projection is thereby always
current-version, and the supersede chain stays a local concern** (finish it later for
local history if ever wanted; the feed never depended on it).

- **Edit** a shared session → local overwrite → outbox upsert → server row replaced →
  every projection reflects it ("edits propagate").
- **Delete** → outbox delete → server row gone; FK cascades take the grant, media rows,
  kudos, comments; Storage objects deleted in the same drain step ("deletion is
  deletion").
- **Un-share** (Save-after-Share) → grant delete **and** observation + media delete —
  phase 1's stronger form of "revoke the grant → vanishes everywhere": nothing about the
  session remains server-side at all. Kudos/comments on it cascade away — honest
  consequence of un-publishing, worth one plain sentence in the un-share confirm UI.
- **Conflicts:** none by construction at phase 1 — one device owns the data;
  `updated_at` last-write-wins is a formality. Multi-device conflict design is ⚑B2's
  problem and is why ⚑B2 is a real decision, not a checkbox.

### 9.5 The read path — others' data never enters the mirror

Feed, profiles, shared sessions, comments arrive as **projection responses, rendered and
cached as views, never written into the local `observations` table.** The engines
(`core/`) run on the owner's data only — a friend's session must never become an
Observation the correlation engine could ingest (constitution: engines never see
visibility, and the mirror reflects *you*). Cache = ephemeral query cache (in-memory +
a small `feed_cache` KV for offline "showing last sync" rendering per `social-tab.md`
§3) — explicitly not engine-readable. The one sanctioned crossing is program-grab: a
projection payload saved as a local **draft template** (library mechanic, distinct type,
logged only if done — §4 sketch).

## 10. Build passes (server halves of the plan's ladder — B-numbers slot inside S-passes)

- **B0 — Project wiring (S).** `supabase/` scaffold committed (config.toml, empty
  migrations dir, seed.sql); CLI linked to "avatar training"; `.gitignore` fix (§7);
  `EXPO_PUBLIC_SUPABASE_URL`/`_PUBLISHABLE_KEY` into `.env.example` + `.env.local` + EAS
  env; `@supabase/supabase-js` + LargeSecureStore client module; type-gen script. No
  product surface; independently shippable.
- **B1 — Identity + graph + moderation backend (L; inside S1).** Auth providers (Apple
  native + email code); `profiles` trigger + handle claim flow; `profile_sections`;
  `follows` with the public/private trigger; `blocks` + `reports`; `push_tokens` +
  `notification_prefs`; `search_profiles` + `get_profile` projections; the `private.*`
  helper family + RLS test suite. The biggest single pass, matching the plan's note that
  S1 is now heavy.
- **B2 — Share pipeline (M; inside S2).** `observations` mirror + `share_grants` (+ the
  kind-check trigger) + `media`; the `media` bucket + storage policies; `get_feed` +
  `get_shared_session` projections (no geometry — §5.3); local `sync_outbox` migration
  (next-free ≥018) + drain worker; Share/Save wiring to it; un-share teardown (§9.4).
- **B3 — Reactions + push (M; inside S4).** `kudos` + `comments` + their visibility
  policies; `notifications` + triggers; webhooks + the Expo-push Edge Function +
  `EXPO_ACCESS_TOKEN` secret; per-type prefs enforcement. Rule-6 structural guarantees
  land here (§6.3) — the pass is done when the §11 notification guardrails have tests.
- **B4 — Chat (M; inside S5).** The four tables + membership RLS; `create_dm` /
  `create_group_thread` reachability RPCs; broadcast trigger + private-channel policies
  on `realtime.messages`; replay-on-reconnect; message webhook → push (muted/prefs
  honored); block enforcement in-thread.

Each pass ships its RLS policies and their tests in the same migration set as its tables
(guardrail 1). B0 anytime; B1→B4 in order, each independently shippable behind its
S-pass's UI.

## 11. Guardrails — binding on every backend pass

1. **RLS on before the first row**: a table and its policies land in the same migration;
   a migration adding a table without policies fails review.
2. **Base data tables never carry cross-account SELECT policies** (`observations`,
   `media`, `share_grants`). Cross-account reads exist only in the enumerated projection
   RPCs, which emit the defined field subset and nothing else. If any *view* is ever
   exposed to the API, it carries `WITH (security_invoker = true)` explicitly in its
   migration — that is **not** the Postgres default, and both the dashboard editor and
   the CLI's declarative tooling are documented to silently drop it.
3. **`notes` appears in no projection** unless that observation's grant has
   `include_notes = true`. Fidelity, tier, and capture provenance appear in none, ever.
4. **No geometry crosses accounts until zone filtering exists in the projection** — the
   v1 functions have no geometry output field; adding one requires the zones + trim
   pipeline in the same change.
5. **Non-session kinds are structurally unshareable**: the grant-insert trigger rejects
   them; there is no other publish path.
6. **Every push originates from a human-authored row** (follow/comment/kudos/message).
   No client INSERT on `notifications`; no cron/scheduled function that sends push; the
   delivery functions map one row → one push with no aggregation. A digest is
   architecturally a new function + schedule — refuse it on sight (amended rule 6).
7. **Secret keys never in repo or client**; publishable-key-only in the app; `.gitignore`
   covers every `.env` variant except `.env.example`; DB password lives in no file.
8. **Others' shared content never enters local `observations` or any engine input.**
   Projections render; they are not ingested. Program-grab lands as a draft template —
   the one sanctioned copy.
9. **The feed function's only ordering input is `occurred_at DESC`.** No ranking column,
   no engagement signal, no "suggested" output anywhere in the schema.
10. **Kudos counts surface only in shared projections** — no count in any owner-mirror
    query (the plan §2.2 rendering rule, held at the API layer too: own-logbook reads
    come from local SQLite, which has no counts at all).

## 12. ⚑ Flags for Dylan

- **⚑B1 — RESOLVED 2026-07-15 (Dylan): stay on the free tier through early dev; flip to
  Pro ($25/mo) only when user traction demands it.** Confirms the recommendation below in
  spirit — the trigger is traction, not a fixed TestFlight date. The ~7-day pause risk (a
  silent outage the day a real tester's phone syncs) is accepted as a known cost of
  staying free; revisit the flip the moment an outside tester is actually using synced
  features.
- **⚑B2 — The backup mirror (phase-2 sync posture). Still open as of 2026-07-15** — Dylan's
  own words: "honestly don't get it," so left open rather than guessed at. Phase 1 is
  upload-on-share: private data never leaves the phone — a strong, simple promise. The
  alternative future: mirror *everything* server-side under owner-only RLS, which buys
  real things — backup if the phone dies, multi-device someday — at the cost of that
  promise becoming "your private logbook also lives, readable only by you, on the
  server." Schema is already shaped for it (§4); this is purely a product/privacy posture
  call, not an engineering one — recommend walking through the two options concretely
  (what "backup" would actually mean day to day) at a later session, rather than deciding
  from the abstract framing now. Nothing in B1–B4 forecloses either answer.
- **Carried, still open:** ⚑2 (placeholder tab). ⚑N5/N7/N8 resolved 2026-07-15 in
  `social-expansion-plan.md` §7.

Decided-by-default in this spec, flag only if you disagree: no Google sign-in at launch;
no passwords; no anonymous accounts; webhook (at-most-once) push delivery with the pgmq
upgrade path named; pre-generated renditions over platform image transforms; signed-URL
reuse for CDN warmth; per-read visibility resolution over any cached column; un-share
deletes the server copy entirely; versioned SQL migrations over declarative schemas.

## 13. Dependencies & doc ripple

- **`social-expansion-plan.md`** — §8's backend-era standing list is now architected
  here; its §3 chat build recommendation (roll-your-own, ~4 tables) is confirmed
  buildable exactly as sketched (§4/§6.1). No contradictions found.
- **`social-tab.md` §4** — the grant-layer seam (⚑3) is implemented as specced: grant
  record keyed by observation id, engines never see visibility. Its conceptual
  `{observationId, audience, fieldOverrides?, grantedAt}` becomes
  `{observation_id, include_notes, reshareable, shared_at}` with audience *resolved*, not
  stored (plan §1.2).
- **`profile-settings.md`** — P6's share control writes through §9.2's outbox; the
  identity KV migrates up per §3.2; Settings › Account arrives with B1; "preview as" is
  a client render of `get_profile` with a chosen viewer-relationship parameter.
- **`map-tab.md`** — privacy zones remain Map-owned; §5.3 defines exactly the seam its
  zones workstream plugs into (zone filter + 200 m trim inside the projection). Nothing
  here touches recording or local GPS shapes.
- **Local migration ledger** — one future claim recorded: the sync outbox takes the next
  free number ≥018 at build time, queued alongside S0.8's media table. No number
  pre-assigned (the ledger rule).
- **`fable-session-prompts.md`** — Prompt 1 delivered by this file.
- **Constitution** — no new amendment needed: this spec implements the amended rules 5+6
  and adds no surface the reject-tests would catch.

---

**Summary.** Supabase, verified against its own July-2026 docs and pricing, fits the
social plan with no capability gaps: $0 during the build, $25/mo Pro when real users
arrive (⚑B1), everything else rounding error at year-one scale. Identity is native Apple
sign-in + email codes with sessions in Expo's encrypted-store pattern; accounts are
additive — the local-first app keeps working accountless forever, and at phase 1 the
server holds only identity, the graph, and what the user deliberately Shared
(upload-on-share; the full backup mirror is ⚑B2, deliberately deferred). The 3-layer
visibility model resolves at read time through owner-only RLS plus a small set of
security-definer projection RPCs — the only cross-account gate, which is also what
enforces notes-exclusion and the no-geometry-until-zones rule structurally; no cached
visibility column (correctness under churn beats premature optimization). Chat is the
four-table build on Broadcast-from-database private channels; photos are client-made
renditions in a private bucket behind reused signed URLs; push is a closed human-action
pipeline — no client can insert a notification, no schedule exists, so an app-authored
digest is structurally impossible, which is what amended rule 6 demanded. The repo being
public is handled by exact key placement (publishable key in the app via `.env.local` +
EAS; secret key and DB password never in any file) plus a `.gitignore` fix. One flag still
open for Dylan: ⚑B2 the backup-mirror posture (⚑B1 Pro-plan timing resolved 2026-07-15 —
stay free until traction). Build lands as B0–B4, the server halves of the plan's S1–S5.
