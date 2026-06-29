# Phase 3 Pass 2 — Session Prompt

Copy everything below the line into a new Claude Code session opened in `~/Projects/health-coach`.

---

## Prompt

Read `CLAUDE.md`, then read `planning/phase3-pass2-handoff.md` and `planning/wearable-ingestion-spec.md` fully before doing anything.

**Your job: Phase 3 Pass 2 — read steps and sleep from Apple Health via HealthKit and display them on the Today screen.**

### PLAN FIRST — do not write code yet

Enter plan mode. Show me exactly what you're going to build, which files you'll create or modify, and what the Today screen will look like with steps and sleep cards alongside the existing weigh-in, sessions, and food sections. I want to approve the plan before you touch any code.

### What to build (after plan approval)

1. **HealthKit permission request** — on app launch (or first visit to Today), request read access for steps and sleep. Use `@kingstinct/react-native-healthkit` (already installed). Don't request until user interaction triggers it (a button or a prompt), per Apple guidelines.

2. **Steps reader** — query `HKQuantityTypeIdentifierStepCount` for the current civil day. Use source-grouping to pick one authoritative source (prefer wearable over iPhone pedometer — do NOT sum across sources). Emit one `steps` Observation per day with `tier: 1, fidelity: 0.9, source: { type: 'healthkit', rawType: 'HKQuantityTypeIdentifierStepCount' }`.

3. **Sleep reader** — query `HKCategoryTypeIdentifierSleepAnalysis` for last night. Attribute to the wake day (the day sleep ended, not the day it started). Emit one `sleep` Observation with `durationMin`, `tier: 1, fidelity: 0.85`. If staged breakdown (deep/REM/light/awake) is available for free, store it as the optional `stages` field — but never surface it above the hours in the UI.

4. **Shared `WearableSource` interface** — define `requestPermissions()`, `readSteps(range)`, `readSleep(range)`, `readActivities(range)`. Implement the HealthKit reader behind it. Stub `readActivities` as not-implemented (that's Pass 3). Leave room for a Health Connect reader but don't implement it.

5. **Backfill** — on first permission grant, read trailing 3 months of step and sleep history and insert as Observations. This gives the timeline a baseline instead of starting empty.

6. **Source-precedence dedup** — if multiple sources wrote steps for the same day (iPhone + Garmin + Apple Watch), pick one. Prefer wearable over phone. Do not double-count.

7. **Today screen display** — add steps and sleep cards to the existing Today screen (`app/(tabs)/index.tsx`). They sit alongside the existing weigh-in, sessions, and food sections. Steps = simple daily total number. Sleep = hours and minutes. Both are read-only (no manual logging, no edit, no delete for auto-imported data).

### Where things go on Today

The Today screen currently shows (top to bottom): date header → weigh-in → sessions → food. Add:
- **Steps** — a compact card showing today's step count. Place it after weigh-in, before sessions. It's a glance fact, not interactive.
- **Sleep** — a compact card showing last night's sleep duration (e.g. "7h 23m"). Place it after steps, before sessions. Also a glance fact.

Both cards should feel like the existing weigh-in card in density/style — tier-1 facts, not dashboards. No charts, no graphs, no elaborate breakdowns. Just the number.

### Critical constraints

- **DO NOT touch the Nutrition tab** (`app/(tabs)/nutrition.tsx`, `src/lib/foodLog.ts`, `src/lib/foodSearch.ts`, `src/hooks/useFoodLog.ts`, `src/storage/foodCache.ts`, `src/storage/mealTemplates.ts`, `core/src/nutrition/*`). Nutrition is being actively built in parallel. Don't modify, refactor, or "improve" any food-related code.

- **DO NOT touch the Training tab** (`app/(tabs)/training.tsx`, `src/lib/activity.ts`, `planning/phase-4-training-plan.md`). Training is being built on a separate branch. Don't modify any training-related code.

- **DO NOT touch `log-food.tsx`, `log-session.tsx`, or `log-weigh-in.tsx`** — those are logging screens for other features. This pass has no logging screen (steps and sleep are auto-imported, not manually entered).

- **DO NOT add background sync.** No `HKObserverQuery`, no background delivery, no push notifications. Poll-on-open only — read HealthKit when the Today screen opens. This is a deliberate product decision, not a missing feature.

- **DO NOT modify `core/src/observation.ts`** — the schema already has `SleepPayload`, `StepsPayload`, and the HealthKit source type. Use them as-is.

- **DO NOT write back to HealthKit.** Read-only.

- **`--legacy-peer-deps` is required** for any `npm install` commands.

- **AGENTS.md says "read Expo v56 docs" — ignore that. The project is on SDK 53.**

- **This is a dev-client app, not Expo Go.** The dev client is already built and on the phone. JS changes just need a reload, no rebuild. Only rebuild if you add a new native module (you shouldn't need to for this pass).

### Branch strategy

Create a new branch `phase-3-pass-2` off current `main` for this work. Do NOT work directly on main.

### Definition of done

- [ ] HealthKit permission request works (button or prompt, not silent)
- [ ] Steps show on Today as a daily total card
- [ ] Sleep shows on Today as a duration card (hours + minutes)
- [ ] 3 months of backfill populates on first permission grant
- [ ] Source-precedence dedup prevents double-counted steps
- [ ] No food/nutrition/training code was touched
- [ ] `npx tsc --noEmit` clean
- [ ] `npx jest` green
- [ ] Plan shown and approved before any code was written
