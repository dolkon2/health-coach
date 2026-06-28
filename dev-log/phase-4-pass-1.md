# Phase 4, Pass 1 — Activity registry + Training tab shell

**Goal:** Stand up the three-layer model's identity↔surface map and the Training
tab as the new logging home + session history. No logging-form internals change
yet. (planning/phase-4-training-plan.md, Pass 1)

## Pre-flight

Green baseline confirmed before building: `tsc` exit 0, `jest` 23/23 (Phase 1 / Pass 5
state). After this pass: `tsc` exit 0, `jest` 37/37.

## What shipped

- **Activity registry** `src/lib/activity.ts` — the identity layer. `Activity` =
  `{ id, label, surface, modality, icon, defaultEnergySystem?, defaultIdentityTags? }`.
  Many identities → few surfaces (Calisthenics/Strength/CrossFit → gym; Run/Ride/Hike/
  Paddle/Surf/Wingfoil/Ski → gps; Swim → swim; Yoga/Pilates/Mobility/Meditation →
  practice; Climb → climbing). Pure data + lookups (`activityById`, `headlineActivities`,
  `moreActivities`) — no React/RN imports, so it stays platform-free like `lib/session.ts`
  and the test reads it directly. `icon` is a *name* string; the UI resolves it to a
  lucide component. `defaultEnergySystem` / `defaultIdentityTags` are carried now,
  consumed by later passes (2 / 8).
- **Training tab** `app/(tabs)/training.tsx` (+ tab wired in `_layout.tsx`, Dumbbell
  icon, between Today and Reflect). Activity picker (headline row + "More" long tail) on
  top; session-history feed below (reuses `SessionCard` + `stimulus.reveal()`, with the
  same swipe-to-delete + tap-to-edit affordances as Today). Re-fetches on focus.
- **`useSessionHistory`** `src/hooks/useSessionHistory.ts` — mirrors `useTodayObservations`
  but widens to a 365-day window, filters to sessions, newest-first. `reload()` for focus
  re-fetch.
- **Deep-link routing** — `log-session.tsx` now accepts an optional `modality` search
  param (additive; no form-body change). The picker hands the logger the activity's engine
  modality; the logger seeds the matching form and jumps to the detail step, or falls back
  to its own picker for modalities it has no form for yet (swim/practice → Passes 5/6).
- **Test** `src/lib/__tests__/activity.test.ts` — registry invariants: unique ids, valid
  surface/modality/label/icon, headline order, headline∪More partitions the registry once,
  `activityById` round-trips.

## Decisions (locked in the plan, applied here)

- **Today keeps its quick-log shortcut** for unplanned sessions (index.tsx unchanged).
  Training tab is history + the primary log entry point — **not** a planning surface (Phase 6).
- **Activity list ships as a seeded default constant** (`HEADLINE_DEFAULT_IDS`), not
  persisted settings — `useSettings` is still a stub; onboarding will populate the list
  later (deferred, backlog.md). No fake persistence.
- **Headline defaults = the form-ready activities** (Gym/Run/Ride/Climb/Hike/Paddle) so
  every front tile is fully loggable today. Swim/Practice/Surf/etc. live under "More" and
  route to the logger's picker until their surfaces land (Passes 5/6). Honest over flashy.
- **Identity is not yet persisted on the Observation** — the registry maps identity →
  engine `modality` for routing; the `activity` field on the payload lands in Pass 2.

## Notes / follow-ups for Pass 2

- The surface-driven logger refactor (Pass 2) replaces the `modality`-param deep-link with
  a real `activity` carried onto the record, and gives swim/practice/GPS their own surfaces.
- Verification was `tsc` + `jest` only (Expo/RN — no browser preview). Simulator smoke-test
  of the new tab is worth doing during the next interactive session.
