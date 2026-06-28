# Ring 2 — pass-by-pass run prompt

*A reusable prompt for driving the Ring 2 (food logging) build, pass by pass,
self-verified against the approved plan. Paste it into a fresh Claude Code session
opened in this repo. `planning/ring2-food-logging-plan.md` is the authority it
follows; this file is just the launcher.*

---

## The prompt

```
Work through Ring 2 (food logging) pass-by-pass against the approved plan, fully verifying and committing each pass before the next. Repo: ~/Projects/health-coach.

AUTHORITY (re-read at the start of every pass):
• planning/ring2-food-logging-plan.md — the single source of truth: scope, files, "done looks like", and the Proof tests for each pass. Follow it exactly.
• planning/food-logging-spec.md — the data contract + invariants.
• planning/claude-md.md + CLAUDE.md — the constitution. Non-negotiable.

DO, IN ORDER, one pass per iteration: 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6.
DO NOT build: 2.8 photo (schema-reserved, no surface) or earned-fidelity computation (Phase 7). Pass 2.7 barcode needs a native scanner dependency — STOP and ask me before starting it.

FOR EACH PASS:
1. Find the lowest-numbered pass not yet committed (check `git log --oneline -15` and dev-log/). Read that pass's full section in the plan, plus the existing code it names.
2. Implement ONLY that pass's declared scope. Match existing style/conventions (ESM imports with .js suffixes, @core/* alias, brand kit for any UI).
3. Write exactly the tests the plan lists under "Proof" for that pass.
4. VERIFY in this order: `npm test` until green, THEN `npx tsc --noEmit` clean. tsc runs LAST, after the tests exist — never before.
5. SELF-CHECK against the plan before committing — confirm every "done looks like" bullet AND every locked invariant that applies:
   – full macros ALWAYS written when known, regardless of focus (focus is display-only; no `focus` field on the log)
   – missing macros = `null`, never `0`, never inferred; partiality is structural via `isPartial()`
   – MealLog = enriched FoodEntryPayload (Observation kind), NOT a sibling table; MealTemplate is its own table storing definition only (no earned_fidelity, no stored occurrences)
   – fidelity is 0..1, shown as three visual tiers, NEVER a number on screen
   – earned_fidelity is engine-derived, never written by the logging layer
   – data layer is USDA + Open Food Facts, free only — no paid APIs
   – only the plan's flagged Ring 1 core edits are allowed; don't touch core/ beyond what the plan names
6. COMMIT single-concern, conventional message, ending with:
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
7. Write dev-log/ring2-pass-<N>.md (what shipped, test counts, anything deferred); log any correctness/honesty quirk to dev-log/quirks.md.

STOP AND ASK ME — do not guess — if: a decision isn't settled in the plan/spec; a test can't pass honestly; a pass needs a native capability, dependency, or API key you can't add; or you'd need to touch Ring 1 core beyond the flagged edits. Never fake a green test, never stub-and-claim-done, never invent a number.

REVIEW GATE — after each pass commits, STOP, summarize what shipped + test results, and wait for me to say "next" before the following pass. ← delete THIS line for hands-off run-through.

FINISH when 2.1–2.6 are committed and green. Print a final table: pass · commit hash · test count · anything left for me.
```

---

## How to run it (two modes)

- **Controlled (recommended).** Paste the block as-is (no `/loop`), keep the
  REVIEW GATE line. It does one pass, then stops; glance at the diff and reply
  `next`. You are the loop — full control, fresh judgment each pass. Best for the
  two heavy passes (2.5 UI, 2.6 engine).
- **Hands-off.** Type `/loop ` then paste the block, and **delete the REVIEW GATE
  line**. It self-paces through 2.1 → 2.6, verifying and committing each, stopping
  only on a blocker or when done.

## Notes

- `planning/ring2-food-logging-plan.md` is the authority; this prompt only points
  Claude at it. Run `/pass-status` any time for a read-only audit of the active
  pass against that plan.
- **2.7 barcode** will pause for input (needs an RN scanner library + a device to
  test). **2.8 photo** builds nothing (schema-reserved). **Earned-fidelity
  computation** is Phase 7. So "everything" here = the 6 core passes, 2.1–2.6.
- One long session accumulates context across six heavy passes; for best quality,
  consider still running 2.5 and 2.6 as their own fresh sessions even in hands-off
  mode.
