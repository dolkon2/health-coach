---
name: flag-resolution
description: Run a batch decision session over accumulated ⚑ flags from one or more dev-log entries — surface each judgment call, give a plain-language recommendation, and record Dylan's calls back into the dev-log and memory. Use when flags have piled up across one or more finished passes and need resolving before the next build.
---

# Flag resolution session

Flags exist so builds don't stop for every judgment call. This skill is the batch checkpoint where those calls actually get made — by Dylan, not by Claude guessing. Per [[feedback-plain-language-decisions]]: don't ask Dylan to pick between technical patterns; only escalate real product/scope calls, and explain plainly.

## Steps

1. **Collect every open flag.** Grep `dev-log/*.md` for ⚑ markers not yet marked resolved. Group by dimension/feature.
2. **For each flag, prepare in plain language:**
   - What the situation is (no jargon, no code)
   - What Claude chose by default and why
   - The realistic alternative(s), if any
   - Whether this is truly a product/scope call or something that could just be decided and explained (if the latter, decide it here instead of asking — don't pad the list)
3. **Walk through them one at a time** with Dylan, shortest/clearest first. Don't dump all flags in one wall of text — a short list he can answer in sequence beats a document.
4. **Record every resolution immediately:**
   - Mark the flag resolved in its dev-log entry with the decision and date
   - If the decision changes future default behavior (a standing rule, not a one-off), save it as a feedback memory
   - If it's a one-off product call with no lasting rule, a project memory update is enough
5. **Do not silently apply a resolution to similar-but-different flags** — each one gets its own answer, even if they look alike.

## Output

- Count of flags resolved this session vs. still open
- Which resolutions became standing rules (feedback memory) vs. one-off calls
- Anything that needs code changes as a result (list them; don't build in the same session unless asked)
