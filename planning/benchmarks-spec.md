# Benchmarks — Spec (v0.2)

*Companion to `product-overview.md` and `correlation-engine-spec.md`. Locks the benchmark decisions that give the Reflect tab its framing. Supersedes v0.1 — the input model changed (see Input UX). Spine rule 7 ("goals are yours, not ours") is the constitutional root; this spec is the mechanism, not a re-argument of it.*

---

## What a benchmark is

A benchmark is whatever the user writes in their own words — "climb 5.12," "finish a 50k," "stay consistent through a stressful quarter." Freeform text, full stop. There is no goal-type enum, no category picker, no template menu anywhere in the model. The user names what they're working on; the app's job is to connect that text to data it already tracks, not to make them pick from a list of approved ambitions.

One commitment carries over from v0.1: the app connects the user's words to a data dimension it tracks (a movement, an activity, a stimulus pattern, weight trend, intake, fidelity, sessions) whenever it can, so Reflect can illuminate the benchmark. But the benchmark always stands as the user's words — resolution to a tracked dimension governs how richly Reflect renders it, never whether it exists (see Input UX).

---

## The benchmark is a layout key, not a label

A benchmark is a dynamic layout key that reorders the Reflect hierarchy — not a tag pinned to a static dashboard. With a benchmark active, Reflect stops being "here's what happened" and becomes "here's what happened in the context of what you said you're working on." Switch the benchmark and the tab recomposes: different frame, different hero, different supporting context, all from the same underlying data. That recomposition is what earns the tab the name "Reflect." A view that always shows the same thing in the same order is a rearview mirror; a benchmark-keyed view is a lens.

---

## Three-layer hierarchy

Reflect renders in three layers, in order:

1. **Benchmark frame** — the user's benchmark sets what the view is about.
2. **Hero signal** — the primary visualization: the data dimension the benchmark promotes to the headline.
3. **Supporting context** — everything else the correlation engine surfaces that moved in the same window, ranked by z-score magnitude.

