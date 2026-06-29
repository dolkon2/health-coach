# LLM food parser — handoff, 2026-06-29

Branch `llm-food-parser` (off `main`, local-only, **not pushed**). Wires
Claude Haiku into the food logger's Describe mode so free-text like "two
slices of pizza with mushrooms" or "had dinner with friends a few drinks a
burger some fries" becomes a *list* of `{food, quantity, unit}` candidates,
each resolved against USDA — instead of the old regex parser that only ever
produced one food.

**This session got it built and wired, but it is NOT working on-device yet.**
The LLM call is silently failing and the logger is falling back to the regex
parser. Diagnosing that silent failure is the next session's first job.

## The bug (observed on sim, 2026-06-29)

Typed a multi-item / vague phrase in Describe mode. Expected several rows
(e.g. stew + whatever else). Got **one** item: `STEW IN A FEW · 100 g`,
129 cal. Two tells:

1. **`· 100 g`** is `DEFAULT_PORTION_G` — the "no resolvable mass" fallback.
2. **"stew in a few"** is the *whole typed phrase* shoved into one USDA
   search (filler words like "in a few" not stripped).

Both mean `extractFoodItems()` returned `[]`, so `addDescribed` fell back to
`parseDescribed(text)` (regex) which treats the entire phrase as one food.
The LLM path never produced items. The feature degraded exactly as designed
— it just degraded *every* time, because the LLM call isn't succeeding.

## Why it's invisible — the #1 thing to fix first

`src/lib/anthropicClient.ts` `callClaude()` swallows **every** failure and
returns `null` (by design — so the logger keeps working offline/keyless).
That's correct for production but means the actual cause (HTTP 400? no
credit? bad request shape? network?) is completely hidden.

**First move: temporarily un-silence it.** In `callClaude`, before each
`return null`, log the reason. E.g.:

```ts
if (!res.ok) {
  const body = await res.text();
  console.warn('[callClaude] HTTP', res.status, body);   // TEMP
  return null;
}
```

…and in the outer `catch (e)` add `console.warn('[callClaude] threw', e)`.
Then watch the **Metro/Expo terminal** (not the sim) while logging a meal.
The status + body will name the cause immediately. **Remove the logging
before committing the fix** — silent fallback is the intended prod behavior.

## Most-likely causes, in order

1. **No billing credit on the API account.** A valid key with $0 balance
   returns `400 invalid_request_error` (credit/billing). Check
   <https://console.anthropic.com/settings/billing> — there must be a
   payment method AND loaded credit ($5 min). Claude Pro (claude.ai) credit
   does NOT count — console.anthropic.com is a separate balance.
2. **Key not in the running bundle.** `expo-constants` reads `app.json` at
   bundle time. If Expo wasn't restarted with `-c` after the key was pasted,
   `ANTHROPIC_API_KEY` is still `null` → `callClaude` returns `null` on the
   first guard. Fix: full restart `npx expo start -c --port 8084`. (Confirm
   the key is actually loaded: temporarily log
   `Constants.expoConfig?.extra?.anthropicApiKey?.slice(0, 8)` somewhere — it
   should print `sk-ant-a`, not `undefined`.)
3. **Request shape rejected.** Verify the `output_config.format` /
   `json_schema` body against the current API via the bundled `claude-api`
   skill (run `/claude-api` or read it). Haiku 4.5 DOES support structured
   outputs, so this is lower-probability than 1–2, but the un-silenced log
   will say so directly (a 400 with a schema/validation message).
4. **`anthropic-dangerous-direct-browser-access`** — only relevant if RN's
   fetch is sending an `Origin` header that trips Anthropic's browser block.
   Native RN normally doesn't. If the 400 body mentions browser access, add
   that header. Unlikely; rule out via the log.

## What shipped (4 commits — all green: jest 165/165, tsc 0)

```
879c7e8  feat(food): route describe-mode through the LLM extractor      (Phase B)
bd69e6b  feat(food): LLM food-item extractor (claude-haiku-4-5)         (Phase A.3)
fc43b63  feat(llm): shared Anthropic client + ANTHROPIC_API_KEY plumbing (Phase A.2)
6b6f407  docs(food-logging): allow LLM input parsing, food data free     (Phase A.1)
```

