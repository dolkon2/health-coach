# Phase 6 — Plan Tab: pass-by-pass build plan

*Status: DRAFT — awaiting Dylan's approval. No code until blessed.*

*Companion to `phase-6-plan-tab-spec.md` (the vision) and
`phase-4-training-plan.md` (the Phase-4 plan this mirrors in structure).
Decisions resolved 2026-06-28 in a planning session with Dylan.*

---

## Resolved decisions (from the planning session)

1. **Week-view shape** → **7-day horizontal strip.** Swipe left/right for
   past/future weeks. Familiar, clean, maps to how people think about training.
2. **MVP cut** → **Library + week view + place items + tap-to-log.** The full
   planned-path flow end to end. Recurrence, cadence counters, and drift display
   are deferred to later passes.
3. **Recurrence** → **Templates carry optional day assignments and auto-populate
   when "active."** A template can be activated or deactivated. Active = its day
   assignments fill new weeks automatically. Deactivated = stays in the library
   but doesn't populate. No program engine, no rigid schedules. The user created
   it, assigned the days, and chose to activate it — the app is remembering their
   choices, not prescribing.
4. **Placement granularity** → **Day only.** No time-of-day slots. Can revisit
   later.
5. **Planned-vs-actual drift** → **Session detail only** (deferred past MVP).
   During a planned session you can change things on the fly; at the end you're
   asked "update template or one-off?"
6. **Routes** → **Separate entity** that templates reference. People reuse routes
   across sessions; embedding routes in templates would force duplication.
   (Deferred past MVP — light templates don't need GPS route data.)

### Still open (resolve before the cadence pass)

- **Cadence cap & double-count bookkeeping.** How many cadence benchmarks at once,
  and how a placed workout (e.g., a run from a template) counts toward a "run
  3×/week" cadence goal. Inherits the `benchmarks-spec.md` active-cap question.
- **Hybrid density.** How placed items and cadence counters share the week view
  visually without clutter.

---

## Global guardrails (every pass honors)

- **Constitution holds.** Descriptive not prescriptive · no gamification/streaks ·
  pull not push · fidelity-first · null ≠ 0 · library is user-authored only.
- **Library ships empty.** No app-provided programs, templates, or "starter packs."
- **Empty days are neutral.** No nag, no red, no "you skipped leg day."
- **Environment.** Worktree `~/Projects/health-coach-training`, branch
  `phase-4-training`, SDK 53, `npm install --legacy-peer-deps` only. Mind the
  parallel-worktree hazard. Port 8085 for dev server.
- **Single-concern commits** only when Dylan asks.
- **tsc runs LAST** after test files are written.

---

## Dependencies

- **Phase 4 core cut (BUILT)** — the five logging surfaces, timestamped sets, rest
  timer, session history. All on branch, all green. Phase 6 builds on top of this.
- **Phase 4 Pass 4 — exercise library (DEFERRED).** Rich gym templates want this
  (autocomplete exercise names, muscle-group tags). Light templates (kayak, run,
  practice) don't need it. Phase 6 can ship gym templates with freeform exercise
  names and upgrade when Pass 4 lands.
- **Phase 4 Pass 7 — SessionTemplate entity (DEFERRED).** Phase 6 *absorbs* this.
  The library IS the generalized SessionTemplate. We build it here, not separately.
- **Phase 5 — benchmarks (NOT BUILT).** Cadence goals are benchmarks. The cadence
  pass (Pass 5 below) depends on the benchmark entity existing. If benchmarks
  aren't built yet, cadence is either built as its own lightweight counter or
  waits for Phase 5.

---

## Pass-by-pass sequence

### Pass 1 — SessionTemplate entity + library CRUD · MVP

**Concern:** The data model for saved training shapes, and a library screen to
create/browse/edit/delete them. This is the foundation everything else builds on.

**What ships:**
- `SessionTemplate` entity in the data layer (SQLite table + TypeScript type).
  Fields: `id`, `name`, `surface` (gym/gps/climb/swim/practice), `activity`
  (run/kayak/gym/yoga/etc.), `shape` (surface-specific payload — exercises for
  gym, distance/notes for GPS, duration/style for practice, etc.), `dayAssignment`
  (optional: 0–6 for Mon–Sun), `isActive` (boolean, default true), `createdAt`,
  `updatedAt`.
- Library screen accessible from the Training tab (a "Library" button or section).
  Shows all templates grouped or listed. Tap to view/edit, long-press or swipe to
  delete.
- Create-template flow: pick a surface/activity → fill in the shape (reuses the
  existing log-session form components where possible) → save. No timestamp, no
  logging — just saving the shape.
- Edit and delete flows.
- Gym templates use freeform exercise names (strings, not exercise-library IDs) —
  upgrade path when Pass 4 lands.

**Verify bar:** Can create a "Push Day" gym template (3 exercises, target
sets/reps/weight), a "Park run" GPS template (run, 5k), and a "Vinyasa" practice
template (60 min, vinyasa style). All persist, display in the library, and can be
edited/deleted. tsc 0, all tests pass.

---

### Pass 2 — Week view (7-day strip) · MVP

**Concern:** The Training tab's primary view becomes a 7-day horizontal strip
showing the current week. Logged sessions appear on their day.

**What ships:**
- 7-day strip component: horizontal row of day cards (Mon–Sun or Sun–Sat per
  locale). Current day highlighted. Each day shows its logged sessions (from the
  existing session history).
- Swipe/scroll left-right to view past and future weeks.
- Tapping a day opens a day-detail view showing that day's sessions (or empty =
  neutral, no judgment).
