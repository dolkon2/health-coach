---
name: dev-log-closeout
description: Close out a finished build pass — write the dev-log entry, resolve or list ⚑ flags, confirm tests/tsc are clean, and update memory/status docs. Use when a pass, ring, or dimension build just finished and hasn't been written up yet.
---

# Dev-log close-out

Run this at the end of any build pass (a ring, phase, or dimension branch) before moving on to the next thing. The goal: nothing "done" in a session gets lost because it was never written down.

## Steps

1. **Confirm the pass is actually done.** Run `git log --oneline -15` and `git status`. If tests haven't been run recently, run `npm test`, then `npx tsc --noEmit` LAST (see [[feedback-verify-order]] — tsc runs after tests, not before).
2. **Find or create the dev-log entry.** Look in `dev-log/` for an in-progress file matching this pass; if none exists, create one named for the pass (e.g. `dev-log/<feature>-build-final.md`). Write:
   - What was built, in plain language (no code dumps)
   - Every ⚑ flag raised during the build — a judgment call made without stopping to ask, with the reasoning and the alternative not taken
   - Test count and tsc status
   - What's explicitly NOT done / deferred, and why
3. **Do not resolve flags yourself.** List them clearly enough that a short decision session (see the flag-resolution skill) can burn through them fast. Don't guess at product intent.
4. **Update commit history cleanly.** If work is uncommitted, stage and commit with a single-concern message per [[feedback-commit-and-review-discipline]] — don't bundle the close-out writeup with unrelated code changes.
5. **Flag whether push/merge is next**, but don't push or merge without being asked — that's a shared-state action.
6. **Prompt for memory + Notion sync** (do not do these automatically): ask whether the Notion "Active Work" hub row for this dimension should be updated, and note in your final message which memory file (if any) is now stale and should be refreshed.

## Output

End with a short status block:
- Pass name + branch/worktree
- Test count / tsc status
- ⚑ flags (count + one-line each)
- Deferred items
- One line: is this safe to leave as-is, or does something need attention before the next session picks it up
