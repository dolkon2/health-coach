# Session photos — implementation spec (attachments, ingest, local-first media, feed rendering)

v1 — 2026-07-11. Part of the rework research set. Authority lineage: builds ON
`social-expansion-plan.md` §4 (the settled photo research — pipeline verdict, attachment
model, cap/hero, EXIF gate, storage costs; **nothing there is reopened here**), the
Supabase backend spec §6.2 + §9.3 (the server half: private bucket, renditions, signed
URLs, the media sidecar in sync), `profile-settings.md` (the logbook, where photos render),
and the amended constitution (`planning/claude-md.md`). This spec turns that settled
research into buildable passes. Planning only — no code.

**Verification posture — checked against the working tree 2026-07-11, not recalled:**

- `expo-image-picker` and `expo-image-manipulator` are **NOT installed** (`package.json`
  carries `expo-camera ~16.1.11`, `expo-file-system ~18.1.11`, `expo-crypto`, and no
  image-picker/manipulator entry). Both are new deps; both are native modules → **a new
  dev-client build rides the first pass**.
- `SessionPayload` (`core/src/observation.ts`) carries **no media field today** — nothing
  on any payload references an image, and no media/photos table exists in
  `src/storage/migrations/`. The food-camera path (ring2 2.7/2.8) parses-and-discards;
  nothing image-shaped persists anywhere in the app.
- Migration registry (`src/storage/migrations/index.ts`): 001–009, 010–013 burned,
  014–017 registered. 016 = `routes` (claimed by the in-flight Routes session), 017 =
  `recording_buffer` (Session 8). **Next free is 018 — this spec claims it** (§2).
- The Profile logbook (P2) is **built**: `app/profile.tsx` renders list + calendar over
  `useSessionHistory`; entry tap routes to `/log-session?editId=` — the edit screen *is*
  today's session detail (RouteMap hero when a track exists). The S0.8 gate ("the logbook
  exists") is already satisfied.
- `uuidv7()` exists (`src/lib/id.ts`); `updateObservation` hard-overwrite is the
  established edit pattern (`app/log-weigh-in.tsx`, `app/log-rom.tsx`).

## 0. What this spec settles vs. what needs Dylan

Settled here (engineering defaults, decided with rationale — flag only if you disagree):
the `MediaRef` pointer + payload-array ordering model (§2); the two-step
prepare/commit ingest so photos can be picked before an observation id exists (§3.2);
EXIF stripping as a property of the re-encode, verified by test (§3.3); no eviction in
the local-only era, oldest-first display-rendition eviction of *uploaded* photos in the
sync era (§4.3); logbook thumb strip + detail gallery below the existing map hero, feed
card photo-forward (§5); photo audience = session audience, never per-photo (§6).

Needs Dylan (§10): **⚑P1** (mid-recording capture button on the Map live panel — product
scope). Carried untouched: **⚑N5** (does photos-local jump the queue — already yours from
the plan).

## 1. Purpose & constitution alignment

Photos on a logged session are **self-expression, not data**. The constitution reading,
binding on every pass:

- **Rule-5 clean:** a photo is something that already exists in the world — the user took
  it. No completion meter grows when one is attached; no count, score, or streak ever
  derives from photo presence, on the mirror or anywhere.
- **Never a nudge:** the app never says "add a photo," at capture, at save, or later. An
  entry without a photo is a fully valid state — same rule as the caption
  (plan §2.1). The attach affordance is quiet and pull-only.
- **Photos are invisible to the engines.** No engine (`core/`) ever reads the media
  table or a `MediaRef`. Fidelity, stimulus, expenditure, correlation — none of it knows
  photos exist. A photo changes nothing about what the session *was*.
- **The food camera is a different animal and stays one.** Ring 2's photo path is an
  input *parser* (photo → macros → image discarded). That covenant is untouched; this
  spec adds no persistence to the food path and shares only low-level primitives
  (`expo-camera`, and the downscale utility once it exists).
- **EXIF stripping is a privacy hard gate** (plan §4), peer to privacy zones: strip all
  metadata — GPS above all — at ingest, so no later code path can leak what was never
  stored.

## 2. Attachment data model

### 2.1 The payload side — `MediaRef`

`SessionPayload` gains one optional field (payload JSON — additive, **no core-record
migration**, same posture as every block):