- The existing session-history feed moves into or beneath the week view (the week
  is the new primary navigation; the feed becomes "this week's sessions" or the
  selected day's detail).

**Verify bar:** Week view renders with real logged data on the correct days. Swipe
to last week shows last week's sessions. Empty days show nothing alarming. tsc 0,
all tests pass.

---

### Pass 3 — Placement + planned path · MVP

**Concern:** Place a library item on a day. Tap a placed item to start a live
session pre-filled from the template. The core planned-path flow.

**What ships:**
- "Plan" action on a day (+ button or similar): shows the library, user picks a
  template, it's placed on that day. Stored as a `PlannedSession` record (or
  similar): `templateId` + `date` + `status` (planned / logged).
- Placed items appear on the week view visually distinct from logged sessions
  (intent vs truth — e.g., lighter/outlined vs solid).
- Tap a placed item → starts a live session pre-filled with the template's shape
  (exercises, target sets/reps, etc.). Uses the existing Phase-4 log-session
  machinery.
- On "Finish," the session is logged normally AND the planned-session record
  updates to `status: logged`. The `Observation` carries a `templateId` linking
  it back to the template.
- Unplanned logging still works identically (from Today or from the day detail).

**Verify bar:** Place a "Push Day" template on Wednesday. See it on Wednesday in
the week view (visually distinct). Tap it → session opens pre-filled with the
template's exercises. Log sets, finish → session appears as logged, planned item
updates. Unplanned log on the same day also works. tsc 0, all tests pass.

---

### Pass 4 — Active/deactivate + auto-populate · POST-MVP

**Concern:** Templates with day assignments auto-populate new weeks when active.

**What ships:**
- `isActive` toggle on templates (in library UI — a switch or similar).
- When viewing a future/current week that has no manual placements yet, active
  templates with day assignments auto-populate their days. These appear as
  planned items (same visual as Pass 3).
- Deactivating a template removes it from future auto-population but doesn't
  delete past placements or the template itself.
- User can manually remove or rearrange auto-populated items on any week (they're
  just planned-session records, same as manually placed ones).

**Verify bar:** Create "Push Day" assigned to Monday, "Pull Day" assigned to
Wednesday, both active. Navigate to next week → both appear on their days. Deactivate
"Pull Day" → next week only shows Push Day on Monday. Can remove auto-populated
items from a specific week without affecting the template. tsc 0, all tests pass.

---

### Pass 5 — Cadence goals (benchmarks integration) · POST-MVP

**Concern:** "Run 3×/week" cadence counters in the week view, using the benchmark
system.

**Depends on:** Phase 5 (benchmarks entity) being built, OR building a lightweight
cadence counter that the benchmark system later absorbs.

