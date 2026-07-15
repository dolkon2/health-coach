# Fable session prompts — Social layer + backend

*2026-07-11. Hand-off prompts for building out the entire Social layer + first backend as
planning specs, so a later implementation session can build with no further design work. Run
each as its own Fable session (recommended, in order — backend first, capstone last), or hand
Fable the **master prompt** at the bottom to do all six in one autonomous run. Launch Fable
with this repo as its working directory.*

## Standing facts these prompts assume

- **Backend is provisioned:** a Supabase project named **`avatar training`** exists as of
  2026-07-11. The Supabase spec wires into it — it does not re-decide whether to use Supabase.
- **Secrets discipline (this repo is PUBLIC):** the project URL + anon/publishable key are
  safe in the app (`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`), provided RLS
  is on. The `service_role` key and the database password must **never** be committed to the
  repo or shipped in the app — server-side only (Supabase dashboard + Edge Function secrets).
- **Authority docs** (Fable reads these, does not relitigate): `social-expansion-plan.md` is
  THE current authority (post-override); `social-tab.md` is partly superseded (follow its
  banners); `planning/claude-md.md` rules 5 & 6 were amended 2026-07-11 and bind everything.
- **Settled inputs — do NOT reopen:** Supabase backend; roll-your-own chat on Supabase; full
  public/private accounts; per-section profile privacy; per-session Share vs Save; kudos WITH
  visible counts; asymmetric follow; influencer-follow + program-grab; member-set segments
  only inside member-created activity groups; notifications only on human actions.
- **Verify code facts against the actual repo** — docs have carried stale migration numbers.
  Next free local migration = 018 (016 reserved for routes, 017 = recording_buffer).

---

## Prompt 1 — Supabase backend architecture

```
You are doing a planning + research pass for the Health Coach app (repo you're in now:
Expo SDK 53 / React Native, local-first SQLite, first backend now being stood up). This is a
PLANNING pass — NO code. Deliverable is a new spec at
planning/rework/research/supabase-backend-spec.md.

A Supabase project named "avatar training" already exists — you are wiring the design into it,
not deciding whether to use Supabase.

READ FIRST, in order (the authority — build on them, do not relitigate):
- planning/rework/research/social-expansion-plan.md — THE current authority for the whole
  social layer (v2, post-override). Read in full.
- planning/rework/tabs/social-tab.md — older consolidated spec, PARTLY superseded; follow its
  top banner for what's overridden.
- planning/claude-md.md — the constitution. Read amended rules 5 & 6 (dated 2026-07-11); they
  bind this whole layer.
- planning/rework/tabs/profile-settings.md and map-tab.md for the logbook, profile sections,
  and GPS data shapes.

SETTLED INPUTS — do NOT reopen: backend = Supabase (project "avatar training" exists); chat =
roll-your-own on Supabase; full public/private accounts; per-section profile privacy; per-
session Share vs Save; kudos WITH visible counts; asymmetric follow; influencer-follow +
program-grab; notifications only on human actions, never app-authored.

YOUR JOB — spec the Supabase backend:
1. Validate Supabase against CURRENT (2026) capabilities & pricing (verify on Supabase's own
   docs/pricing pages via web search — don't trust training data). Confirm the fit with a
   concrete architecture, or flag concretely if something changed that breaks it. Cite URLs.
2. Auth & identity: sign-in options for an Expo/iOS consumer app; the profiles-table +
   handle/username pattern; Expo session persistence (secure-store); how accounts map onto the
   app's current local-first single-user data.
3. Schema: server-side tables for accounts/profiles, the follow graph, the sharing GRANT store
   (keyed by observation id — a grant RECORD, not a column; honor plan §2.8), profile-section
   visibility settings, and how a shared session projection is assembled server-side (field
   subset, notes-excluded-by-default, caption-included, zone-filtered geometry).
4. The load-bearing part: how the 3-layer visibility model (account public/private × per-
   section × per-session Share) resolves through Postgres Row Level Security. Research current
   RLS best-practice + performance guidance (policies that join a follows/grants table run
   per-row) — decide one-policy-per-table vs security-definer function vs a resolved/cached
   column, and say why.
5. Realtime for chat (postgres_changes vs broadcast — current recommendation + limits);
   Storage for photos (current image-transform capability + signed-URL/private-bucket
   patterns); Edge Functions for push fan-out — the notification rule must be OWNED by us so
   the app is structurally incapable of firing an app-authored digest; show how Supabase makes
   that true by construction.
6. SECRETS & CONFIG: this repo is PUBLIC. Spec exactly which credentials go where — anon key +
   URL as EXPO_PUBLIC_* in the app (safe with RLS on); service_role key + DB password server-
   side only (Edge Function secrets / dashboard), never committed, never in the client. Note
   the .env / app.json handling and what must stay gitignored.
7. Migrations/schema workflow for a solo founder + AI agents (Supabase CLI, preview/branch
   databases for safe migration testing).
8. Local SQLite → backend sync: the observations spine, the media sidecar, the offline→sync
   boundary. This is the app's FIRST backend — cover the local-first-single-user → accounts+
   sync transition at a design level.

VERIFY code facts against the actual repo (don't trust doc claims): the local migration ledger
state and the Observation/GeoPoint shapes.

Match the sibling-doc voice in planning/rework/: ⚑ flags for genuine founder decisions, S/M/L
sizing on proposed passes, explicit data-touchpoints + guardrails + constitution-alignment
sections. Decide engineering defaults yourself and explain them plainly (the founder is non-
technical — don't ask him to arbitrate schema patterns); escalate only real product/cost/scope
calls as ⚑. End with a brief summary of the file + key flags.
```