```ts
// core/src/observation.ts
export type MediaRef = {
  id: string; // media table row + on-disk folder name (uuid v7)
};

export type SessionPayload = {
  // …existing fields…
  media?: MediaRef[]; // attached photos; ARRAY ORDER = display order; index 0 = hero
};
```

Decisions, made plainly:

- **A ref object, not a bare string array.** Today a `MediaRef` is just `{ id }`; when
  per-photo captions arrive (plan §4 defers them — the entry's caption carries the words
  at MVP), they land as an additive optional field on the ref, no array reshape.
- **Ordering lives in the payload array, nowhere else.** Index 0 is the hero (plan §4:
  hero = first photo by default). The local media table carries **no position column** —
  one source of truth on device. The server `media.position` column (backend spec §4) is
  a *projection* of the array index, written at upload time, because server projections
  read the media table without parsing payload JSON. Reorder/hero-pick = payload edit →
  outbox upsert rewrites positions server-side (§6).
- **Session-only.** `media` exists on `SessionPayload` and no other payload kind. The
  table is generic (`observation_id`), so nothing structural blocks a future kind, but no
  UI path exists and non-session kinds are structurally unshareable anyway (backend
  guardrail 5).
- **Cap 6 per entry** (plan §4, settled) — enforced at the picker (`selectionLimit` =
  remaining slots) and re-checked at commit.

### 2.2 The media sidecar table — **claims migration 018**

**This spec claims local migration number 018 explicitly** — verified free against the
working-tree registry (001–009, 014–017; 016 = routes, 017 = recording_buffer). Every
later claimant queues behind it: the backend spec's `sync_outbox` ("next free ≥018 at
build time") now reads **≥019**, and the gear Earth-arms migration
(`profile-settings.md` P9) queues after that. Ripple recorded in §11.

```sql
-- 018_media.ts
CREATE TABLE media (
  id TEXT PRIMARY KEY,            -- uuid v7 (src/lib/id.ts); same id on the server forever
  observation_id TEXT NOT NULL,   -- owning session observation
  rel_path TEXT NOT NULL,         -- 'media/<id>' relative to documentDirectory (§3.4)
  width INTEGER NOT NULL,         -- display-rendition pixels (layout driver)
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,         -- display + thumb, total on disk
  created_at TEXT NOT NULL,       -- ISO instant
  sync_state TEXT NOT NULL DEFAULT 'local_only'
    CHECK (sync_state IN ('local_only','queued','uploaded'))
);
CREATE INDEX idx_media_observation ON media(observation_id);
```

- **UUID filenames + relative paths + `syncState`, all from day one** (plan §4's
  future-proofing, at zero cost now). `rel_path` is relative because the iOS app
  container path (the absolute `documentDirectory` prefix) **changes across
  reinstalls/updates** — storing absolute paths is a known way to strand files. Resolve
  at read: `documentDirectory + rel_path + '/display.jpg'`.
- `sync_state` is dead weight until the backend era — every row says `local_only` — and
  that is the point: when B2 lands, the upload queue reads a column that already exists
  on every photo ever taken (backend spec §9.3 consumes exactly this).
- **Dimensions are the display rendition's** — the one number rendering needs before a
  file loads (aspect-ratio reservation, no feed jank). The thumb is ~400 px by
  convention; no second dims pair.
- **No SQLite FK** — matches the codebase convention (no migration uses one). Integrity
  is owned by the delete path + janitor (§3.5): `deleteObservation` gains a cascade
  (delete media rows + files for the observation), and a conservative sweep cleans
  orphans from crashes.
- Mirrors the server `media` table (backend spec §4: `id, observation_id, owner_id,
  position, width, height, bytes, created_at`) minus `owner_id` (single-user device) and
  `position` (§2.1), plus `rel_path`/`sync_state` (device-only concerns).

## 3. On-device pipeline

### 3.1 Doors

