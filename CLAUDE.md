# Health Coach — Claude Code Project

A personal health + training hub. **A mirror, not a coach that leads.**

The product constitution below is the source of truth for every decision.
Read it first, every session. If a request conflicts with it, stop and flag
the conflict — do not quietly reinterpret it into something "safer."

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
- `outdoor-integrations.md` — outdoor-sport data sources (IGC, water levels, wind gauges, GPS); logbook-first, identity grouping
- `gps-mapping-spec.md` — GPS capture without a wearable, routes as first-class navigable/comparable objects, map display, cohort map (companion to `wearable-ingestion-spec.md`, which owns import)
- `benchmarks-spec.md` — user-defined benchmarks; the Reflect layout key
- `cohorts-spec.md` — Ring 4 social layer (events, challenges, profile)
- `ai-consultant-prompt.md` — Phase 7 (AI consultant)
- `competitive-landscape.md` — Cora, trainhybrid, Edge, etc.
- `brand-kit.md` — design tokens and visual direction
- `phase-1-build-spec.md` — what we built first (the minimum useful loop)
- `game-plan-and-prompts.md` — build sequence + ring↔phase↔pass legend
- `backlog.md` — deferred items, open constraints, known quirks