---

## Prompt 2 — Privacy zones spec

```
Planning pass for the Health Coach app (repo you're in: Expo SDK 53 / RN, local-first SQLite).
NO code. Deliverable: planning/rework/research/privacy-zones-spec.md.

Privacy zones — hiding the start/end (and any sensitive mid-route passage) of a GPS track near
a user's home or other private locations — are referenced as a HARD GATE everywhere but have
ZERO code and no spec. Write it. Nothing shared (route thumbnails, shared routes, the friends
heatmap) may ship before this exists.

READ FIRST (build on, don't contradict):
- planning/rework/tabs/map-tab.md §6 "Privacy — the hardest line in the app".
- planning/rework/research/social-expansion-plan.md §5 (friends heatmap) — it fixes: the
  "zero-new-exposure" rule (only geometry the viewer was individually granted ever renders — no
  anonymized-aggregate tier, ever); a default ~200m trim off track start/end (Strava's post-
  2023 hardening precedent, cited there); display-copy simplification is fine but the owner's
  raw stored trace is never touched. Be consistent with these and extend them.
- planning/claude-md.md for constitution grounding.

VERIFY against the actual repo: GPS tracks store as GeoPoint[] JSON inside an Observation
payload (core/src/observation.ts — gpsPath / track), not a separate points table; the migration
ledger (016 reserved for routes, next free = 018 — confirm yourself); rendering is MapLibre
GeoJSON via ShapeSource+LineLayer in src/components/RouteMap.tsx.

RESEARCH (web, cite URLs) Strava's privacy zones in detail (placement UX, default & max radius,
multiple zones, per-activity override, how "Hidden Details" differs); Garmin's equivalent; and
specifically what happens when a track starts INSIDE a zone vs merely passes through one mid-
route (a loop past your own house), whether zones apply retroactively to already-shared past
activities, and the UX for moving a zone after tracks were already filtered.

Write the spec: (1) zone entity + storage (propose a table; note 018 is the next free local
number if a local mirror is needed, but the real filter is server-side); (2) UX — map radius
picker, default radius, max zones, Settings vs Map home; (3) the filtering ALGORITHM — trim-to-
boundary vs cut-to-radius-plus-buffer, and the mid-route case (any in-zone geometry suppressed
wherever it appears, not only endpoints), composed with the 200m default; (4) where it plugs in
— a SERVER-SIDE filter applied before geometry leaves the server for anyone but the owner (a
client-side hide is not privacy); it gates Social's shared projection, route thumbnails, shared
routes, and the heatmap; (5) retroactivity when a zone is added/moved; (6) S/M/L sizing and
where it slots vs Social's S2/S3/S7 and Map's ladder.

Match sibling-doc voice (⚑ flags, S/M/L, data-touchpoints + guardrails). Decide engineering
defaults plainly; ⚑ only genuine product calls for the non-technical founder. End with a brief
summary + key flags.
```

