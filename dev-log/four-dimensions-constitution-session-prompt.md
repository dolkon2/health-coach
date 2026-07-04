# Four Dimensions → Constitution — build session prompt

*Handoff for a dedicated local session. Scope: carefully integrate the four-dimension
framework (Earth/Sky/Water/Body) into `CLAUDE.md` and `planning/claude-md.md` as an
organizing lens. This touches the single most load-bearing document in the repo — go slow,
flag ambiguity rather than resolve it unilaterally, the same discipline the constitution
already asks of itself.*

## Mission

Integrate the four-dimension framework captured in `planning/four-dimensions-framework.md`
into the constitution as a genuine organizing lens for the product — not a bolt-on section,
a real amendment to how the north star is expressed. This came out of a real design
conversation (a map-color mockup led to an element taxonomy, which led to a positioning
insight, which led to a world-map/privacy idea) — read the whole framework doc, it's the
"why," not just the "what."

## Read first, in order

1. `CLAUDE.md` + `planning/claude-md.md` — what you're amending. Read it as carefully as the
   constitution asks everyone to.
2. `planning/four-dimensions-framework.md` — the full captured idea. Everything below assumes
   you've read it.
3. `planning/gps-mapping-spec.md` — the existing Ring 4 cohort-map section and the privacy
   "hardest line" rule the world-map application extends.
4. `planning/brand-kit-gorge-draft.md` — the color mockup that started this (unadopted draft;
   don't confuse its color tokens with something already decided).
5. `planning/sport-mapping-research.md` — the fragmented-niche-sports finding behind the
   positioning argument.

## The one thing that must not slip

This is the load-bearing constraint, stated plainly so it survives translation:

**The four dimensions are a mirror, not a mechanic.** A session is *tagged* with a dimension
(Earth/Sky/Water/Body) and Reflect can show the honest mix — that's descriptive, it's fine.
What must **never** appear anywhere in this integration:
- Mastery levels or percentage-complete-per-dimension
- Unlockable content gated behind mastery of a dimension
- Any language that defines what "success" in a dimension looks like

This maps directly onto two existing constitution reject-tests — *"does this reward the user
with anything that doesn't already exist in the world"* and *"does this define what success
means for the user"* — a mastery/unlock system fails both. If any draft language you write
starts to read like a game (even accidentally, even in flavor text), stop and rewrite it
plainer. The "expanding world" feeling has an honest substitute already specced: a personal
geographic heatmap that fills in because the user actually went places (see
`mapping-systems-research.md`'s Strava heatmap section) — not a threshold-gated unlock.

## What to actually do

0. **Amend the constitution's own "stop and flag" rule with an explicit override clause.**
   The sentence *"stop and flag it before building — don't quietly reinterpret it into
   something 'safer'"* appears near-verbatim in both `CLAUDE.md`'s intro and
   `planning/claude-md.md`'s North star section. Add to it: flagging is not a veto. If the
   user considers a flagged conflict and pushes back deliberately — a considered override, not
   a shrug — that override stands, and the flag should not be re-raised on every future pass.
   Suggested language to adapt (not copy verbatim, match the doc's existing voice): *"Flag it
   once, plainly, with the reasoning. If the user considers it and overrides anyway, that
   stands — the rule exists to prevent silent reinterpretation, not to relitigate a decision
   the user has already made deliberately."* Do this everywhere the "stop and flag" sentence
   is duplicated, not just one copy. This is a general process amendment (not specific to the
   four-dimensions work) — bundle it with this pass since both touch the same rule.
1. **Decide where in `claude-md.md` this lives.** Candidates to weigh (your call, this is
   genuinely underdetermined): a new section near the north star, an expansion of the
   "AI as engine, not face" section, or its own section entirely. It should read as
   foundational, not appended as an afterthought.
2. **Write the amendment carefully**, grounded in the framework doc's language: the four
   dimensions as the organizing question ("what dimension are you training?"), the
   archetype-per-dimension voice principle (inclusive data bucket, evocative brand language),
   the Body-as-infrastructure distinction (not geography, not gated behind the other three).
3. **Check `product-overview.md` and `training-logging-spec.md` for reconciliation** — do they
   need updating to reference dimensions alongside (not instead of) the existing
   `Modality`/`Element` concepts? `Element` already exists as a per-sport tag in the Notion
   training database (Earth/Water/Air/Body — note Notion currently says "Air," this framework
   says "Sky"; reconcile the naming, they're the same concept). Gym and Calisthenics were
   already reclassified `Earth` → `Body` in Notion by the cloud session that captured this —
   no further Notion action needed for that specific fix.
4. **Do NOT build the world-map/cohort-dimension-filter feature this session.** That's Ring 4
   territory per the existing build order. This session is constitution/framework integration
   only — a spec follow-up for the actual feature can come later.
5. **If something is genuinely ambiguous** (e.g., exactly how "archetype per dimension" should
   read in brand voice, or where precisely this belongs in `claude-md.md`'s structure), make
   the call, document *why* in the dev-log, and flag it as a decision a human should sanity-check
   — don't stall, but don't silently paper over a real fork either.

## Definition of done

- The "stop and flag" rule amended with the override clause, everywhere it's duplicated
  (`CLAUDE.md` intro + `planning/claude-md.md` North star section).
- `CLAUDE.md` / `planning/claude-md.md` amended with the four-dimension framework as an
  organizing lens, in the document's existing voice and rigor.
- No mastery/unlock/threshold language anywhere in the amendment.
- `product-overview.md` / `training-logging-spec.md` reconciled if they reference the old
  Element naming or need a pointer to the new framework.
- `dev-log/four-dimensions-pass-1.md` written: what changed, where you placed it, any open
  calls flagged for review.
- Nothing else touched — no code, no `core/` changes, no feature build.