**What ships:**
- Cadence goals as process benchmarks: freeform text ("run 3×/week") resolved to
  activity + frequency via keyword mapper.
- Week view shows cadence progress: "2 of 3 this week" — a factual count, not a
  streak. No flame, no celebration, no loss-aversion on miss.
- Any logged session matching the activity counts toward the cadence (including
  sessions from placed templates — a placed run that gets logged counts as 1
  toward "run 3×").
- Create cadence goal from the Training tab (contextual benchmark creation —
  resolves the `benchmarks-spec.md` open question).

**Open questions to resolve before this pass:**
- Active cadence cap (how many at once).
- Double-count bookkeeping (a placed run counting toward cadence — once,
  presumably, but needs stating).
- Hybrid density (where cadence counters sit visually in the week view).

**Verify bar:** Create "run 3×/week" cadence. Log 2 runs this week → counter shows
"2 of 3." Log a 3rd → "3 of 3." No celebration. Miss a week → counter resets
without drama. tsc 0, all tests pass.

---

### Pass 6 — Mid-session modification + "update template?" · POST-MVP

**Concern:** During a planned session, the user can deviate from the template (add
a set, change weight, skip an exercise). At the end, they're asked whether to
update the template or keep it as a one-off.

**What ships:**
- During a planned session, the form is editable (it already is — this is about
  tracking what changed relative to the template).
- On "Finish," if the session deviated from the template: a prompt — "Your session
  differed from [template name]. Update the template to match, or keep this as a
  one-off?" Two clear choices, no judgment.
- "Update template" writes the new shape back to the SessionTemplate.
- "One-off" logs the session as-is; template unchanged.
- If no deviations, no prompt — just finish normally.

**Verify bar:** Start a planned "Push Day" session. Change weight on one exercise,
skip another. Finish → prompt appears with both options. "Update template" →
template reflects the changes. "One-off" → template unchanged. No prompt when
session matches template exactly. tsc 0, all tests pass.

---

### Pass 7 — Planned-vs-actual in session detail · POST-MVP

**Concern:** When viewing a completed planned session, show the drift between plan
and reality as raw facts.

**What ships:**
- Session detail view (existing) shows planned-vs-actual when a `templateId` is
  present: "Template: 5×5 @ 225 · Actual: 5, 5, 4, 3, 3 @ 225."
- Factual display only. No score, no percentage, no color-coding that implies
  good/bad.

**Verify bar:** View a completed planned session → drift shows as facts. No
scoring. Sessions without a template show no drift section. tsc 0, all tests pass.

---

### Pass 8 — Route entity (GPS routes as separate saveable thing) · POST-MVP

**Concern:** Saved GPS routes as a separate entity that templates can reference.

**What ships:**
- `Route` entity: `id`, `name`, `activity` (run/kayak/hike/etc.), `distance`,
  `notes`, `createdAt`. (GPS coordinate data deferred until wearable sync — for
  now a route is name + distance + notes, same fidelity as manual GPS logging.)
- Routes browsable in the library (a section or tab alongside templates).
- A GPS template can reference a route (optional). When logging from that
  template, the route's distance pre-fills.
- Create route standalone or from a completed GPS session ("save this as a
  route").

**Verify bar:** Create a "Park run" route (5k). Create a "Park run" template
referencing it. Place on a day, tap to log → distance pre-fills from route.
Also create a route from a completed run session. tsc 0, all tests pass.

---

## Summary: MVP vs post-MVP

| Pass | What | MVP? |
|------|------|------|
| 1 | SessionTemplate entity + library CRUD | ✅ MVP |
| 2 | Week view (7-day strip) | ✅ MVP |
| 3 | Placement + planned path | ✅ MVP |
| 4 | Active/deactivate + auto-populate | Post-MVP |
| 5 | Cadence goals (benchmarks) | Post-MVP |
| 6 | Mid-session modification + "update template?" | Post-MVP |
| 7 | Planned-vs-actual in session detail | Post-MVP |
| 8 | Route entity | Post-MVP |

**MVP = Passes 1–3.** After those three, you can create training shapes, see your
week, place a plan on a day, and tap to log against it. The core loop works.
Everything after enriches it.