---

## Prompt 3 — Session photos implementation spec

```
Planning pass for the Health Coach app (repo you're in). NO code. Deliverable:
planning/rework/research/session-photos-spec.md.

Turn the already-researched photo model into a concrete, buildable implementation spec —
Strava-style photos on logged training sessions, first-class in the social feed.

READ FIRST:
- planning/rework/research/social-expansion-plan.md §4 (photos) — research is done and settled:
  photos need their OWN persistence path (the food-camera pipeline parses-and-discards —
  nothing persists today); on-device pipeline = downscale to ~2048px/80% JPEG + ~400px
  thumbnail via expo-image-manipulator; EXIF strip at ingest is a privacy hard gate;
  expo-image-picker (camera roll) primary + in-session capture secondary; ~6 photos/entry with
  a hero; local-first now (documentDirectory/media + media table with syncState) → object
  storage later; Cloudflare R2 vs Supabase Storage costs worked out there. Build ON this.
- planning/ring2-camera-build.md (the existing camera work).
- planning/rework/tabs/profile-settings.md (the logbook, where photos render) and
  planning/rework/research/supabase-backend-spec.md IF it exists (storage target; else assume
  Supabase Storage and note the dependency).
- planning/claude-md.md (photos = self-expression, rule-5 clean; never an "add a photo" nudge —
  an entry without a photo is valid).

VERIFY against the repo: which expo-* deps are actually installed (image-picker and
image-manipulator are NOT — confirm); the Observation payload shape and that no media field
exists today; the next-free migration number (018 — confirm).

Write the spec: (1) attachment data model — media sidecar table (claim migration 018, state it
explicitly) + payload MediaRef, UUID filenames + relative paths + syncState from day one; (2)
on-device pipeline — pick/capture → downscale (2 renditions) → EXIF-strip → documentDirectory/
media; (3) local-first-now vs sync-later — the upload queue to Supabase Storage, private/
friends-only signed-URL model, eviction under storage pressure; (4) rendering — photo-forward
feed card with route-map-hero fallback, hero pick, logbook + session-detail gallery; (5)
composition with Share/Save + grants (a Saved/private session's photo never leaves the device;
a Shared one uploads); (6) S/M/L passes including the standalone pre-backend "photos-local" pass
(plan calls it S0.8) and where the sync half slots vs Social S2/S3.

Match sibling-doc voice (⚑ flags, S/M/L, data-touchpoints + guardrails). Decide engineering
defaults plainly; ⚑ only real product/cost calls. End with a brief summary + key flags.
```

---

## Prompt 4 — Activity groups spec (Discord-vibe + segments)

