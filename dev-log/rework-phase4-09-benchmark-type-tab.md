# Phase 4 · P4-7 — Benchmarks type-decision application (B5)

*2026-07-14. Branch: `main` (local, not pushed — 4 commits ahead of `origin/main`,
all four this pass).*

## What was built

R3 + R4 (`phase4-session-playbook.md`) resolved the Benchmarks type question on
2026-07-14: type stays fully derived (no schema, no dropdown, no type-first
creation flow), and the list layout is a tab alongside by-domain, not a
straight 2a/2b swap ("both, via a tab" — Dylan's words).

Reading `app/benchmarks.tsx` before touching it turned up that most of B5 was
**already shipped as part of B3** (commit `32149b9`, rework Session 5):
per-face Compliance/Outcome/Trend badges (`benchmarkClassify.ts` /
`BENCHMARK_FACE_LABEL`) were already rendering on every `BenchmarkRow` card.
So this pass's actual scope narrowed to just the by-type tab:

- Added `src/lib/benchmarkType.ts` — `groupBenchmarksByType()`, a pure,
  unit-tested function bucketing benchmarks by which face(s) they carry:
  **Behavior** (behavior face only), **Outcome** (outcome face only), or
  **Both** (dual-face, grouped whole — same never-split rule
  `benchmarkDomain.ts` uses for 2a). Deliberately does NOT use
  `benchmarkClassify.ts`'s finer Compliance/Outcome/Trend split for the
  *grouping key* — that stays the card badge, unchanged.
- Wired a `SegmentedControl` ("By domain" / "By type") into
  `app/benchmarks.tsx`, swapping which grouping function computes
  `groupedActive` — exactly the "pluggable group-by wrapper" B3's own comment
  anticipated. Archived stays a flat, ungrouped section in either mode
  (unchanged).

## Decision read, not asked

R4's "Behavior/Outcome/Both" wording (repeated verbatim in both the playbook
flag and this session's kickoff prompt) is a *different* three-way split than
`benchmarks-templates.md §10.2`'s original 2b definition (Compliance/Outcome/
Trend, the classifier's per-face labels). I read the two independent,
consistent mentions of "Behavior/Outcome/Both" as the intended grouping —
face-presence, not the classifier's target-vs-direction distinction — and
built that, rather than stopping to ask, since both source documents agreed
and the two-tab *shape* itself was unambiguous (matches B3's own anticipated
wrapper-swap comment and the SegmentedControl pattern already used identically
on Training and Nutrition). Flagging here in case that reading is wrong.

## Verification

- **jest:** 131 suites / **1356 tests** pass (+7 new:
  `benchmarkType.test.ts` — Behavior/Outcome/Both bucketing, dual-face
  whole-record grouping, order, empty-section dropping, empty input).
- **tsc --noEmit:** 0 errors.
- **`/code-review` (high effort, 8 finder angles + 1-vote verify):** 8
  candidates surfaced, 4 confirmed. Two fixed in this pass (both contained to
  code written this session, not scope creep):
  - The new tab rendered unconditionally, even with zero active benchmarks —
    tapping it produced no visible effect, reading as broken. Fixed: gated on
    `active.length > 0`, the same condition the tab's own effect depends on.
  - `groupBenchmarksByType`'s Map+filter machinery (copied from
    `benchmarkDomain.ts`, justified there by an open-ended key space) was
    overkill for this file's closed 3-key enum. Simplified to a plain keyed
    `Record`, dropping the possibly-undefined lookup and the type-guard
    filter. Behavior unchanged, re-verified green.
  - Two more confirmed but **not fixed**, see flags below (both are judgment
    calls, not bugs — left for the reasoning to be visible rather than
    silently decided).
- **Sim (iPhone 17 simulator, real device DB, no mocks, computer-use
  tap-through):** the same tooling gap noted in the P4-3/P4-6 dev-logs
  (headless-only, no direct tap) turned out to be resolved this session —
  `request_access(["com.apple.iphonesimulator"])` grants a real screen-tap
  path via computer-use, not just deep-links + SQL seeding. Used both:
  deep-linked to Benchmarks, confirmed By-domain renders the one real active
  benchmark ("Kayak 2x a week, get to 78", dual-face, Water domain,
  Compliance·Outcome badges), then **tapped "By type" live** on the actual
  simulator window and confirmed the same benchmark moved to a "Both"
  section. Then SQL-paused the only active benchmark to test the empty-state
  guard fix — confirmed the tab disappears entirely with zero active
  benchmarks — and restored it, reloading to confirm the sim matched its
  original screenshot exactly (same active/archived rows, nothing created or
  lost). No red-screen or console error across any of it.

## ⚑ Flags

- **⚑1 — Reuse gap not closed: this was the predicted trigger point.**
  `dev-log/rework-phase4-08-templates-grouping.md`'s ⚑2 explicitly named "once
  B3 lands and the shape of a third real consumer is known" as the moment to
  extract a shared `groupBy`/`GroupedList` helper — the "headed group,
  absent-if-empty" pattern now independently exists in `benchmarkDomain.ts`,
  `benchmarkType.ts` (this pass), `templateGrouping.ts`, and `spots.tsx`'s
  inline grouping. This pass is that third/fourth consumer and did not do the
  extraction — B5 was scoped S–M, single-concern, "flag don't reinterpret,"
  and a 4-file generalization is a different, larger pass. Re-flagging with
  the trigger condition now definitively met: worth a dedicated small pass
  before a fifth consumer shows up and the divergence gets harder to reconcile.
- **⚑2 — `listView` (By domain / By type) persists across navigation,
  undocumented.** Unlike `nutrition.tsx`'s sibling `SegmentedControl`, which
  has an explicit, commented reset-on-re-entry policy for its own tab state,
  `benchmarks.tsx`'s new `listView` state has no reset logic and no comment
  addressing whether it should have one. Not fixed — this is arguably the
  *better* default (grouping preference reads as a lasting choice, not a
  primary/secondary landing split like Nutrition's Intake/Trend), but it
  wasn't a deliberate call, just what `useFocusEffect` happens to do. Cheap to
  add a reset later if it turns out wrong.
- **⚑3 — the R4 vocabulary read** (see "Decision read, not asked" above) —
  confirm "Behavior/Outcome/Both" (face-presence) was the intended grouping,
  not the classifier's Compliance/Outcome/Trend split.

## Not done / deferred

- ⚑1's extraction (shared groupBy helper) — separate pass.
- ⚑2 (listView reset policy) — needs a product call, not a guess.
- Push/merge — not requested this session; `main` is 4 commits ahead of
  `origin/main` (this pass only; T6 was already included in the prior
  close-out's ahead-count and has since been folded in).

## Safe to leave as-is?

Yes. Branch is green (jest/tsc clean), sim was left in its original state
(same active + archived benchmarks, screenshot-verified identical), and the
two open flags are documented judgment calls, not regressions.
