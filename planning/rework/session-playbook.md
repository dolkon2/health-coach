# Session Playbook — Product Rework

*For Dylan. One session at a time, in order, each with a copy-paste kickoff prompt.
Written 2026-07-11. Claude: if you're reading this at the start of a session, this file
plus `master-plan.md` plus the latest handoff in `dev-log/` is your context.*

## Ground rules (apply to every session)

- **Run sessions IN ORDER, one at a time**, always in `~/Projects/health-coach`. Never two
  Claude sessions on this folder at once — it corrupted the environment before
  (2026-06-27). While a session works, Dylan answers the next session's pinned questions.
- **Models:** Sonnet 5 = default builder. Opus 4.8 = planning-heavy sessions (marked
  below) — switch with `/model claude-opus-4-8`, back with `/model claude-sonnet-5`.
  Fable 5 = long hands-off/overnight autonomous builds (it ran the dimension merges
  overnight) — `/model claude-fable-5`.
- **Every session ends the same way** (baked into each prompt): full jest suite, `tsc`
  LAST, `/code-review`, sim smoke test if UI changed, then the `status-sync` and
  `dev-log-closeout` skills, then write a handoff prompt for the next session.
- **Skills available in this repo:** `sim-smoke-test`, `dev-log-closeout`, `status-sync`,
  `flag-resolution`. Native: `/code-review`, `/verify`, `/simplify`, plan mode.
- **Locked facts:** the claude.ai/design light kit is the design of record
  (snapshot: `planning/design-system/`); light-only, NO dark mode at launch; old
  `brand-kit.md` / `brand-kit-gorge-draft.md` are superseded in full. Single-concern
  commits; flag (⚑) don't reinterpret; descriptive-not-prescriptive constitution holds.

## Session sequence

| # | Session | Model | Questions first? |
|---|---------|-------|------------------|
| 1 | Brand token sweep (Passes 1–3) | Sonnet | No |
| 2 | Home log bar + element picker | Sonnet | Yes (2) |
| 3 | Nutrition Intake/Trend split | Sonnet | Yes (1) |
| 4 | Training landing + template library | Sonnet | Yes (1) |
| 5 | Benchmarks decision-proof + Pinned Spots on Home | Sonnet | Yes (2 leans to confirm) |
| 6 | The shell swap → 5 tabs + Profile/Settings | **Opus** | Yes (1) |
| 7 | Logbook → Profile + Reflect retirement | **Opus plan → Sonnet build** | Yes (3) |
| 8 | Background GPS recording | **Opus plan → Fable overnight build** | Yes (2) |
| 9 | Routes entity + shelf + follow | Sonnet | No |
| 10 | The rebrand swap PR (light-only) | Sonnet | Yes (1 + a joint screenshot session) |
| — | Later (Phase 4): SDK 56 + MapLibre v11 upgrade, Explore + route builder, Templates 3a/3b ruling, Gear Quiver | plan first | revisit after S10 |

Full prompts and pinned questions per session are below; the same content lives in
Dylan's playbook artifact.

---

### Session 1 — Brand token sweep · Sonnet · no questions

```
Read planning/rework/session-playbook.md, planning/rework/brand-integration.md and
planning/rework/master-plan.md. Do brand Passes 1–3:

1. Semantic rename: in src/theme/tokens.ts add accent / caution / modeled (+ chartSeries)
   to BOTH palettes pointing at current values; migrate all ~95 proper-noun references
   (sandstone/olive/clay/slate) across app/ and src/ to the semantic names; stop
   exporting the proper nouns. Zero visual diff by construction.
2. Element tokens: add element: { body, earth, water, sky } to both palettes with
   declared-throwaway placeholder values drawn from the existing palette. Add a
   DimensionTag chip component unless the Home spec owns one — coordinate, don't duplicate.
3. Doc hygiene: banner planning/brand-kit.md and planning/brand-kit-gorge-draft.md as
   fully superseded (design of record = planning/design-system/, light-only, no dark
   mode at launch); fix the tokens.ts header pointer.

Acceptance: grep -rE 'colors\.(sandstone|olive|clay|slate)\b' app src returns nothing;
app renders identically. Single-concern commits.
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 2.
```

