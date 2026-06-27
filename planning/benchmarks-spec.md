# Benchmarks — Spec (v0.1)

*Companion to `product-overview.md` and `correlation-engine-spec.md`. Captures the architectural decisions for the benchmark system — the user-facing layer that gives the Reflect tab its framing.*

---

## What a benchmark is

A benchmark is a thing-you're-working-on. Not a goal template, not a to-do, not an AI-generated plan. The user defines it; the app connects it to tracked data so the Reflect experience can show progress in context.

**The hard rule:** every benchmark must anchor to a data dimension the app actually tracks. A benchmark that can't connect to anything the app knows about is a sticky note, not a benchmark — it has no home in Reflect and no way to show progress. This is the line between "personal journal entry" and "thing the product can illuminate."

---

## Benchmark shapes

Three shapes exist, but they emerge from the combination of data dimension \+ target — the user never picks a "type."

- **Outcome** — points at a data dimension with a target value. "Hit 225 on bench" (lift \+ load target). "Reach 175 lbs" (weight trend \+ number). Has a finish line the app can measure proximity to.  
- **Process** — points at a data dimension with a frequency or quality target. "Kayak 4x/week" (activity \+ frequency). "Log food at high fidelity" (nutrition fidelity \+ direction). No finish line; progress is sustained behavior over time.  
- **Event** — any benchmark with a date attached. "Race on September 14th." The date is a fact about the world, not a streak. Naturally generates a countdown and a "how does my data look heading into this" framing in Reflect.

These aren't mutually exclusive. "Hit 225 on bench by October" is outcome \+ event. The shape informs how Reflect renders progress, not how the user thinks about it.

---

## Data dimensions a benchmark can anchor to

The product's own observation space — the things the app collects and understands:

- A specific lift or movement (load progression, volume)  
- An activity or sport (session frequency, duration)  
- A stimulus pattern (upper pull volume, aerobic work, etc.)  
- Bodyweight / weight trend  
- Calorie intake  
- Food logging fidelity  
- Step count  
- Sleep  
- Session consistency (frequency across any activity)

This list grows as the product's data surface grows (Ring 2 adds nutrition depth, Ring 2.5 adds sleep \+ steps). Benchmarks are only as rich as the data behind them.

---

## Target is optional; the data connection is not

Every benchmark carries a data dimension. Not every benchmark carries a specific target number.

- "Hit 225 on bench" → data dimension: bench press; target: 225 lbs.  
- "Lose weight" → data dimension: weight trend; target: directional (down), no specific number.  
- "Kayak 4x/week" → data dimension: kayaking sessions; target: frequency (4/week).  
- "Log food better" → data dimension: nutrition fidelity; target: directional (higher), no number.

Reflect adapts based on whether there's a target to measure against or just a trend to show. A benchmark without a target still has data to render — it just shows trajectory and consistency rather than proximity to a finish line.

---

## Input UX (direction, not final design)

**Neither pure freeform nor a dropdown.** The user doesn't type a sentence and hope the app understands, and they don't pick from a goal-template menu.

**Two-step flow:**

1. **Pick a domain.** Training, nutrition, weight, sleep, steps — the top-level data categories the app knows about. Clean, tappable, same visual language as the rest of the product.  
2. **Find the specific thing within that domain.** If training → pick a movement, activity, or stimulus pattern. If nutrition → fidelity, intake, specific macro. If weight → the trend. Then optionally set a target type: a number, a frequency, a direction, a date.

This narrows the space without feeling like a form. The interaction stays within the product's visual language — no chat box, no sentence parsing.

**v1 implementation:** keyword mapper handles the domain → specific-thing mapping. Simple, deterministic, no AI required. The mapper knows the product's exercise library, stimulus patterns, and data dimensions.

