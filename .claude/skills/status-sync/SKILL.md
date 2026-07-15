---
name: status-sync
description: Sync the Notion "Active Work" hub and Obsidian vault status docs with the real state of the repo after a build closes out. Use after a dev-log close-out, or whenever repo state (branch/commit/merge status) has drifted from what's recorded externally.
---

# Status sync

Keeps external trackers honest against actual git state, so a future session (or Dylan checking Notion on his phone) doesn't get misled by a stale row.

## Steps

1. **Get ground truth first.** Run `git log --oneline -5`, `git status`, and `git branch -vv` in the relevant worktree. Do not trust a memory file or an old Notion row over what git actually shows.
2. **Update the Notion "Active Work" hub** (one row per dimension — Status / Branch / Worktree / Last commit). Use the Notion MCP tools to query the database, find the row for the dimension that changed, and update only the fields that are now stale. Don't rewrite rows that are already correct.
3. **Update the Obsidian vault** if a phase boundary was crossed: `Projects/Health Coach/Status.md` and `Roadmap.md` in `~/Downloads/ObsidianVault/` (per [[project_obsidian_vault]]). Skip this for routine commits — it's for phase/milestone boundaries only.
4. **Do not overwrite open decisions.** If a row has an open question or a flag Dylan hasn't resolved, leave it — status-sync updates facts (branch, commit, test count), not decisions.
5. **Report a one-line diff** of what changed in Notion/Obsidian vs. what it said before, so it's auditable.

## When to run this

- Right after a dev-log-closeout, as the last step
- When you notice (or Dylan flags) that the hub disagrees with git reality
- At a phase/milestone boundary, for the vault docs specifically

Do not run this mid-build on every commit — it's a checkpoint action, not a per-commit one.
