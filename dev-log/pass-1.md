# Pass 1 — Repo scaffold + brand kit

**Goal:** Working Expo app shell, brand kit wired as a theme, `core/` engine
importable, placeholder Today/Reflect/Settings screens. (game-plan-and-prompts.md)

## What shipped

- Expo + expo-router + TypeScript. Two tabs (Today, Reflect); Settings is a
  gear icon in the header, not a tab.
- `core/` engine package: real `Observation` / `Benchmark` types from
  data-model.md, plus honest signature stubs for timeline/trend/expenditure/
  stimulus that **throw** until their pass builds them (no fake numbers).
- Brand kit → `src/theme/`: `tokens.ts` (dark + light palettes, type scale,
  spacing, radius, motion), `ThemeProvider` exposing tokens via context,
  `fontMap` preloading Barlow Condensed / Inter / JetBrains Mono.
- Components: `Text`, `Card`, `Button`, `Screen`, `FidelityIndicator`.

## Decisions

1. **Folder structure vs the build spec.** The spec puts screens under `app/`,
   but expo-router *reserves* `app/` for file-based routes. Resolution: routes
   live in `app/` (thin), implementation lives in `src/` (theme, components,
   lib). Same separation the spec intends.
2. **Core engine: build from specs as we go.** The "already written" engine
   wasn't anywhere on disk. We set up `core/` with real types now and implement
   each engine when its pass needs it (trend → Pass 3, stimulus → Pass 4,
   expenditure → Phase 2). Unbuilt engines throw via `notImplemented()`.
3. **`core/` import wiring: TS path aliases**, not a monorepo tool. `@core/*` →
   `core/src/*`, `@/*` → `src/*`, resolved automatically by Expo's Metro. Keeps
   Phase 1 simple; `core/` can graduate to a workspace package later unchanged.
4. **Import-style deviation.** `core/` uses extensionless relative imports (not
   the `.js` extensions the constitution suggests) because it's bundled by Metro
   and tested with jest-expo, not run via standalone Node ESM. Documented in
   `core/README.md`.

## Out of scope (deliberately not built)

Splash, onboarding, auth, any UI kit, charting library (Pass 5 decides).

## Verified

Type-check clean. App boots on web; Today/Reflect/Settings render with correct
fonts and theme tokens; tab active/inactive colors correct; navigation to the
log modals + Settings works; dark (default) and light palettes both render.

## Next — Pass 2: storage layer

SQLite via expo-sqlite, migrations, `observations.ts` + `benchmarks.ts` CRUD,
a jest-expo smoke test. No UI. See game-plan-and-prompts.md.
