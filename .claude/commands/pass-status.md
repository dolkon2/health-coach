---
description: Check the current build pass against its game-plan acceptance criteria
---

You are doing a status check on the current Phase-1 build pass for this project.

Steps:
1. Read `planning/game-plan-and-prompts.md` to recall the 5-pass sequence and
   each pass's deliverables and "what to look for" criteria.
2. Read the latest file in `dev-log/` to see what the last completed pass shipped
   and what was flagged as deferred/quirky.
3. Determine which pass is currently in progress (check `git log --oneline -5`
   for the most recent "Pass N (WIP)" or completed commit).
4. For that pass, go through its acceptance criteria ONE BY ONE against the actual
   code on disk. For each criterion, mark ✅ done / 🔶 partial / ❌ not started,
   and cite the file that proves it (or its absence).
5. Honor the constitution: do NOT report something as done that only renders a
   placeholder or fakes a number. A pass is only "done" when its end-to-end
   acceptance test can actually be run.

Output:
- A short table: criterion | status | evidence (file:line).
- The single most important thing left to do.
- Any quirks/risks worth noting before the next pass (timezone, web vs native,
  refetch-on-focus, units — check the running quirks list in the dev-log).
- A one-line verdict: is this pass safe to commit and move on from?

Keep it tight. This is a checkpoint, not an essay. $ARGUMENTS