### Session 2 — Home log bar + element picker · Sonnet

**Answer first:** (a) Home shelf order — template card → Pinned Spots → benchmarks →
nutrition → steps/sleep at the bottom: keep or reorder? Spots as cards or a plain link?
(b) Indoor climbing / pool swim (Earth/Water without GPS) — OK that they route by logging
surface with a "log without GPS" escape, per the spec's proposal?

```
Read planning/rework/session-playbook.md, planning/rework/tabs/home-tab.md,
planning/rework/master-plan.md, and the latest handoff in dev-log/.
Build the Home passes that need nothing from Map: the two-button log bar (Log Session /
Log Food) and the Earth/Sky/Water/Body element picker using theme.colors.element —
Earth/Sky/Water rows lead with my most-recent activity and route (interim) to the
existing log-session flow with the sport preselected; Body routes to Training
template/session selection. Then the glance-tier pivot per the spec.
My answers to the pinned questions: [PASTE ANSWERS]
Flag (⚑) anything ambiguous rather than reinterpreting. Single-concern commits.
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 3.
```

### Session 3 — Nutrition Intake/Trend split · Sonnet

**Answer first:** Intake landing — target-status first (spec's lean) or totals first?

```
Read planning/rework/session-playbook.md, planning/rework/tabs/nutrition-tab.md,
planning/rework/master-plan.md, and the latest handoff in dev-log/.
Build the Intake/Trend split on the current tab: Intake = tier-1 facts (day nav,
target-status, totals, meals, logger — all existing pieces re-homed); Trend = derived
(weigh-in, expenditure, energy-balance history). Don't build targets/Focus yet — that's
a later session. My answer on Intake hierarchy: [PASTE ANSWER]
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 4.
```

### Session 4 — Training landing + template library · Sonnet

**Answer first:** Training landing lead — Start-first (spec's lean) or Library-first?

```
Read planning/rework/session-playbook.md, planning/rework/tabs/training-tab.md,
planning/rework/master-plan.md, and the latest handoff in dev-log/.
Build the Training landing skeleton and template library v2 per the spec: Start block
(recent-template chips + Blank session), template library, Progress tap-ins. Do NOT
move history to Profile yet (hard gate, Session 7); the Routes shelf waits for Session 9.
My answer on lead order: [PASTE ANSWER]
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 5.
```

### Session 5 — Benchmarks decision-proof passes + Pinned Spots on Home · Sonnet

**Answer first (two leans to confirm or veto):** (a) Benchmarks get NO user-picked type
field — type is derived. (b) Benchmark list layout by-domain with type badges.

```
Read planning/rework/session-playbook.md, planning/rework/benchmarks-templates.md,
planning/pinned-spots-spec.md, planning/rework/tabs/home-tab.md, and the latest handoff
in dev-log/.
Build the benchmarks decision-proof passes (classifier, detail sheet, pluggable list —
the passes that proceed under any ruling) and the Pinned Spots module on Home's glance
tier. My answers on the two leans: [PASTE ANSWERS]
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 6.
```

### Session 6 — The shell swap · **Opus** (`/model claude-opus-4-8`)

**Answer first:** Social placeholder at shell-ship — quiet static panel (lean) or hide
the tab until Feed ships?

```
Start in plan mode. Read planning/rework/session-playbook.md,
planning/rework/master-plan.md (Phase 2), planning/rework/tabs/profile-settings.md,
planning/rework/tabs/social-tab.md (S0 only), and the latest handoff in dev-log/.
Plan then build Phase 2: app/(tabs)/_layout.tsx to 5 tabs (Home · Training · Map ·
Nutrition · Social), Today→Home rename, Social placeholder, avatar (→ Profile stub) +
gear (→ Settings) in the top-right, Map tab with Record pre-start state, sectioned
Settings with the Stimulus Ledger tap-in. Reflect stays alive but off the bar only if
the spec says so — follow the spec's gate exactly. My answer on the Social placeholder:
[PASTE ANSWER]
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 7.
```

### Session 7 — Logbook → Profile + Reflect retirement · **Opus to plan, Sonnet to build**

**Answer first:** (a) Reflect's replacement doors — Home deep-link + Profile entry
(lean)? (b) Stimulus Ledger — parked in Settings, or archived? (c) Completed/archived
benchmark history — list on Profile, tap-through to Reflect's rendering (lean)?

```
Start in plan mode. Read planning/rework/session-playbook.md,
planning/rework/tabs/profile-settings.md, planning/rework/tabs/training-tab.md (the
history hard gate), planning/rework/master-plan.md (Phase 3), and the latest handoff in
dev-log/. Plan then build: Profile screen (identity + logbook + gear + current
benchmarks — renders only what exists, never badges), move Training history to Profile
behind the spec's hard gate (nothing deleted before its replacement ships), then retire
Reflect per the spec. My answers: [PASTE ANSWERS]
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 8.
```

### Session 8 — Background GPS recording · **Opus plan session, then Fable overnight build**

**Answer first:** (a) Should swiping the app away kill an active recording? (research
lean: no — recording survives). (b) OK to show a one-time contextual battery-optimization
prompt when it matters?

Prompt A (Opus, `/model claude-opus-4-8`):
```
Plan mode only — no code. Read planning/rework/session-playbook.md,
planning/rework/tabs/map-tab.md, planning/rework/research/gps-recording-expo.md, and the
latest handoff in dev-log/. Produce a reviewed build plan for Map Record MVP: one-tap
start, expo-location + expo-task-manager on While-Using permission, BestForNavigation,
SQLite crash-safe buffer, store-raw/derive-clean, silent conditions snapshot, save flow.
My answers: [PASTE ANSWERS]. End with a build prompt I can hand to an overnight session.
```
Prompt B (Fable, `/model claude-fable-5`, hands-off): paste the build prompt Session 8A
produces. Fable is the right model here — it has run this repo's overnight builds before.

### Session 9 — Routes entity + shelf + follow · Sonnet · no questions

```
Read planning/rework/session-playbook.md, planning/rework/tabs/map-tab.md,
planning/rework/tabs/training-tab.md (Routes shelf), 
planning/rework/research/routes-implementation.md, and the latest handoff in dev-log/.
Build the Routes entity (migration per the reserved numbering — check
src/db/migrations before picking a number), the browse-only Routes shelf on Training
(creation deep-links to Map), and route-follow on Record. Route builder itself waits
for Explore (Phase 4).
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for Session 10.
```

### Session 10 — The rebrand swap PR (light-only) · Sonnet

**Answer first:** (a) Which color takes the CTA/active-tab job — Body rust `#C15A39`
(the kit's most assertive color), an element contextually, or a neutral? (b) Book ~30
min with Claude for a side-by-side screenshot pass on the new type scale — judgment,
not math.

```
Read planning/rework/session-playbook.md, planning/rework/brand-integration.md (Pass
4–5), planning/design-system/ (ALL token files — this is the design of record), and the
latest handoff in dev-log/.
Execute the swap: install/verify @expo-google-fonts packages for Space Mono, Space
Grotesk, Archivo, DM Sans against the installed SDK (bundle TTFs as fallback); rewrite
fontMap.ts + tokens.fonts (3 registers: display=Space Grotesk, caps=Archivo, body=DM
Sans, numbers=Space Mono); apply the type scale from
planning/design-system/tokens/typography.css; replace all color values from colors.css.
LIGHT-ONLY: flip ThemeProvider initialScheme to 'light' and hide the dark toggle —
dark mode does not ship. Keep lightColors/darkColors typing compilable.
My answer on the CTA color: [PASTE ANSWER]
Then Pass 5 QA: screenshot pass over Home, Training, Nutrition, Settings, one chart,
one map trace; contrast spot-check of element colors; confirm fidelity/tier rules read.
Finish: full jest, tsc last, /code-review, sim-smoke-test skill, then status-sync +
dev-log-closeout skills, and write me a handoff prompt for the Phase 4 planning session.
```

---

*After Session 10 the app is the 5-tab, light-only, rebranded product. Phase 4 (SDK 56 +
MapLibre v11 → Explore + route builder, Templates 3a/3b ruling, benchmark groups, Gear
Quiver) gets its own planning session then.*