**Phase 7 upgrade:** AI parser replaces the keyword mapper, enabling more natural input (e.g., the user types "climb 5.12" and the system understands that's a climbing-specific grade target without needing the user to navigate through menus). The underlying data model is the same — the parser just makes the input surface smarter.

---

## Tasks and milestones (optional, user-created)

A benchmark can optionally contain tasks and milestones. These are **retrospective markers**, not prescribed checkpoints.

- The user creates them. The app never generates or suggests them.  
- "Hit 215" as a milestone under "hit 225 on bench" is a marker the user drops so Reflect can show the arc in retrospect.  
- Most benchmarks will have zero milestones. That's fine.  
- Tasks are things like "start weighing meals" under a fidelity benchmark — user-defined actions they want to track against, not an AI-generated action plan.

The purpose is Reflect depth: when looking back, milestones let the user see how they got there. They're optional structure for users who want granularity in their reflection.

---

## Display and layout

**Cards at the top of today.** Active benchmarks are displayed as clean cards — same visual language as the log-session action squares. Each card carries a contextual mini progress indicator appropriate to its shape:

- Outcome: proximity to target (e.g., current bench max relative to 225\)  
- Process: factual consistency counter (e.g., "3 weeks at 4+ sessions")  
- Event: data summary heading into the date

**Multiple active benchmarks allowed.** The exact cap is a design feel decision — enough to reflect real life (people work on multiple things), not so many it gets busy. The visual has to stay clean.

---

## Consistency counters (the line)

A factual count — "4 weeks in a row hitting your kayaking frequency" — is information. It's the mirror reporting what happened. This is allowed and valuable.

**The line between fact and streak:**

- ✅ Factual count: "3 consecutive weeks at target." Resets without drama when missed. No animation, no sound, no shareability, no visual punishment. Just the new number.  
- ❌ Streak: animation on milestone, loss aversion on break ("you lost your 3-week streak\!"), shareable card, any psychological cost to the number going down.

MacroFactor precedent: their day-count is descriptive and nobody confuses it for gamification. The counter is a data point in the progress indicator, not a score to protect.

---

## Benchmarks as Reflect layout key

**This is the architectural reason benchmarks exist in the product, not just as a goal-setting feature.**

Without benchmarks, the Reflect tab shows "here's what happened" — a rearview mirror. With a benchmark active, Reflect becomes "here's what happened in the context of what you said you were working on." The benchmark reorders the Reflect hierarchy:

- **Hero signal** is determined by the active benchmark's data dimension (weight trend if the benchmark is weight-related, lift progression if it's a strength benchmark, session frequency if it's a consistency benchmark).  
- **Supporting context** reshuffles around the hero — the correlation engine surfaces what else moved in the same window.  
- **Switching benchmarks recomposes the view.** Different benchmark active → different hero → different supporting context → different Reflect experience from the same underlying data.

This is what earns the "Reflect" name. The tab isn't a static dashboard — it's a lens that changes shape based on what you told the app you care about right now.

**No-benchmark default:** falls back to the stimulus ledger as the organizing frame. The Reflect tab still works — it just shows your training landscape without a user-defined focal point.

**Weight trend as optional hero:** weight is a common benchmark dimension but it's not hardcoded as the default hero. If your benchmark is "kayak 4x/week," the weight trend is supporting context, not the headline.

---

## Archiving and lifecycle

- **Active** → the benchmark frames Reflect and shows on the today cards.  
- **Archived** → moved out of the active view. No ceremony, no "congratulations" moment. The data and history are preserved — the user can look back at archived benchmarks to see the arc.  
- **Reactivated** → an archived benchmark can come back to active. Process benchmarks especially are seasonal: "I'm focused on fidelity right now" may cycle in and out.  
- **Completed** → a natural end state for outcome benchmarks ("I hit 225"). Distinct from archived in that it carries the completion context. Still accessible in history.

Archiving should feel low-friction, like setting something down rather than closing a chapter.

---

## Cohort connection (Ring 4\)

- **Cohort events and challenges can target the same data dimensions** that personal benchmarks use — workout frequency, weight goals, fidelity targets, etc. They're built on the same underlying mapping.  
- **Opt-in spawns a personal benchmark.** When a user opts into a cohort event or challenge, it creates a personal benchmark on their timeline pointing at the same data dimension. The personal benchmark is independent — if the event ends or the user leaves the cohort, their benchmark survives.  
- **The event is social context; the benchmark is personal commitment.** Cohort challenges are collective benchmarks, but they live in a separate space. The individual's Reflect experience is always driven by their personal benchmarks, with cohort context as supplementary.  
- **Constitutional line (carried from cohorts spec):** the app never authors challenges or surfaces results outside the cohort.

---

## Three-layer hierarchy (for Reflect rendering)

1. **Benchmark frame** — the user-set benchmark determines what the Reflect view is about.  
2. **Hero signal** — the primary data visualization, determined by the benchmark's data dimension.  
3. **Supporting context** — everything else the correlation engine surfaces that moved in the same window, ranked by z-score magnitude.

This hierarchy is the contract between the benchmark system and the Reflect tab. The benchmark tells Reflect what to foreground; the correlation engine fills in the rest.

---

## What benchmarks are not

- **Not AI-generated plans.** The app never suggests benchmarks, milestones, or tasks.  
- **Not goal-picker templates.** No "lose weight / build muscle / maintain" menu. The user defines what matters.  
- **Not gamified.** No points for setting benchmarks, no badges for completing them, no social pressure to have active ones.  
- **Not required.** The product works without any benchmarks set. They enrich the Reflect experience but don't gate it.  
- **Not a journal.** Freeform text unconnected to tracked data doesn't belong here. Every benchmark maps to something the app can measure.

---

## Open questions

- **Exact input UX.** The two-step domain → specific-thing flow is directionally right but needs design exploration / prototyping. Typing-then-summarizing feels gimmicky; dropdowns feel rigid. The right interaction is somewhere between and needs to be felt, not specced.  
- **Active benchmark cap.** "Not infinite" is decided; the exact number is a design feel decision.  
- **Milestone data model.** How lightweight can milestones be while still being useful in Reflect? Do they carry their own target values, or are they just named markers on the benchmark's data dimension?  
- **Benchmark creation timing.** Can benchmarks only be created from a dedicated flow, or can they be spawned contextually (e.g., from looking at a lift's history in the Training tab and saying "I want to work toward X on this")?

---

## Build sequence

- **Phase 5 (Ring 1 full Reflect tab):** benchmarks spec is the architectural input. Keyword mapper v1 handles domain mapping. Reflect tab renders the three-layer hierarchy.  
- **Phase 7 (Ring 3 AI consultant):** keyword mapper upgrades to AI parser for more natural benchmark input.  
- **Phase 8 (Ring 4 Cohorts):** cohort events/challenges connect to the benchmark data dimensions; opt-in spawns personal benchmarks.

