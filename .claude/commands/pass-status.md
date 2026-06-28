---
description: Audit the current build pass against its plan's acceptance criteria (ring-aware)
---

You are doing a status check on the current build pass for this project. The
project builds in concentric "rings" / phases / passes — work out which pass is
active, then audit it against the plan doc that owns it.

Steps:
1. Read `planning/game-plan-and-prompts.md` — the Ring ↔ Phase ↔ Pass legend (the
   Rosetta stone). Use it to identify the active ring/phase and WHICH plan doc is
   authoritative for it. Per-ring plan homes:
   - Ring 1 (Phase 1) → `planning/phase-1-build-spec.md`
   - Ring 1 (Phase 4) → `planning/phase-4-training-plan.md`
   - Ring 2 (Phase 2, food logging) → `planning/ring2-food-logging-plan.md`  ← single authority for Ring 2
   - otherwise, the doc named in the legend's "planning-doc home" note.
2. Determine which pass is in progress: check `git log --oneline -15` and the
   latest `dev-log/` entry for the most recent completed/WIP pass. The active pass
   is the lowest-numbered one in the plan not yet committed + green.
3. Open that pass's section in its plan doc and pull its acceptance criteria:
   every "done looks like" bullet AND every test listed under "Proof".
4. Go through those criteria ONE BY ONE against the actual code on disk. For each,
   mark ✅ done / 🔶 partial / ❌ not started, and cite the file (file:line) that
   proves it or its absence. Confirm the Proof tests EXIST and run green
   (`npm test`); note whether `npx tsc --noEmit` is clean (tsc is the last gate,
   run after the tests are written).
5. For Ring 2 specifically, also verify the locked invariants the plan calls out,
   to the extent the active pass touches them:
   - full macros always written regardless of focus (focus is display-only; no `focus` field on the log)
   - missing macros are `null`, never `0`, never inferred (partiality is structural via `isPartial()`)
   - MealLog = enriched FoodEntryPayload (Observation kind), NOT a sibling table; MealTemplate stores definition only (no earned_fidelity, no stored occurrences)
   - fidelity shown as three visual tiers, never a number on screen
   - earned_fidelity is engine-derived, never written by the logging layer
   - only the plan's flagged Ring 1 core edits were made
6. Honor the constitution: do NOT report something as done that only renders a
   placeholder, stubs a function, or fakes a number. A pass is only "done" when
   its Proof tests can actually run green.

Output:
- A header line: active ring / phase / pass + the plan doc it was audited against.
- A short table: criterion | status | evidence (file:line).
- The single most important thing left to do.
- Any quirks/risks worth noting before the next pass (timezone, web vs native,
  refetch-on-focus, units — check the running quirks list in `dev-log/quirks.md`).
- A one-line verdict: is this pass safe to commit and move on from?

Keep it tight. This is a checkpoint, not an essay. $ARGUMENTS
