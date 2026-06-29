# Phase 4, Pass 6 — Practice surface (yoga / pilates / mobility)

**Goal:** Give the practice identities (yoga, pilates, mobility, meditation) their
own surface — duration, perceived effort, an optional style tag, and a note. No
per-pose logging. (planning/phase-4-training-plan.md, Pass 6)

Verified green: **tsc** exit 0, **jest 87/87**.

## What shipped

- **`PracticeBlock`** (`core/src/observation.ts`) — just an optional `style` free
  tag; added `practice?` to `SessionPayload`. Maps to `modality: 'mobility'` via the
  registry.
- **Honest ledger treatment** — practice carries no pattern or energy volume. Like
  climb/hike it appears in `sessionIds` and contributes nothing fabricated to the
  bars (verified by a test asserting empty `byPattern` and zero energy-system
  minutes).
- **`revealPractice`** (`core/src/stimulus.ts`) — "vinyasa · 45 min" when a style is
  given; otherwise it falls back to the activity identity line ("yoga · 45 min").
- **Build / round-trip** (`src/lib/session.ts`) — a styleless practice writes *no*
  block (the identity + duration says it); a style writes `{ style }`. Round-trips
  through invert → rebuild.
- **Practice body** (`app/log-session.tsx`) — replaces the last stub with a single
  optional Style field; duration/effort/notes come from the shared footer.

## Decisions applied

- Session-level only, no per-pose logging (locked).
- Descriptive, never fabricated: practice adds an honest session record, not a fake
  volume number.

## Phase 4 core cut — complete

Passes 1, 2, 3 (3a + 3b), 5, 6 are all shipped. The three-layer model (identity →
surface → engine modality) is live with five real surfaces (gym, GPS, climbing,
swim, practice) plus the footer-only 'other'. Deferred fast-follows remain: Pass 3c
(static exercise seed + autocomplete), Pass 4 (full exercise library), Pass 7
(templates), Pass 8 (identity tags + history filter).