The benchmark tells Reflect what to foreground; the correlation engine fills in the rest. When the hero falls back (an unresolved benchmark, per Input UX), the layer-2 region renders the no-benchmark default view in full — the stimulus ledger (#5) — so the frame always sits above a complete, intentional view, never an empty or half-rendered hero slot. This hierarchy is the contract between the benchmark system and the Reflect tab.

---

## Input UX: freeform text, keyword-mapped

The user writes the benchmark as free text — a phrase in their own words, the way they'd say it out loud ("climb 5.12," "finish a 50k," "bench 225 by October," "stay consistent through a stressful quarter"). There is no domain dropdown, no two-step picker, no category menu. The input surface is the user's language, not the app's taxonomy. (This supersedes v0.1, which specced a two-step "pick a domain → pick the specific thing" flow; that put the app's categories in front of the user's words, which inverts spine rule 7.)

Behind that text, the app still has to find the data dimension the benchmark anchors to. In **v1 this is a deterministic keyword mapper**: it matches words in the benchmark text against the product's known vocabulary — the exercise library, stimulus patterns, activity labels, and tracked data dimensions — and resolves the text to a domain. Simple, predictable, no AI, no model in the loop. "bench" → bench press load; "5.12" / "climb" → climbing grade + upper-pull stimulus; "50k" → aerobic / running distance; "consistent" → session frequency.

The keyword mapper is intentionally narrow — it maps clean phrasing well and unusual phrasing poorly, and that limit is stated rather than hidden. When the mapper can't resolve the text to a tracked dimension, the benchmark is still created — the user's words always stand. What degrades is hero promotion, not the benchmark: an unresolved benchmark renders as the frame (layer 1), and the hero signal (layer 2) falls back to the same default as the no-benchmark case (#5/#6) until the text resolves. Resolution gates what gets promoted, never whether the user's benchmark may exist. This keeps v1's mapper from quietly becoming the category gate that #1 removed.

The **AI parser is deferred to Phase 7** (Ring 3, AI consultant). It replaces the keyword mapper with a model that reads freer phrasing and infers the dimension without depending on exact keywords — same upgrade path, smarter input surface, identical underlying data model. The text the user writes does not change; only how reliably it gets understood does.

---

## No-benchmark default

With no benchmark set, Reflect falls back to the stimulus ledger as the neutral organizing frame. The tab still works — it shows the training landscape without a user-defined focal point. Weight trend is not the default hero (see below); the ledger is.

Before any benchmark text exists, there is already one domain signal: the **onboarding activity picker** sets the user's initial headline row in the session logger (`training-logging-spec.md`, "Onboarding connection"). It's not a goal and not a benchmark — just "which activities do you care about" — but it gives the no-benchmark view a sense of the user's domain from the first session.

---

## Weight trend as optional hero

Weight trend is a common benchmark dimension but is never hardcoded as the default hero. The active benchmark decides what gets promoted: a weight benchmark makes the trend the hero; a "kayak 4x/week" benchmark makes session frequency the hero and demotes weight to supporting context. A user whose goals are never weight-related never sees weight in the headline. The benchmark promotes; nothing is privileged by default.

---

## Consistency counters (the line that keeps a count descriptive)

A factual count — "4 weeks in a row at your kayaking frequency" — is information: the mirror reporting what happened. It is allowed and valuable. The constitutional line between a count and a streak:

- ✅ **Factual count:** "3 consecutive weeks at target." Resets without drama when missed. No animation, no sound, no shareable card, no punishment for the number going down. Just the new number.
- ❌ **Streak:** celebration on milestone, loss aversion on break ("you lost your 3-week streak!"), shareability, any psychological cost to the number dropping.

(MacroFactor precedent: a day-count nobody confuses for gamification.) This distinction is load-bearing — it's the difference between a benchmark consistency counter being a data point and being the gamification the product refuses (spine rule 5).

---

## Archiving and lifecycle

- **Active** — frames Reflect and shows on the today cards.
- **Archived** — moved out of the active view with no ceremony and no "congratulations" moment. Data and history are preserved; the user can revisit archived benchmarks to see the arc.
- **Reactivated** — an archived benchmark can return to active. Process benchmarks are often seasonal ("I'm focused on fidelity right now") and cycle in and out.
- **Completed** — a natural end state for outcome benchmarks ("I hit 225"). Distinct from archived in that it carries the completion context. Still accessible in history.

Archiving should feel like setting something down, not closing a chapter.

---

## Cohort connection (Ring 4 — forward reference)

Cohort events and challenges target the same data dimensions personal benchmarks use, on the same mapping. Opting into a cohort event spawns an independent personal benchmark on the user's timeline; if the event ends or they leave the cohort, their benchmark survives. The event is social context, the benchmark is personal commitment — the individual's Reflect experience is always driven by their personal benchmarks. Full mechanics in `cohorts-spec.md`.

---

## Build sequence

This spec gates **Phase 5 (Ring 1, the full Reflect tab)** — the same relationship `training-logging-spec.md` holds to Phase 4. Phase 5 builds the keyword mapper (v1) and renders the three-layer hierarchy. The keyword mapper → AI parser upgrade lands in **Phase 7 (Ring 3, AI consultant)**, alongside the rest of the AI surface. Cohort connection lands in **Phase 8 (Ring 4)**.

---

## Open questions

- **Exact input affordance.** Freeform text + keyword mapper is the locked model; the precise capture surface (single text field, text field with live mapped-domain confirmation, etc.) needs design exploration. The open risk is the mapper silently mis-mapping text — how visibly the inferred domain is shown back to the user before they commit is unresolved.
- **Active benchmark cap.** "Not infinite" is decided; the exact number is a design-feel call.
- **Milestone data model.** Whether benchmarks carry optional user-created milestones, and how lightweight those can be while still being useful in Reflect retrospect. (v0.1 floated them; deferred until the core loop is felt.)
- **Benchmark creation timing.** Dedicated flow only, or spawnable contextually (e.g., from a lift's history in the Training tab: "work toward X on this")?
