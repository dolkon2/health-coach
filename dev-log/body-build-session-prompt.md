# Body dimension — continuation session prompt

*Paste this to start a fresh session picking up the Body dimension build where an
earlier overnight run (2026-07-05, Fable/ultracode) left off.*

## Mission

Continue the Body-dimension build (Gym, Calisthenics, Yoga, Mobility, Dance,
Breathwork, PT) on `~/Projects/health-coach-body`, branch `dimension/body`, following
`planning/dimension-body-build.md` v1.1 pass by pass. Gym rework is the priority chunk
(Dylan's explicit call) — if only one thing gets done this session, make it Build-B
(P4 gym analytics → P5 Strong/Hevy CSV import → P6 benchmark dimensions).

## Read first, in order

1. `dev-log/body-build-handoff.md` — what's landed, what's next, the one cross-cutting
   merge-time risk (migration-number collision with Sky/Water), and the hard guardrails.
2. `planning/dimension-body-build.md` — the full pass-by-pass spec (P1a through P8),
   already hardened by a 3-lens adversarial critique. This is the contract; follow it
   exactly, don't re-derive decisions it already made.
3. `dev-log/body-build-flags.md` — every judgment call made so far, one line each. Skim
   it so you don't re-litigate a call that's already settled.
4. `planning/dimension-body-session.md` — product/orientation context (the Notion
   "New Training Database" research, per-sport build paths, Dylan's three check-ins).
5. `git log --oneline dimension/body` — confirm what's actually committed matches the
   handoff doc's claims (the handoff doc may be stale if more landed after it was
   written).

## A known failure mode from the last session

Running a pass as a background `Workflow` once stopped silently — no error, no
completion notification, no commit — after finishing only part of its scope. If you
run passes in the background, don't assume "no notification yet" means "still
working": periodically check `git log`/`git status` and the modification time of any
new uncommitted files against wall-clock time. If a file hasn't changed in ~2x the
time your other passes took, treat it as stalled, verify with jest/tsc whether the
partial work is salvageable, and either commit the good part or restart the pass.

## The one thing that must not slip

**Isolation.** This worktree/branch only. Never touch `main`, never touch the Earth
(`~/Projects/health-coach-earth`), Water (`~/Projects/health-coach-water`), or Sky
(`~/Projects/health-coach-sky`) worktrees or branches — those are separate, parallel
sessions. Never push without being asked; never merge to main — that's Dylan's call.

**Honesty spine** (same as the rest of the app): fidelity/capture-tiers are food-only,
never applied to training sessions (training is facts, not estimates). `null ≠ 0` —
never fabricate a duration, a volume, a PR, or a HealthKit sample. Descriptive by
default, prescriptive only on request; no gamification, no celebration animations, no
streaks. Flag a judgment call in `dev-log/body-build-flags.md` rather than silently
deciding it looks safer a different way.

## What to actually do

1. Check `git status` and `git log` first — confirm the tree is clean and see exactly
   which pass is next (cross-reference against `dev-log/body-build-handoff.md`). As of
   this writing: P3 is only 1/5 done (the picker query layer, `7fa11f0`) — finish P3
   before moving to Build-B.
2. Resume at the next incomplete pass in `planning/dimension-body-build.md`'s order
   (P3 → P4 → P5 → P6 → P7a → P7b → P8), one pass at a time: implement, extend tests,
   `npx jest` full-suite green, `npx tsc --noEmit` clean LAST, single-concern commit(s)
   with trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
3. Any judgment call the spec doesn't already resolve: make the honest, non-fabricating
   call, append one line to `dev-log/body-build-flags.md`, keep moving. Don't stall on
   an underdetermined product call — flag it and continue, the way the constitution
   already asks elsewhere in this codebase.
4. After Build-B and Build-C are both done: run (or delegate to sub-agents) an
   adversarial multi-lens critique of the whole Body diff — constitution compliance,
   codebase-fit, scope/data-integrity are the three lenses that already caught real
   bugs in the spec itself, they'll catch real bugs in the code too. Fix everything
   that survives verification.
5. Full verify (jest + tsc) one more time at the very end, write a closing dev-log
   entry (mirror `dev-log/dimension-sky-pass-1.md`'s format: what landed, curated ⚑
   flags, what's genuinely still open), and push `dimension/body` to origin — but only
   after Dylan has actually asked for the push, and never merge to main yourself.

## Definition of done

- Every pass in `planning/dimension-body-build.md` (P1a–P8) is committed, or explicitly
  present in the spec's own "Deferred this round" ledger with a one-line reason.
- Full jest suite green, `tsc --noEmit` clean, on `dimension/body`'s tip.
- `dev-log/body-build-flags.md` has a line for every judgment call made across every
  pass, including ones made in this continuation session.
- An adversarial review pass has run against the finished build and every real finding
  is fixed (not just noted).
- A closing dev-log entry exists summarizing the whole Body build for Dylan's review.
- Nothing outside `~/Projects/health-coach-body` on `dimension/body` was touched.