- **Primary: camera roll, after the fact** (plan §4: "you photograph the river, not the
  app"). `expo-image-picker` `launchImageLibraryAsync` with
  `allowsMultipleSelection: true`, `selectionLimit` = remaining slots, images only. Two
  attach points, one shared component: the **log-session detail step** (new "Photos"
  section, present in both create and `editId` mode — so attach-after-save is just
  opening the logbook entry) and nothing else at MVP. The logbook-entry route
  (`/log-session?editId=`) already exists and is the deep-link target of the save
  confirmation, so "add photos to the session I just recorded" is already two taps.
- **Secondary: in-session capture** — a small camera door inside the same Photos section
  (`expo-camera` `takePictureAsync` → same ingest), PH2 not PH1. Permission copy exists
  from ring2 2.7a. The picker needs **no new permission strings**: iOS PHPicker and
  Android 13+ photo picker run out-of-process without library permission (set the
  image-picker config plugin's `photosPermission` off so no unused string ships).
- **Import-a-track / HealthKit sessions** get photos the same way as everything else —
  open the entry, attach. No special path.
- **SaveRecordingSheet stays untouched.** The record-save path (crash-safe buffer,
  conditions freeze) is freshly verified; photos ride the post-save deep link instead of
  adding a picker to that sheet. Mid-recording capture is ⚑P1, not assumed.

### 3.2 Ingest — prepare/commit, in that order

At log time the observation id does not exist until `buildSessionObservation` runs at
save, so ingest is two steps:

1. **`prepareMedia(uri)`** (at pick/capture time): downscale to the two renditions,
   write `media/<id>/display.jpg` + `thumb.jpg`, return
   `{ id, relPath, width, height, bytes }`. Runs per photo with inline progress in the
   Photos section — the ~1–2 s of image work happens at pick time, **never at save-tap**.
2. **`commitMedia(prepared[], observationId)`** (at save, or immediately when attaching
   to an existing entry): insert the media rows, then write the payload refs
   (`createObservation` / `updateObservation`, established patterns).

Write order is always **files → rows → payload refs**. A crash between steps leaves
orphan files or rows referenced by nothing — swept by the janitor (§3.5) — and never a
payload ref pointing at nothing. A `prepareMedia` failure (corrupt image, disk full)
drops that photo with a plain inline message; **the session save itself is never blocked
or delayed by photo processing** — logging is the product, photos are decoration.

### 3.3 Renditions + EXIF strip

Per plan §4, settled: **display JPEG, long edge 2048 px at ~0.8 quality (~300–500 KB)**
and **thumbnail long edge ~400 px (~40 KB)**, via `expo-image-manipulator`
(`ImageManipulator.manipulate(uri).resize(...)` → `saveAsync({ compress: 0.8, format:
JPEG })`). Originals are never kept — the display rendition is the stored artifact; the
source HEIC never leaves the picker's temp URI, which is not retained past the ingest
call.

**The strip is a property of the re-encode**: the manipulator renders the bitmap and
writes a fresh JPEG — original metadata (GPS, timestamps, device serial) does not
survive, and orientation is baked into the pixels. Two belt-and-braces rules so this
stays true rather than accidental:

- The picker is **never** called with `exif: true`, and no code path reads or stores the
  picker's EXIF object.
- **PH1's verify bar includes an EXIF test**: ingest a fixture JPEG with a GPS block,
  assert the stored `display.jpg` and `thumb.jpg` contain no GPS/EXIF tags. The gate is
  enforced by a test, not by trusting a library's current behavior.

### 3.4 File layout

```
documentDirectory/
  media/
    <mediaId>/          ← uuid v7, same as the row id and the future server path segment
      display.jpg
      thumb.jpg
```

`documentDirectory` (expo-file-system, already installed), **never `cacheDirectory`** —
documents persist and ride device backups (plan §4). Rendition names are fixed by
convention; the server path (`{owner}/{observation}/{media}/display.jpg|thumb.jpg`,
backend spec §6.2) reuses the same convention, so upload is a path map, not a rename.

### 3.5 Deletion + the janitor

- **Remove a photo from an entry**: payload edit (drop the ref) + delete row + files.
- **Delete a session** (`deleteObservation`): cascade — delete its media rows + files.
  (Sync era: the outbox delete tears down server rows/objects too — backend spec §9.4;
  the local cascade is the same code path with one more enqueue.)
- **Janitor** (app launch, throttled): delete `media/` folders with no row, and rows
  whose observation is gone or whose payload no longer refs them — **only when older
  than 24 h**, so it never races an in-progress log. Conservative by design; its job is
  crash crumbs, not policy.

### 3.6 Build environment notes

- Both new deps are native modules: `npx expo install expo-image-picker
  expo-image-manipulator` (SDK-53-resolved), `--legacy-peer-deps`, then **a new dev-client
  build** (the S8 client predates these deps). Same EAS `development` profile as always.
- Dependency changes happen **only in the main worktree session** — the standing
  parallel-session rule; a photos build session coordinates its install like every native
  pass before it.

## 4. Local-first now, sync later

### 4.1 What ships with no backend at all (PH1 = the plan's S0.8)

Everything in §2–§3 plus §5's own-surfaces rendering is complete with zero network: a
visual logbook. Every row sits at `local_only` forever until the backend era. Standalone
value, zero rework later — the table, ids, paths, and `syncState` are already the shapes
B2 consumes. This is exactly the plan's ⚑N5 recommendation (self-contained, M-sized,
everything social later reuses it).

Local storage math (why no eviction yet): worst case 6 photos × 440 KB ≈ 2.6 MB/entry;
a heavy user (4 sessions/week, ~2 photos avg) accrues ~45 MB/year, absolute worst
~550 MB/year. Nothing to manage pre-sync; do not build speculative eviction.

### 4.2 The sync half (backend era — rides Social S2/B2, not a new pass of its own)

Already architected in the backend spec; restated here only as the client-side media
contract:

- **Share enqueues, the outbox drains** (backend spec §9.2–9.3): on Share, each photo's
  two renditions upload (ArrayBuffer PUT to the private `media` bucket, path
  `{owner}/{observation}/{media}/…`), the server `media` row upserts with `position` =
  payload array index, and local `sync_state` walks `local_only → queued → uploaded`.
  Local write always completes first; the Share button never spins on network.
- **Viewing others' photos** (S3): projection RPCs mint **long-lived (~7 day) signed
  URLs**, cached client-side and reused so the Smart CDN actually caches (per-token
  caching — a fresh URL per render would defeat it). Private/friends-only is enforced by
  the grant resolution inside the projection — the bucket has no cross-account read
  path at all.
- **Edit/reorder propagates, un-share tears down** (§6): server state is always the
  latest local state; un-share deletes server rows + objects. Local files are never
  touched by un-share.

### 4.3 Eviction under storage pressure (sync era only)

Decided default, plainly:

- **Only `uploaded` photos are evictable, and only their `display.jpg`.** Thumbs always
  stay (the logbook never goes blank offline); `local_only`/`queued` photos are the sole
  copy in existence and are **never** evicted.
- **Trigger:** total `media/` size checked on app foreground against a soft budget
  (default **2 GB**, a plain constant). Over budget → evict oldest-first by `created_at`
  until under. No LRU bookkeeping — not worth a write-per-view for a personal media dir.
- **No fourth `sync_state`:** evicted is detected by file absence
  (`getInfoAsync(display) → !exists` while `uploaded`), and restore is idempotent:
  session detail renders the thumb immediately, fetches the display rendition via its
  own signed URL, writes it back to `rel_path`, done. The state machine stays three
  states; the filesystem is the cache index.
- Pre-backend (PH1), none of this exists — there is nothing safe to evict (§4.1).

## 5. Rendering

All light-only (no dark mode, locked); tokens per the design-system handshake.

- **Logbook entry card** (`app/profile.tsx` list): a small **thumb strip** (up to 3
  thumbs + "+N" overflow chip) below the existing summary line when `media` is
  non-empty. Absent otherwise — never an empty placeholder, never an "add" affordance on
  the card. Calendar view is untouched (checkmarks, not thumbnails). Lists render
  **thumbs only** — a 2048 px decode never happens in a scroll view; that is what the
  thumb rendition is for.
- **Session detail** (`/log-session?editId=`): the existing map hero (RouteMap when a
  track exists) **stays the hero** — the mirror leads with what the session was. A
  **Photos section** renders directly below it: hero photo large (aspect-ratio from
  `width/height`), remaining photos as a horizontal thumb row; tap → full-screen pager
  (display renditions, pinch-zoom, swipe). The same section carries attach (picker
  door), remove, and — PH2 — reorder/hero-pick and the capture door.
- **Feed card** (Social S3, backend era): **photo-forward** — hero photo as the card
  image (fixed card ratio, cover-crop, aspect reserved from projection dims), **route-map
  thumbnail as the fallback hero** when no media exists (and behind the zones gate;
  else stats-only card). Both per plan §4/S3, both Strava-precedented. Others' photos
  load via cached signed URLs (§4.2); own shared entries render from local files —
  free, and offline-correct.
- **Hero pick** (PH2): long-press → "make cover" reorders the ref to index 0; drag to
  reorder the rest. Until PH2, hero = whatever was picked first, which is the plan's
  stated default.
- **No filters, no editing, no per-photo captions at MVP** (plan §4, settled). The
  entry's caption carries the words.

## 6. Composition with Share/Save + grants

The photo's audience **is the session's audience** — there is no per-photo privacy
control, ever. One fewer decision surface, and structurally: a `MediaRef` lives inside
the payload, so whatever grant governs the observation governs its photos. Cases:

- **Saved (private) session:** media rows stay `local_only` for life (backend spec §9.3,
  verbatim). No server row, no bucket object, nothing to count, nothing to leak — **a
  private session's photo never leaves the device**, by construction rather than by
  filter.
- **Shared session:** Share enqueues observation upsert + media uploads + grant upsert,
  in that drain order — the grant lands last, so nothing is visible remotely until every
  photo under it landed (backend spec §9.2's ordering rule, inherited).
- **Attach to an already-Shared session:** payload edit → outbox upsert → new photo
  uploads + positions rewrite. Edits propagate (current-version authority, backend spec
  §9.4).
- **Remove / reorder on a Shared session:** same path; removed photo's server row +
  objects delete in the drain.
- **Un-share (Save-after-Share):** grant + observation + media rows + storage objects
  all delete server-side (backend spec §9.4); local files and rows revert to
  `local_only` untouched. Kudos/comments cascade away — the un-share confirm sentence
  already covers it.
- **EXIF never crosses** because it never existed past ingest (§3.3) — share-time has
  nothing to re-check.

## 7. Build passes (S/M/L, each independently shippable)

- **PH1 — Photos, local-first (M). = the plan's S0.8; pre-backend; independent of all
  social work.** Deps + dev-client rebuild; `MediaRef` on `SessionPayload`; **migration
  018** (`media` table); `src/lib/media/` (prepare/commit ingest, delete cascade,
  janitor); Photos section on log-session detail (picker attach/remove, gallery,
  full-screen pager); logbook thumb strip. Verify bar: attach 6 from the roll → strip
  test passes (GPS fixture in, no EXIF out) → thumbs on the logbook card → gallery +
  pager on detail → remove one → delete the session → files and rows gone; janitor
  clears a simulated half-ingest; an entry with zero photos renders exactly as today;
  tsc last, after tests.
- **PH2 — Capture door + hero/reorder (S).** In-session camera door in the Photos
  section (reuses 2.7a permission + pattern); long-press make-cover; drag reorder.
  Any time after PH1.
- **PH3 — Media sync half (M, backend era; rides Social S2 / backend B2 — not
  separately schedulable).** The §4.2 contract: outbox media entity, uploads +
  `sync_state` walk, position projection, un-share/delete teardown, **eviction +
  restore (§4.3)**. Most of this pass's weight is B2's; PH3 names the client media
  slice so it isn't double-planned.
- **PH4 — Feed photo rendering (S, inside Social S3).** Photo-forward card + route-hero
  fallback; signed-URL consumption + cache. S3 already owns the card; PH4 is the media
  slice of it.

Sequencing: PH1 gates PH2–PH4; PH3 lands inside S2/B2, PH4 inside S3 — the sync half
adds **no new rungs** to the social ladder. ⚑N5 (whether PH1 jumps the pre-backend
queue) stays Dylan's, unchanged.

## 8. Data touchpoints

- **`core/src/observation.ts`**: additive `MediaRef` + `media?: MediaRef[]` on
  `SessionPayload` only. No engine reads it; `serialize.ts` passes it through as
  payload JSON unchanged.
- **Migration 018 — claimed by this spec** (§2.2). Later claimants renumber from ≥019:
  backend `sync_outbox`, gear Earth-arms (P9), both queue-at-build-time by their own
  specs' rules.
- **`src/storage/observations.ts`**: `deleteObservation` gains the media cascade; new
  `src/storage/media.ts` for row CRUD; batched `listMediaForObservations(ids)` for the
  logbook strip (one query per window, not per card).
- **Files**: `documentDirectory/media/<id>/{display,thumb}.jpg`; relative paths in the
  table; container-move-safe.
- **New deps**: `expo-image-picker`, `expo-image-manipulator` (native → dev-client
  rebuild; installs only from the main session).
- **Screens touched**: `app/log-session.tsx` (Photos section on the detail step),
  `app/profile.tsx` (thumb strip). SaveRecordingSheet, Map record path, food camera:
  untouched.
- **Server side (later)**: exactly backend spec §4 `media` table / §6.2 bucket / §9.3
  sidecar — this spec adds no server surface and changes none.

## 9. Guardrails — binding on every pass

1. **EXIF-strip at ingest, enforced by test** — a GPS-tagged fixture in, clean files
   out, in PH1's suite and never removed. No code path stores or forwards picker EXIF.
2. **Never an "add a photo" prompt** — no nudge at save, no empty-state CTA on cards, no
   "sessions with photos get more kudos" anything, ever. The affordance exists where the
   user already is; it never calls out.
3. **A photo-less entry is a first-class state** — zero layout debt, zero placeholder.
4. **Photos never block logging** — ingest failures drop the photo with a plain message;
   the save path never waits on image work.
5. **Engines never see media** — no `core/` import of the media table, no fidelity/
   stimulus/correlation input derived from photo presence. Photos are not data.
6. **`local_only` never uploads** — a Saved session's photos have no upload path; only a
   Share grant's drain order touches the bucket.
7. **Originals are never retained** — the display rendition is the artifact; source URIs
   are not persisted.
8. **Never evict the only copy** — eviction touches `uploaded` display renditions only;
   thumbs and `local_only`/`queued` files are untouchable.
9. **The food camera stays parse-and-discard** — no shared persistence path; shared
   primitives only (camera dep, downscale utility).
10. **No filters/editing** — what the camera saw is what renders (crop-to-cover in
    layout is display, not editing).

## 10. ⚑ Flags for Dylan

- **⚑P1 — RESOLVED 2026-07-15 (Dylan): defer.** Start with photos sourced from the user's
  own photos app (the after-the-fact picker, PH2); an in-app "snap a photo" button on the
  live Map recording screen is a future Arc 2 enhancement, not MVP — matches the
  recommendation exactly.
- **⚑N5 — RESOLVED 2026-07-15** (`social-expansion-plan.md` §7): ship photos-local
  (PH1/S0.8) early, before the backend era. This spec's P2-gate verification supported the
  "yes" case; Dylan's notes confirm it.

*(Cap = 6, hero = first, EXIF gate, no-prompt rule, no captions at MVP, storage
platform + costs: all settled in plan §4 / backend spec §6.2 — not reopened.)*

## 11. Dependencies & doc ripple

- **`social-expansion-plan.md`** — §4 is this spec's authority; S0.8 in its ladder = PH1
  here. Its "S0.8 (018+)" now reads as a hard claim: **018, this spec**.
- **Supabase backend spec** — its §9.2 `sync_outbox` "next free ≥018" becomes **≥019**
  (018 claimed here); its §9.3 media sidecar is PH3's contract, unchanged.
- **`profile-settings.md`** — its §4 "next free is 017" was already stale (017 =
  recording_buffer); with 018 claimed here the gear Earth-arms claimant (P9) queues from
  **≥019**. Its P2 logbook is PH1's rendering host (verified built).
- **`social-tab.md` §6** — the plan's ripple item still pending: add **guardrail 9 =
  EXIF-strip at ingest** (currently ends at 8). Belongs to S0.5's doc pass; recorded
  here so it isn't dropped.
- **Consolidated migration ledger** (S0.5) — record: 016 routes · 017 recording_buffer ·
  **018 media (this spec)** · next free 019.
- **`ring2-camera-build.md`** — its deferred `expo-image-manipulator` install lands via
  PH1; the food path may reuse the downscale utility afterward. Nothing else touches it.
- **Map track** — privacy zones gate feed *route thumbnails* (S3), not photos; photos
  carry no location by construction (§3.3), which is exactly why the EXIF gate is a hard
  gate.

## 12. Plain-language summary

**What this builds:** photos on your logged sessions, like Strava — pick a few shots
from your camera roll after a paddle or a flight, they show up on the session in your
logbook, and (later, if you Share that session) in the feed with the first photo as the
cover.

**How it works underneath:** each photo is shrunk to two copies on your phone — a big
one for viewing, a tiny one for lists — and every scrap of hidden metadata (especially
the GPS location cameras embed) is destroyed the moment it's imported, provably, with a
test. Photos on a session you keep private **cannot** leave your phone; sharing a
session is the only thing that ever uploads its photos.

**Key decisions made here:** the photo bookkeeping table takes **migration number 018**;
photo order lives in one place (the session record, first = cover); the map stays the
hero on your own session detail with photos right under it, while the *feed* leads with
the photo; storage cleanup only ever touches photos that already have a safe copy on the
server. One question for you (⚑P1): should the Record screen get a snap-a-photo button
while recording, or is adding photos afterward enough? (Recommendation: afterward is
enough for now.)