```
Planning pass for the Health Coach app (repo you're in). NO code. Deliverable:
planning/rework/research/activity-groups-spec.md.

Turn "activity groups" — a Discord-vibe persistent community, and the one place member-set
segments/leaderboards are allowed — from a sketch into a real, buildable spec. Deferred from the
MVP arc, but the founder wants it fully specced now.

READ FIRST (settled — do NOT relitigate):
- planning/rework/research/social-expansion-plan.md IN FULL — especially §1 (full public/private
  model + Share/Save), §2.2 (kudos WITH counts), §2.4 (segments RESOLVED: member-set, ONLY
  inside member-created activity groups — never global/app-authored/default), §3 (the Groups
  sketch — keep the community layer OUT of the chat vendor; communities/rosters/roles/channels
  are DB rows pointing at chat rooms; chat = roll-your-own on Supabase), §6 (the S9 bucket
  you're turning into real passes).
- planning/claude-md.md — the CURRENT amended rule 5 (2026-07-11). QUOTE its exact boundary
  language in your constitution-alignment section (member-set segments inside member-created
  groups is explicitly sanctioned; app-authored/global/default competition is forbidden). Also
  amended rule 6 for notifications.
- planning/rework/research/supabase-backend-spec.md IF it exists (backend/RLS target); else
  assume Supabase Postgres + Realtime and note the dependency.

Write the spec: (1) what an activity group IS — persistent community, roster, light roles
(creator/admin; decide if moderator is needed at MVP), channels/topics (decide first-pass vs
deferred; flag if genuinely open), pinned content, events, member-set segments; (2) the data
model on Supabase — groups, memberships+roles, channels, events (reuse the RSVP name-list
pattern), segments, leaderboard entries; sketch RLS-shaped member-only access and be explicit
that group membership is a SEPARATE scope from the follow graph (joining grants group content
only); (3) SEGMENTS IN DETAIL — define concretely what a segment is (tied to a Route/Spot
entity, or freeform member-defined), how a member sets one, how a leaderboard entry is created
(auto on a logged session crossing it, or manual), what's ranked (time/distance/self-reported)
and over what window; confirm it's the SAME mechanic as a Strava KOM, made clean ONLY by the
member-created-group scoping; (4) constitution mapping (compatible vs refused) using the exact
amended rule-5/6 language; note "member counts as status" is now fine per the counts override —
a small reversal from social-tab.md's old ban, flag it; (5) build ladder — turn the unsized S9
bucket into real S/M/L passes (container+roster, channels/chat, events, segments+leaderboards as
its own pass), sequenced with dependencies on the base Social ladder + Supabase.

Match sibling-doc voice (⚑ flags, S/M/L, data-touchpoints + guardrails + constitution-alignment
up top). Decide engineering defaults; ⚑ real product calls only. End with a brief summary + key
flags.
```

---

## Prompt 5 — Moderation + legal starter

```
Planning pass for the Health Coach app (repo you're in). NO code, NO legal advice. Deliverable:
planning/rework/research/moderation-legal-starter.md.

FRAMING: you are NOT a lawyer and this is NOT legal advice — state that at the top and again in a
closing note. Produce a solid, genuinely useful STARTING DRAFT plus a checklist of what needs
real legal review before launch. Be specific to THIS app, not generic boilerplate, but flag
every place a lawyer's judgment is required as a marked TODO rather than inventing legal text.

READ FIRST:
- planning/claude-md.md (constitution; handles GPS/training/photo data, NOT medical records).
- planning/rework/research/social-expansion-plan.md §2.7 (moderation floor: block, remove-
  follower, report; flags Apple Guideline 1.2 as a launch gate) and §1 (the public/private
  shape).
- planning/rework/tabs/social-tab.md (feed/comments/groups/DMs shape).

RESEARCH (web, current 2026, cite URLs): (1) Apple App Store Guideline 1.2 (UGC) exact current
requirements — content filtering, report mechanism, block mechanism, published contact; plus how
public accounts + DMs affect age rating, and any 2026 policy changes. (2) Google Play's
equivalent, briefly. (3) App Store requirements for a fitness app handling location + photos —
location-usage disclosures, and whether Apple's current privacy-manifest / nutrition-label rules
apply. (4) GDPR/CCPA realistic MINIMUM for a solo indie app a global App Store listing makes
reachable to EU/CA users (privacy-policy content, data export — app already plans JSON export —
right-to-deletion) vs. overkill pre-revenue. (5) A well-regarded privacy-policy/ToS generator or
template to point the founder at (don't substitute for one).

Write the doc: (1) App Store COMPLIANCE CHECKLIST — the concrete list that must exist before
submitting a build with social live, mapped onto Social's planned S1 moderation-floor pass
(confirm S1 satisfies it, flag gaps). (2) First-draft CONTENT POLICY / community guidelines —
real plain-language draft text (harassment, hate, spam, impersonation, sharing others' private
info; how report/block works for the user; an honest small-team report-response time — pick a
realistic number). (3) First-draft PRIVACY POLICY OUTLINE — real section headers + a paragraph
of draft content each (data collected: sessions, GPS, photos, account; usage; third parties —
name Supabase as processor; user rights: export, deletion) with a clear TODO that a real policy
needs a lawyer/generator before real users, especially EU/CA. (4) First-draft TERMS OF SERVICE
OUTLINE — lighter (account terms, UGC ownership: user owns content + grants a display license
per sharing settings, acceptable use, termination). (5) Flags for the founder — only genuine
calls (report-response commitment, legal review pre-launch vs post-traction, jurisdiction).

Thorough and time-saving, but never dress invented legal language as settled. End with a brief
summary + key flags.
```

