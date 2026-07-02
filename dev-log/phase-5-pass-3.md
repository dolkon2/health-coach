# Phase 5 · Pass 3 — Today status cards

*2026-07-01 · commits `6acf256` (cards) + `c3ff7f5` (pin control) on branch
`benchmarks`, straight after Pass 2.5 — the collapse made this pass simpler:
what would have been two unrelated card types (cadence vs trend) became two
optional LINES of one card.*

## What shipped

**Pinned active benchmarks surface on Today**, between the date header and the
weigh-in card. One card per benchmark:

- **Behavior line** — `2/4 this week`. A factual count for the current window,
  rendered in the data face. Count, never streak: no run-length shown, no
  celebration, no color shift as it approaches target; when the window rolls it
  just starts again (spec, "Consistency counters").
- **Outcome line** — `82.4 kg · ↓ 0.6 kg over 14 days · 7.4 kg above target`.
  Latest smoothed trend + recent movement (weigh-in card's delta grammar) +
  signed distance to the threshold when one is set. The mirror reports the
  ACTUAL direction even when it opposes the wish — up while aiming down renders
  exactly as plainly. "Above/below target" states a relation, never a grade.
- Dual-face cards stack behavior over outcome — you control the first, you
  watch the second. Honest empties: `0/4 this week` is shown, not hidden;
  no weigh-in history → `no weight data yet`.

**The section only exists when something is pinned.** No empty state, no
"set a goal!" CTA — Today never asks (pull, not push). Tap → `/benchmarks`.

**Pin control** (`c3ff7f5`): `Pin to Today / Unpin from Today` ghost toggle in
edit mode (in-place flip, unlike Archive's exit), plus a muted `not on Today`
tag on unpinned active rows in the list. `pinned` existed in the model since
Pass 1; this exposes it.

## Decisions worth remembering

- **Session matching degrades honestly** (`sessionMatchesDimension`): a
  dimension naming an activity matches sessions by exact activity; a legacy
  session with NO activity falls back to the movement-family (modality) match;
  a session naming a DIFFERENT activity never counts (we know a 'sup' session
  isn't the kayak benchmark). Counts what the log supports, no more, no less.
- **Windows bucket UTC** — same posture as the stimulus ledger
  (`isoWeekStart`, quirks 1/10). Weeks are ISO (Monday); months are calendar.
  When the tz-correct bucketing fix lands for the ledger, this inherits it.
- **One weigh-in query serves Today** — `useBenchmarkStatuses` takes the trend
  points from the screen's existing `useWeightTrend` instead of re-querying;
  its own sessions query runs once from min(week-start, month-start) and only
  when a pinned benchmark actually has a behavior face.
- **Magnitude measures return null** rather than a session count against a km
  target (never fake a number). Not creatable in the v1 form anyway.

## Verified

294 jest (27 suites; +22 in `benchmarkStatus.test.ts` — window edges incl.
year-end, matching fallbacks, against-the-wish movement, sparse-data delta
suppression, kg/lb lines), tsc 0 (last), `expo export --platform ios` clean.
NOT sim-verified: the card render, section spacing, and pin flow want a
tap-through next time the benchmarks sim is up — create a dual-face benchmark,
log a qualifying session, watch the count move.

## Next

The remaining Phase 5 milestone is the **benchmark-keyed Reflect layer**
(three-layer hierarchy on top of the existing trend + ledger; spec v0.4 hero
rule: outcome face keys the hero when both faces exist, behavior renders
beneath as consistency context; behavior-only promotes the rhythm). Bigger
piece, likely its own session.
