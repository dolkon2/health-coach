# Phase 4 · P4-6 — Templates library grouping-wrapper swap (T6)

*2026-07-14. Branch: `main` (local, not pushed — 3 commits ahead of `origin/main`,
one of them this pass).*

## What was built

R1 + R2 (`phase4-session-playbook.md`) resolved the Templates library's open
layout question on 2026-07-14: "Section" collapsed to a Routes-only concept
(no build here), and the library splits into three groups instead of one flat
list — **One-offs → Active → Deactivated**, confirmed with Dylan live at the
start of this session (see the two questions asked and answered below).

- Added `groupTemplatesForLibrary()` (`src/lib/templateGrouping.ts`) — a pure,
  unit-tested function that partitions a template array with no schema change:
  - `dayAssignment == null` → **One-offs**. Dylan's own framing: "a gym
    routine you like to hit... neither active or deactive because u dont
    program like that" — a template never slotted onto a day.
  - `dayAssignment` set, `isActive: true` → **Active**.
  - `dayAssignment` set, `isActive: false` → **Deactivated**.
- Wired into `app/(tabs)/training.tsx`: the old single `filteredTemplates.map(...)`
  render became three `<TemplateGroup>` blocks (one per bucket), each
  absent-not-empty (renders nothing when its slice is empty — so a library
  with only one-offs never shows a bare "Active" header).
- Per the T6 instruction, this is a **grouping-wrapper swap only**: the data
  layer (`listTemplates`), `TemplateCard`, search, and the empty/error states
  are untouched.

## Decisions confirmed with Dylan this session (before building)

Two open calls from the playbook (R2's "confirm exact order/definition at
build time") were resolved live via AskUserQuestion rather than guessed:

1. **What counts as a "one-off"?** No explicit field exists in the data model
   for it. Confirmed: a template with no day assignment — matches Dylan's "a
   gym routine you like to hit... neither active or deactive" framing exactly.
   Zero schema change.
2. **List order?** One-offs → Active → Deactivated (the playbook's leaning
   order), not the alternative (one-offs in the middle).

## Verification

- **jest:** 130 suites / **1349 tests** pass (+4 new: `templateGrouping.test.ts`
  — one-off bucketing regardless of `isActive`, active/deactivated split,
  order preservation within each group, empty input).
- **tsc --noEmit:** 0 errors.
- **`/code-review` (high effort, 8 finder angles + verify pass):** 3 findings
  survived verification, all CONFIRMED, none fixed (see flags below — two are
  pre-existing cross-file behavior explicitly out of scope for a
  cards-unchanged pass, one is a reuse/DRY observation for a future pass).
- **Sim (iPhone 17 simulator, real device DB, no mocks):** app was already
  dev-client-built on this sim from an earlier session; reconnected to the
  live Metro instance already running on this machine (`192.168.1.204:8081`,
  a leftover `expo run:ios --device` process from 2026-07-13 — did not
  restart it, just pointed the sim at it via `healthcoach://expo-development-client/?url=...`
  deep link) and deep-linked straight to Training
  (`healthcoach://training`). Screenshotted the baseline (one real template,
  "Bench Day," correctly alone under "Active"), then seeded a one-off and a
  deactivated template directly via `sqlite3` on the live app DB
  (`.../Documents/SQLite/healthcoach.db`), relaunched, and screenshotted
  again: all three headers rendered in the confirmed order with the right
  template under each. Deleted the two seed rows, relaunched, and confirmed
  the sim is back to the exact original baseline screenshot. Sim left clean.
- Computer-use / tap-through was not attempted (same tooling gap noted in the
  P4-3 benchmark-groups dev-log — untested this session whether it's
  resolved); verification was fully headless via `simctl` deep-links +
  screenshots + direct SQL seeding, same pattern as that pass.

## ⚑ Flags

- **⚑1 — One-off templates can still show a "paused" badge.**
  `TemplateCard.tsx:70` renders "paused" whenever `!template.isActive`, with
  no check on `dayAssignment`. `edit-template.tsx`'s "Active" toggle is
  reachable and unconditional (not gated on a day being assigned), so a user
  can create a one-off with `isActive: false` and see a "paused" badge under
  the "One-offs" header — undercutting this pass's own framing that
  active/deactivated is meaningless for one-offs. Confirmed reachable and
  visible by `/code-review`'s verify pass. **Not fixed here** — T6's scope is
  explicitly "cards... don't change, only the grouping wrapper." Two ways to
  close it later: gate the Active toggle's visibility on a day being
  assigned in `edit-template.tsx`, or have `TemplateCard` suppress the
  "paused" badge when `dayAssignment` is null.
- **⚑2 — Reuse gap: the "headed group, absent-if-empty" pattern now exists
  three times independently** (`TemplateGroup` here, `app/benchmarks.tsx`
  ~141-155, `app/spots.tsx` ~125-135), and the underlying "classify into
  named buckets, preserve order" logic in `groupTemplatesForLibrary` overlaps
  with `groupBenchmarksByDomain` (`src/lib/benchmarkDomain.ts`) and the
  inline `groups` useMemo in `app/spots.tsx`. The playbook explicitly frames
  T6 and the upcoming Benchmarks B3 pass (by-domain/by-type tabs, P4-7) as
  "the same trick" — worth extracting a shared `GroupedList` component +
  `groupBy` helper once B3 lands and the shape of a third real consumer is
  known, rather than guessing the right generalization now from two
  data points.

## Not done / deferred

- P4-7 (Benchmarks B5 type-decision application) — separate pass.
- The two flags above.
- Push/merge — not requested this session; `main` is 3 commits ahead of
  `origin/main` (this pass + two prior).

## Safe to leave as-is?

Yes. Branch is green (jest/tsc clean), sim was left in its original clean
seeded state, and the two flags are documented UX/reuse observations, not
regressions this pass introduced.