---

## Prompt 6 — Capstone: the implementation-ready build spec

```
Planning pass for the Health Coach app (repo you're in). NO code. Deliverable:
planning/rework/research/social-build-spec.md — the single document a future implementation
session works from to build the social layer.

The layer is fully designed across several docs; CONSOLIDATE them into one sequenced,
implementation-ready plan — do not re-decide anything.

READ FIRST (the inputs you're consolidating):
- planning/rework/research/social-expansion-plan.md (the authority — S0–S9 ladder + flag
  resolutions)
- planning/rework/research/supabase-backend-spec.md (backend/schema)
- planning/rework/research/privacy-zones-spec.md (the hard gate)
- planning/rework/research/session-photos-spec.md (photos)
- planning/rework/research/activity-groups-spec.md (deferred groups + segments)
- planning/rework/research/moderation-legal-starter.md (compliance gates)
- planning/claude-md.md (amended constitution) and planning/rework/master-plan.md (how the
  layer's Phase 6 slots into the whole rework)
(If any research doc is missing, note it and consolidate what exists.)

Produce a consolidated build spec that, for EACH pass in the S0–S9 ladder, states: concrete
scope, source spec(s) it draws from, the specific Supabase tables it touches, dependencies and
hard gates (privacy zones before any shared geometry; moderation floor + App Store checklist
before the first public build; Profile logbook before sharing), S/M/L size, and a crisp
"definition of done." Include: one dependency graph / critical path for the whole layer; the
complete deduplicated roster of still-open ⚑ founder flags gathered from every source doc (each
with a recommended default); and an explicit "what a first implementation session should pick up
first" section. Reconcile any contradictions between source docs and call them out rather than
silently choosing.

Match sibling-doc voice (⚑ flags, S/M/L, dependencies, guardrails). This doc is the map an
implementer follows — favor precision and sequencing over re-explaining decisions (cite them by
file + section). End with a brief summary + the full open-flag roster.
```

---

## Master prompt — all six in one autonomous run

