# Goal-Path Tagging — Sketch (v0.1)

*Companion to `benchmarks-spec.md`. Planning-session sketch (2026-07-16), not yet blessed — flagged here so the thought isn't lost, not offered as a build-ready spec. Needs its own dedicated planning + visualization pass before anything here is spec-complete.*

---

## The thought

`benchmarks-spec.md`'s two-faces model pairs one outcome with one behavior ("lose 5kg" + "kayak 4×/week"). The extension: let an outcome benchmark carry **multiple tagged behavior paths** at once — food logging consistency, macro-target adherence, gym frequency, overall activity frequency — instead of just one. The user names which behaviors they believe are their path to the outcome. It can be a single path or several running in parallel ("likely all that actually contribute"). This is still user-authored — the user picks the tags, the app doesn't — so it extends *who gets counted as your path*, not *what the goal means*. It doesn't cross the "app defines success" line in `claude-md.md`.

This is also where the product's original framing — **"stories of success"** — actually lives. `phase-5-pass-2-6-nutrition-benchmarks.md` already deferred a "cross-benchmark story of success surface" that reads soft-archived benchmarks and renders their historical arcs. Multi-path tagging is the missing piece that makes that surface tell a *legible* story instead of a bare trend line: here's the goal, here were the paths you tagged, here's what actually moved alongside it.

## Shape (sketch only — not decided)

- A benchmark's behavior face becomes a **set** of tagged paths, not a single one — each path still resolves to its own trackable dimension through the existing resolver (`benchmarks-spec.md` § Three entry layers).
- Reflect renders each tagged path as its own small factual card (its own rhythm: "3/4 this week," "5/7 days on target") sitting beside the outcome's movement — parallel, not ranked against each other.
- The correlation engine's existing untagged "supporting context" (z-ranked, everything that moved) stays a separate layer from tagged paths — tags are the user's named hypothesis; supporting context is the app's unprompted reveal. Different provenance; should probably look visually distinct so the two are never confused.
- On completion/archive, the tagged paths + outcome arc become the raw material for the "story of success" surface — the arc replays with its named paths still attached, not just a bare line.

## The constitutional line to hold

Multiple tags raise the temptation to have the app rank or spotlight "the one that worked." That's a rule-3 violation (reveal, don't invent/predict) the moment the app adds a verdict on top of the facts. Each tagged path shows its own facts; the app never layers a "this one drove it" claim over them. Any causal read stays implicit, left for the user — same posture supporting-context already takes.

## Open — needs its own planning session

- **Visualization design** for multiple simultaneous behavior cards under one outcome. This deserves real design thought, not a bolt-on to the existing single-behavior card grammar (MacroFactor's grammar, borrowed in `benchmarks-spec.md`, was scoped for one behavior + one outcome).
- How the "story of success" retrospective surface actually reads multiple archived paths together — one arc per path, or a woven single narrative?
- Whether tagging happens at benchmark-creation time only, or paths can be added/dropped while the benchmark stays live (a path the user tries and abandons).
- Whether/how a path that turns out untagged-but-correlated (surfaced by supporting-context) should ever cross over into "you might want to tag this too." Careful — that edges toward suggestion/prescription and is probably a reject, but it deserves a deliberate call, not a silent default either way.

---

*Not scheduled. Surface at the next benchmarks/Reflect planning session.*
