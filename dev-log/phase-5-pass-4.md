# Phase 5 · Pass 4 — the benchmark-keyed Reflect layer

*2026-07-01 · commits `d5ab627` (ms-boundary fix) + `0117c3d` (layout-key math)
+ `b4627af` (chart target line) + `06223b3` (three-layer view) on branch
`benchmarks`. Picked up mid-flight from the prior session — the math lib and
its tests were written; the chart target line was half-drawn (prop + y-domain
in, no line rendered, `targetKg` missing from the memo deps); the view layer
was unstarted.*

## What shipped

**Reflect recomposes around the active benchmark** (spec v0.4, "The benchmark
is a layout key, not a label"). Three layers, in order:

1. **Frame** — `Working toward` + the benchmark title (tap → `/benchmarks`),
   with a ChipSelect lens switcher when several benchmarks are active. The
   lens defaults to the first benchmark with a measured story
   (`defaultLensId`); switching recomposes the tab.
2. **Hero** — the outcome face keys the hero when both faces exist: the
   weight trend chart, now carrying the benchmark threshold as a **dashed
   sandstone target line** (the user's own mark on the mirror, pulled into
   the y-domain so the distance is always visible), with the outcome line
   ("82.4 kg · ↓ 0.6 kg over 14 days · 7.4 kg above target") beneath it, and
   the behavior rhythm beneath that as consistency context. A behavior-only
   benchmark promotes its rhythm — the doing IS the story.
3. **Supporting context** — the stimulus ledger, plus the weight trend
   demoted here when it isn't the hero. The correlation engine will rank
   this layer later (correlation-engine-spec); until then the existing views
   are the honest stand-in.

**BenchmarkRhythm** — the last N windows (8 weeks / 6 months, matching the
ledger's reach) as hard-edged factual bars: ONE color, a bar at target never
changes hue (the palette never grades); the in-progress window renders hazed
with a "now" label (not a verdict yet); the dashed sandstone target line uses
the chart's grammar. The **revealed run** reads back in plain words
("3 weeks running at target") only when it exists — a run of 0 simply isn't
shown, no drama either way. Windows before the benchmark existed still count:
history is revealed, not started at the moment of intent.

**`useBenchmarkReflect`** — loads ACTIVE benchmarks (not just pinned: the pin
gates Today; the lifecycle table says active *frames Reflect*). One sessions
query floored at the oldest rhythm window, run only when the lens has a
countable behavior face; trend points passed in from the screen's existing
`useWeightTrend`, same one-query posture as Today.

## Decisions worth remembering (⚑ = flag for Dylan)

- ⚑ **No-benchmark Reflect now puts the ledger first, weight trend below** —
  the spec is explicit ("Weight trend is not the default hero; the ledger
  is") but this reorders the screen as it existed since Phase 1. Easy to
  revert if it reads wrong on device.
- ⚑ **Reflect lenses = all active benchmarks, pinned or not.** Pin stays a
  Today-only control. If the lens row gets noisy, "pinned first" is the
  obvious sort.
- **Magnitude behavior faces render no rhythm** (null from the lib — a
  session count against a km target is the wrong number), and the hero slot
  is never rendered empty: a magnitude-behavior-only benchmark shows frame +
  supporting context only.
- **The ms-boundary fix rode along from the prior session** but was committed
  as its own fix: window bounds now carry `.000Z` so string comparison with
  real `occurredAt` values is uniform — a bare `T00:00:00Z` bound sorted
  AFTER `00:00:00.500Z` and pushed a first-second session into the prior
  window. Test added.

## Verified

305 jest (28 suites; +11 in `benchmarkReflect.test.ts`, +1 boundary test in
`benchmarkStatus.test.ts`), `expo export --platform ios` clean (3442 modules),
tsc 0 (last). NOT sim-verified: the three-layer recomposition, lens switching,
target line on the chart, and the rhythm bars all want a tap-through — create
a dual-face benchmark and a behavior-only one, switch lenses, watch the tab
recompose.

## Next

Phase 5's Reflect milestone is now built end to end. Remaining threads:
sim verification of Pass 3 + Pass 4 surfaces together; then either the
correlation engine feeding layer 3, or back to main for the camera line
(Pass 2.8a photo → LLM estimate, Dylan's stated next).