```
You are doing a large, autonomous planning + research pass for the Health Coach app's SOCIAL
LAYER and its first BACKEND (repo you're in: Expo SDK 53 / RN, local-first SQLite; a Supabase
project named "avatar training" now exists). Planning only — NO product code. Output is SIX
markdown specs under planning/rework/research/. The founder wants the entire social layer
specced now so a later session can implement it with no further design work.

Orient first by reading in full: planning/rework/research/social-expansion-plan.md (THE
authority — post-override social plan, S0–S9 ladder, every flag resolution),
planning/rework/tabs/social-tab.md (older, partly superseded — follow its banners),
planning/claude-md.md (amended rules 5 & 6, dated 2026-07-11 — they bind everything), and
planning/rework/tabs/{map-tab,profile-settings}.md + planning/rework/master-plan.md for context.

SETTLED INPUTS — do NOT reopen: backend = Supabase (project "avatar training" exists); chat =
roll-your-own on Supabase; full public/private accounts; per-section profile privacy; per-
session Share vs Save; kudos WITH visible counts; asymmetric follow; influencer-follow +
program-grab; member-set segments ONLY inside member-created activity groups; notifications only
on human actions. Verify all code facts (migration numbers, record shapes, installed deps)
against the ACTUAL repo — docs carry stale numbers; next free local migration = 018 (016
reserved for routes, 017 = recording_buffer). This repo is PUBLIC: never write the Supabase
service_role key or DB password into any file; anon key + URL as EXPO_PUBLIC_* only.

Produce these six files, in order (each may depend on earlier ones). For each, match the voice
of existing planning/rework/ docs: ⚑ flags for genuine founder decisions, S/M/L sizing, and
explicit constitution-alignment + data-touchpoints + guardrails sections. Decide clear
ENGINEERING defaults yourself and explain plainly (the founder is non-technical — never ask him
to arbitrate a schema or library pattern); escalate ONLY real product/cost/scope/legal calls as
⚑. Verify current (2026) external facts via web search where needed and cite URLs.

1. supabase-backend-spec.md — validate Supabase (2026 capabilities & pricing) and confirm or
   flag; spec auth/handles, the schema (accounts, follow graph, observation-keyed sharing GRANT
   store — a record not a column — profile-section visibility, server-side shared projection),
   the 3-layer visibility model resolved through RLS with a performance-sound design, Realtime
   for chat, Storage for photos, Edge Functions owning push so the app CANNOT fire an app-
   authored notification, SECRETS handling (public repo: anon key EXPO_PUBLIC_* in-app;
   service_role + DB password server-side only, never committed), the CLI migration workflow,
   and the local-SQLite→backend sync boundary (first backend).
2. privacy-zones-spec.md — the home/sensitive-location GPS trimming HARD GATE (zero code today).
   Research Strava/Garmin precedent (placement UX, default/max radius, starts-inside vs passes-
   through-midroute, retroactivity). Spec the zone entity + storage, map radius-picker UX, the
   exact SERVER-SIDE filtering algorithm (composed with the plan's ~200m endpoint trim + the
   zero-new-exposure rule, §5), where it plugs into shared projection + thumbnails + shared
   routes + heatmap, and retroactivity.
3. session-photos-spec.md — concrete build spec for Strava-style session photos (model settled
   in plan §4 — build ON it): media sidecar table (migration 018) + payload MediaRef with
   UUID/relative-path/syncState, on-device pipeline (pick/capture → downscale 2 renditions →
   EXIF-strip → documentDirectory/media), local-first-now / sync-to-Supabase-Storage-later queue
   with signed-URL private media, photo-forward feed card + hero + gallery, composition with
   Share/Save, and S/M/L passes including the standalone pre-backend S0.8 photos-local pass.
4. activity-groups-spec.md — deferred Discord-vibe communities + the one sanctioned home for
   member-set segments. Define the entity model, the Supabase schema + RLS-shaped member-only
   access as a scope SEPARATE from the follow graph, and SEGMENTS in detail (what a segment is,
   how a member sets one, how entries are created and ranked). Quote the exact amended-rule-5
   boundary language; confirm segments are clean ONLY via member-created-group scoping. Turn the
   unsized S9 bucket into real sized passes.
5. moderation-legal-starter.md — NOT legal advice (say so top and bottom). Research current 2026
   Apple Guideline 1.2 UGC requirements + age-rating impact, Play's equivalent briefly, fitness/
   location/privacy-manifest requirements, and the GDPR/CCPA realistic minimum for a solo indie.
   Produce: App Store compliance CHECKLIST mapped onto Social S1 (confirm/flag gaps); plain-
   language content policy / community guidelines with an honest small-team report-response
   time; a privacy-policy outline (real draft per section, Supabase named as processor, export
   planned + deletion) and a lighter ToS outline (UGC ownership + display license, acceptable
   use, termination); and founder flags. Mark every spot needing a real lawyer.
6. social-build-spec.md — the CAPSTONE. Consolidate all of the above + social-expansion-plan.md
   into the single implementation-ready document a build session follows: for each S0–S9 pass,
   its scope, source spec(s), concrete Supabase tables touched, dependencies & hard gates, S/M/L
   size, definition of done; plus one critical-path dependency graph, the full deduplicated
   roster of still-open ⚑ founder flags (each with a recommended default), and a "what to build
   first" section. Reconcile and call out any contradictions between source docs.

Work autonomously through all six. If a genuine blocker appears, note it in the relevant doc and
keep going. When done, give a brief summary of each file written and one consolidated list of
every open founder flag across all six.
```
