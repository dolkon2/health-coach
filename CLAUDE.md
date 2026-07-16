# Health Coach — Claude Code Project

A personal health + training hub. **A mirror, not a coach that leads.**

The product constitution below is the source of truth for every decision.
Read it first, every session. If a request conflicts with it, stop and flag
the conflict — do not quietly reinterpret it into something "safer." Flag it
once, plainly — if the user considers it and overrides deliberately, that
override stands and the flag doesn't get re-raised on the next pass.

@planning/claude-md.md

---

## Build environment

@AGENTS.md

## Planning docs (full product context in `planning/`)

- `claude-md.md` — the constitution (imported above)
- `product-overview.md` — north star, features, traps, taglines
- `data-model.md` — the Observation schema (the data contract)
- `correlation-engine-spec.md` — expenditure, plateau forensics, thresholds
- `food-logging-spec.md` — Ring 2 intake; APIs, input methods, fidelity, earned fidelity
- `training-logging-spec.md` — session logging architecture (gym, climbing, GPS, swim, practice)
- `outdoor-integrations.md` — outdoor-sport data sources (IGC, water levels, wind gauges, buoys/tides, snow/avalanche, trail names, GPS); logbook-first, identity grouping; OS-floor audit + sports-gap triage
- `gps-mapping-spec.md` — GPS capture without a wearable, routes as first-class navigable/comparable objects, map display, cohort map (companion to `wearable-ingestion-spec.md`, which owns import)
- `climbing-apps-research.md` — climbing app deep dive (indoor/outdoor/boards/training); import paths, OpenBeta reference DB, the converged ascent record
- `outdoor-sports-master-plan.md` — consolidation of the GPS + Garmin + outdoor-sports sessions: how the layered route model and capture ladder fit, what's decided vs ⚑ flagged, sport-expansion plan, build sequence
- `four-dimensions-framework.md` — Earth/Sky/Water/Body, the organizing lens behind the constitution's four-dimensions section
- `mapping-architecture-spec.md` — the 6-layer build contract for mapping & GPS
- `mapping-systems-research.md` — Strava internals, platform landscape, recommended mapping stack
- `sport-mapping-research.md` — sport-specific mapping data layers (free flight, whitewater, ski, wind/kite, hiking)
- `benchmarks-spec.md` — user-defined benchmarks; the Reflect layout key
- `goal-path-tagging-spec.md` — early sketch: tagging multiple behavior paths to one outcome benchmark, feeding the deferred "story of success" surface; needs its own planning pass
- `rework/master-plan.md` — **the current product shape — read this for design/nav status**: 5-tab shell (Home/Training/Map/Nutrition/Social), Profile + Settings drawer, phased build order; every file under `planning/rework/` is a spoke off this hub
- `rework/research/social-expansion-plan.md` — the social layer as decided 2026-07-11 (S0–S9 ladder, public accounts, kudos with counts, amended constitution rules 5+6; supersedes `cohorts-spec.md`)
- `rework/research/supabase-backend-spec.md` — social backend (upload-on-share, RLS, projections)
- `rework/research/activity-groups-spec.md` — groups/channels/events/segments (G1–G4)
- `rework/research/session-photos-spec.md` — session photos (migration 018)
- `profile-spec.md` — Profile as identity home + Logbook (session=post, per-entry privacy)
- `pinned-spots-spec.md` — watchlist of go-to places with live conditions (Training tab mode 2)
- `nutrition-tab-v2-spec.md` — Intake/Trend split, self-set targets, Focus mode
- `cohorts-spec.md` — pre-override Ring 4 social sketch (superseded, historical)
- `ai-consultant-prompt.md` — Phase 7 (AI consultant)
- `competitive-landscape.md` — Cora, trainhybrid, Edge, etc.
- `brand-kit.md` — original design tokens (the Gorge rebrand has since landed in code — `constants/tokens.ts` is the live source; app is light-only, dark mode retired 2026-07-11)
- `screens-features-status.md` — Notion screen-redesign snapshot (largely superseded by `rework/master-plan.md`; still points at the live Notion page)
- `phase-1-build-spec.md` — what we built first (the minimum useful loop)
- `game-plan-and-prompts.md` — build sequence + ring↔phase↔pass legend
- `backlog.md` — deferred items, open constraints, known quirks