- `src/lib/anthropicClient.ts` — `callClaude({model, system, user, schema})`,
  fetch-based (not the npm SDK — avoids RN Node shims), 4s timeout, structured
  outputs via `output_config.format`, returns `null` on any failure.
  Injectable `apiKey`/`fetchImpl` for tests.
- `src/lib/foodNLP.ts` — `extractFoodItems(text, opts?)` → `ParsedDescribed[]`
  using `claude-haiku-4-5`. Reuses `MASS_UNITS` from `foodLog.ts`. Honesty in
  schema (`quantity: number|null`) + prompt ("NEVER guess; 'a few' → null").
  Returns `[]` on any failure.
- `src/lib/__tests__/foodNLP.test.ts` — 12 tests, mocked fetch (happy path,
  null preservation, mass vs non-mass units, multi-item, every failure mode).
  **These pass and prove the mapping logic is correct** — the bug is in the
  live call, not the pure logic.
- `src/lib/foodLog.ts` — `MASS_UNITS` now exported (single source of truth).
- `src/lib/config.ts` — `ANTHROPIC_API_KEY` from `app.json extra`.
- `src/hooks/useFoodLog.ts` `addDescribed` — calls `extractFoodItems` first,
  `[]` → `parseDescribed` fallback; resolves each candidate independently;
  per-item USDA misses skipped (partial meal is valid); error only if NOTHING
  resolved.
- `planning/food-logging-spec.md` — amended: LLM input parsing permitted,
  food *data* layer stays USDA+OFF free-only.

## State / hygiene — read before touching git

- **Worktree `~/Projects/health-coach` is on `llm-food-parser`.** Keep it
  there. Do NOT `git checkout` another branch in this worktree mid-work — it
  drifted to `main` once this session and hid the committed changes (the
  per-worktree branch is what VS Code shows on disk).
- **Two uncommitted changes that must NOT be committed / clobbered:**
  - `app.json` — holds Dylan's **real Anthropic key** (local only). NEVER
    `git add app.json`. NEVER print the key value. The committed version has
    `anthropicApiKey: null`; that's intentional.
  - `src/components/Screen.tsx` — Dylan's pre-existing headspace fix (removed
    `insets.top` from `paddingTop`), unrelated to this work. Leave it.
  - Stage specific files only (`git add src/lib/foo.ts`), never `git add .`.
- `package-lock.json` shows a benign `devOptional`↔`dev` metadata flutter on
  branch switches — discard it (`git checkout -- package-lock.json`), it's
  not anyone's work.
- Run order (discipline): plan → write code → write/adjust tests → **tsc
  LAST**. Single-concern commits, `Co-Authored-By: Claude Opus 4.7
  <noreply@anthropic.com>`. HARD review checkpoint before any new UX.
- Toolchain: Expo SDK 53, TS 5.8.3, jest-expo 53. Sim on **port 8084**
  (8082 = training worktree, 8083 = logger-redesign). No parallel CC sessions
  on one folder.

## Honesty (binds — same as the rest of food logging)

- `null ≠ 0`: a quantity the model can't see stays `null`/`undefined`, never
  invented. "A few drinks" → no quantity → LOW fidelity, NOT `quantity: 3`.
- Fidelity is a visual tier, never a number. LLM items inherit the existing
  `described` ceiling — no new tier.
- Regex fallback MUST remain so the logger works offline/keyless.
- No targets/nags/streaks.

## Definition of done for the next session

1. Un-silence `callClaude`, find the real failure, fix the root cause
   (probably billing credit and/or a missing `-c` restart), **re-silence**.
2. On sim: "two slices of pizza with mushrooms" → 2 rows; "had dinner with
   friends a few drinks a burger some fries" → ~3 rows with drinks/fries at
   LOW fidelity (no fabricated quantity); "8 oz ribeye" → ~227 g.
3. Confirm the regex fallback still works with the key removed (set
   `anthropicApiKey` back to `null`, restart, log a single food).
4. jest + tsc green. Commit the fix (NOT app.json). Decide with Dylan whether
   Phase C (loading affordance / confirm-before-add) is wanted or the branch
   merges as-is.

## Optional Phase C (deferred unless Dylan asks)

- A clearer "thinking…" state during the ~1–2s LLM call (the `busy` flag
  already exists; the button just dims).
- Show extracted candidates *before* USDA resolution so a mis-parse can be
  corrected. Real UX work — likely belongs in the separate logger-redesign
  sprint (`dev-log/logger-redesign-handoff.md`), not here.
