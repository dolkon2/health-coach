# Four dimensions → constitution — Pass 1

**Goal:** integrate the four-dimension framework (Earth/Sky/Water/Body) into `CLAUDE.md` /
`planning/claude-md.md` as an organizing lens, and amend the constitution's "stop and flag"
rule with a flag-once-then-respect-override clause. Session prompt:
`dev-log/four-dimensions-constitution-session-prompt.md`. Docs only — no code, no `core/`
changes, no world-map feature build.

## Branch note (read this first if anything looks stale)

The session prompt and `four-dimensions-framework.md` didn't exist on `main` or on any local
worktree — they only existed on `origin/claude/mapping-systems-research-cit3ol` (pushed by a
cloud session, not yet pulled anywhere local). That branch's tip (`13a10ac`) sits exactly on
top of `main`'s current HEAD (`d367f87`, the summoned-coach amendment) plus seven doc-only
commits (mapping/GPS research + the four-dimensions capture) — clean, no divergence from
`main`. This work was done on a **new worktree** (`~/Projects/health-coach-fourdim`, branch
`fourdim-constitution-work`, tracking that origin branch) rather than the existing
`~/Projects/health-coach-mapping` worktree, because that worktree's local branch (same name,
confusingly) has *silently diverged* onto an unrelated GPS/outdoor-sports build lineage that
was never pushed to this origin branch. Nothing in that worktree was touched.

**Flag for a human:** `planning/gps-mapping-spec.md` is referenced by name in
`four-dimensions-framework.md` (cohort-map section, "the hardest line in the app" privacy
rule) and now also in the new constitution section and in `product-overview.md`'s Social
layer — but the file itself only exists in the `health-coach-mapping` worktree's diverged
local branch, not in this branch's history and not on `origin/main`. The reference will
resolve once that GPS/outdoor-sports work and this branch consolidate (which memory suggests
is already an expected future step), but if you check out just this branch today, that link
is dangling. I read the file's Privacy and Cohort-map sections directly from the other
worktree to write the constitution text accurately — I did not fabricate the content, just
noting the citation won't resolve until the branches meet.

## What changed, and where

**0. Flag-once-then-respect-override amendment** (general process change, not scoped to
four-dimensions):
- `CLAUDE.md` intro (lines 5–9) — appended the override clause to the existing "stop and
  flag" sentence.
- `planning/claude-md.md` § North star (line 7) — same clause, matching the fuller prose
  voice of that doc. Used language close to the session prompt's suggested wording.

**1. New constitution section** — `planning/claude-md.md` § **The four dimensions — Earth,
Sky, Water, Body**, inserted after § The summoned coach (Ring 3b) and before § Evidence
hierarchy.

- **Placement call (flagging per the prompt's invitation — genuinely underdetermined):** I
  grouped it with the summoned-coach section because both are constitution *amendments* added
  after the original spine, both need the reject-tests machinery in § The line you do not
  cross, and putting them back-to-back reads as "here are the two things added on top of the
  original document" before the doc moves into the more technical Evidence
  hierarchy/Architecture/Conventions back half. The prompt's other candidates (folded into "AI
  as engine, not face," or placed right after North star) were both defensible too — sanity
  check this placement if the ordering matters to you.
- Content covers, in order: the four dimensions + the Earth/Sky/Water-vs-Body generative rule,
  the positioning-wedge rationale (from `sport-mapping-research.md`'s fragmented-niche-sports
  finding, via the framework doc), the mirror-not-mechanic boundary stated as an explicit
  never-list, a citation of the two existing reject-tests it maps onto, the
  archetype-per-dimension voice principle, and the Body-is-infrastructure/not-geography
  principle (with the privacy rationale, not implementation detail like map-pin rendering —
  that stays in `gps-mapping-spec.md`).
- Held exactly as written: no mastery levels, no unlocks, no per-dimension "success" language,
  anywhere in the new text.

**2. Reconciliation check** (`product-overview.md`, `training-logging-spec.md`):
- `training-logging-spec.md` has **no existing `Modality`/`Element` concept** — I grepped for
  both terms, zero hits. Nothing to reconcile there beyond a pointer. Added one sentence to §
  Identity tags noting the dimension is the one identity tag elevated to a constitution-level,
  every-session lens (as opposed to an optional affinity tag like "calisthenics").
- `product-overview.md` uses the word "modality" once, generically, in prose (not a formal
  taxonomy) — no conflict to resolve. Added one pointer sentence to § Social layer (ring 4)
  noting the still-unscoped world-map/dimension-filter extension, since that's its natural
  future home and the doc's existing convention is to drop these forward-pointers (e.g. the
  `cohorts-spec.md` full-spec line right above it).
- The `Element`/"Air" vs. `Sky` naming and the Gym/Calisthenics `Earth`→`Body` reclassification
  live in the **Notion training database**, external to this repo — the framework doc already
  states both were actioned by the cloud session that captured it. No repo-side action needed;
  I did not touch Notion.

**3. `four-dimensions-framework.md` itself** — updated its own header note from "not yet part
of the constitution, a dedicated session should integrate this" to point at where it landed
(`claude-md.md` § The four dimensions) and at this dev-log entry, since the doc's job is now
"the full why behind that section" rather than "captured but unintegrated."

**4. Planning-doc index pointers** — added `four-dimensions-framework.md` to the bullet list
in both `CLAUDE.md` and `planning/claude-md.md` § Planning docs. Deliberately did **not**
backfill the other mapping-related docs this branch already has
(`mapping-architecture-spec.md`, `sport-mapping-research.md`, `mapping-systems-research.md`,
`brand-kit-gorge-draft.md`) into either index — that's a broader consolidation concern
(several docs, several docs' worth of judgment calls about ring/phase framing) outside this
session's scope of "four-dimensions + the flag-once amendment only."

## Not touched

- No code, no `core/` changes.
- No world-map / cohort-dimension-filter feature — Ring 4 territory, explicitly deferred by
  the prompt.
- `brand-kit.md` (the live, adopted kit) — the gorge draft stays an unadopted exploration;
  nothing here promotes its colors to canonical.
- Notion.
- No PR opened, per instruction. Changes are committed on `fourdim-constitution-work`
  (tracking `origin/claude/mapping-systems-research-cit3ol`) in the new
  `~/Projects/health-coach-fourdim` worktree, not pushed.

## Flags for a human to sanity-check (not silently resolved)

1. **Section placement** in `claude-md.md` (see above) — my call, not obviously the only
   right one.
2. **`gps-mapping-spec.md` cross-branch dangling reference** (see "Branch note" above) — the
   constitution and `product-overview.md` now cite a file that doesn't exist on this branch
   yet. Low risk (the content is real, I read it from the other worktree, and the two
   lineages look headed for the same consolidation main already expects) but worth knowing
   before you assume `grep`-ing this branch alone will find everything it references.
3. **The two divergently-named `claude/mapping-systems-research-cit3ol` branches** — one on
   `origin` (this one), one local-only inside the `health-coach-mapping` worktree with
   unrelated GPS/outdoor-sports commits that were never pushed under that name. Worth a
   deliberate rename/cleanup pass at some point so the name stops meaning two different
   things depending on which machine/worktree you're looking at it from. I didn't touch that
   worktree.
