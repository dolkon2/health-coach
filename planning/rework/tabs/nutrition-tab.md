# Nutrition tab — consolidated build spec

v1 — 2026-07-11. Part of the coordinated rework set under `planning/rework/tabs/`.
Consolidates `nutrition-tab-plan.md` (locked 2026-06-28; Passes 1–2.5 built),
`food-logging-spec.md` (v0.2), `phase-5-pass-2-6-nutrition-benchmarks.md` (unbuilt),
`planning/rework/research/nutrition-ux.md` (2026-07-11), the Notion Nutrition
resolutions (spec session 2026-07-10), and Dylan's locked decision #10 of 2026-07-11:
**"Nutrition tab: Intake/Trend split plus a single-metric 'Focus mode'; targets are
self-set only — the app never prescribes them."** Where this file and any older
Nutrition text disagree, this file wins. (⚑3: Notion names a
`nutrition-tab-v2-spec.md` as authoritative, but that file exists in no branch we hold
— see § 8.)

Sibling specs referenced: `home-tab.md`, `training-tab.md`, `map-tab.md`,
`social-tab.md`, `profile-settings.md` (all under `planning/rework/tabs/`).

## 1. Purpose & constitution alignment

Nutrition is the depth room for intake: the surface where food facts enter and are
edited, and the surface where their consequences are read. The locked Intake/Trend
split is itself a constitutional statement — **Intake holds tier-1 facts and their
entry/edit affordances; Trend holds everything windowed, derived, or modeled** (the
tier-2 weight trend, the tier-3 energy balance with its error band), so a modeled
value structurally *cannot* headline the fact surface (the research note's one
explicit rejection of MacroFactor's layout). Targets exist only because the user wrote
them down: self-set, adherence-neutral (over/under is a position, not a judgment — no
red, no praise, no "you went over"), never auto-adjusted, and "no target" is the
default state, not a degraded one. Focus mode is a lens, never a gate — full macros
are always captured regardless of what the user chooses to look at
(`food-logging-spec.md` invariant; the expenditure engine depends on it). Null ≠ 0
everywhere; fidelity renders as a visual tier, never a number; no streaks, nags, or
completion theater anywhere in the tab.

## 2. Information architecture / layout

One tab, two top-switched sub-surfaces (paralleling Social's Feed/Groups switch):

**Intake** — the fact surface (default landing; Decision (obvious call): always land
on Intake — logging is the primary loop, and the switch is one tap):

1. Day navigation: the shipped `DayNavHeader` + `WeekStrip` (Option-C hybrid, in-tab
   local state — unchanged from the built Pass 2).
2. **Target-status card** (new, only when a target exists): the three-valued day
   engine (hit / missed / unknowable), consumed-of-target primary, remaining
   secondary. This is the component Home's nutrition-today card reuses — build once,
   here (`home-tab.md` § 4).
3. Daily totals card (shipped: Cal/P/C/F, honest nulls, partial note).
4. Meal list (shipped `DayMealList`: per-item breakdown, tap-to-edit, inline
   per-item delete, swipe-to-delete, fidelity dot + opacity).
5. In-line adherence-benchmark progress line (new, with the target — today's standing
   only; full history location is genuinely open, ⚑1).
6. Saved-meals management + Log food (shipped; hidden on past days, `?date=` backfill
   via the Pass 2.5 logger date picker).

**Trend** — the interpretation surface:

1. **Weigh-in entry + `WeightTrendChart`** — the chart's home was resolved here
   2026-07-10 (it currently renders on Reflect, which dissolves; see
   `profile-settings.md`). Weigh-in lives here, not on the Home log bar (locked
   during the Home session; `home-tab.md` § 2).
2. `ExpenditureCard` — measured TDEE with confidence (shipped; today it sits on the
   Intake-equivalent screen and moves here).
3. Energy-balance history — intake vs. expenditure per window, error band +
   confidence-gated rendering (old plan Pass 3 material, completed here).
4. Intake-over-time charts (Cal/macros, custom SVG in the house chart idiom — old
   plan Pass 4, unbuilt).

**Focus mode — the flagship.** The user picks **one metric** (canonical case: a GLP-1
user, protein-only), normally in the same gesture as target setup, and the whole app
surfaces that number alone: meal rows, daily rollup, target-status card, the logger
hero, and Home's nutrition-today card. Everything else stays one tap away (History and
Trend can always show the full set on request), and **capture never changes** — full
macros are always written underneath. Dylan expects Focus could become the majority
mode over time; it must feel first-class, not a lite mode. It composes with targets
(a protein-focus user with a self-set protein target gets the same adherence-neutral
consumed-of-target rendering, single metric) and it survives the honesty rules (a
focused metric with a null value renders unknown, never zero). Decision (obvious
call): no dedicated GLP-1/medication framing anywhere — focus + self-set targets +
low-friction logging cover the case descriptively. Decision (obvious call): Focus is
settable *without* any target — the Cronometer hide-calories precedent, including the
eating-disorder-adjacent case where not seeing calories is the healthy configuration.

**Meal planning scope** (resolved 2026-07-10): exactly "log tomorrow's meal today via
a saved meal" — the shipped logger date picker already covers it. No planner, no
plan-ahead grid, ever.

## 3. Components & states

**Top switch (Intake / Trend)** — plain two-segment control under the tab title. No
data dependency. State resets to Intake on tab re-entry.

**Target-status card** — renders the three-valued day engine. States: *no target* →
absent, not empty (no "set a goal" affordance chasing the user — same rule as Home's
optional modules); *unknowable* (nulls in the day's logs make the target undecidable)
→ says so plainly, never resolves to hit or missed; *hit/missed* → same visual weight
either way, no judgment colors. Focus-aware: in Focus mode it shows only the focused
metric's line. Loading: local read, renders synchronously with cached day data.

**Daily totals + meal list** — shipped, unchanged structurally. Empty day → the
existing empty card (no fake zeros). **Fidelity display**: three tiers only (HIGH
full-opacity solid · MID 0.7 hollow · LOW 0.45 dashed), never a number. Decision
(obvious call, from research § 3): provenance detail ("USDA lookup, weighed" /
"estimate") becomes visible **one tap deep in the item editor** where the row is
already editable — exposure of existing source tags, no new capture, no labels in
list views.

**Focus lens** — a display setting. When set: single-metric rendering across the tab
per § 2; a small "showing protein — see all" affordance keeps the full set reachable
in one tap. When unset: standard display with calories leading (the shipped
`nutritionFocus` default). Error states: none (pure display).

**Expenditure / energy balance (Trend)** — confidence rendered twice, honestly: the
explicit error band *and* the tentative visual treatment (the fidelity grammar's
opacity/stroke steps), both expressed as tokens. Insufficient data → "we don't know
yet" as a first-class state, never a fabricated number; low confidence reports low.
Null-intake days are excluded from windows, never zero-filled.

**Trend charts** — honest empty states; gaps render as gaps.

**Logger (`log-food.tsx`)** — shipped and not rebuilt here: search-and-weigh
(USDA/OFF), Describe (LLM extraction + v0.2 direct estimation, provenance `estimate`,
fidelity capped LOW–MID, keyless regex fallback), **barcode + label scan (shipped —
see § 4)**, saved meals row, date picker. Priority order stands: recents/saved →
describe → barcode → search; photo stays schema-reserved (the ~11 s / ~68 % ID / ±22 %
portion field numbers externally validate the deferral). Camera permission-denied and
offline states already handled in the shipped surface.

## 4. Data touchpoints

**Shipped (Ring 2 + follow-ups — the tab reuses, does not rebuild):** `foodEntry`
observations with `items[]` and null-honest macros; `meal_templates` (003/004);
`cached_foods` (002); weigh-in observations; the expenditure engine reading day-keyed
intake + weigh-ins; the three-valued day engine (`core/src/nutrition/days.ts`);
fidelity model + capture tiers; USDA/OFF adapters (free-only covenant intact);
`appSettings.nutritionFocus` in the settings KV (`'calories' | 'protein' | 'carbs' |
'fat'`, display-only, currently consumed only by the logger hero).

**Barcode 2.7 status correction:** the plan's "still gated on a native scanner dep"
line is **stale — barcode shipped**. `expo-camera` (~16.1.11) is installed;
`log-food.tsx` runs `CameraView` scanning with keyless OFF resolution
(`resolveBarcode`) plus a nutrition-label scan mode. Nothing to build; the research
note's 1–3 s resolution floor stands as the acceptance benchmark to hold.

**New, this spec:**

- **Focus lens**: extend the existing settings-KV display setting from "hero macro"
  to "focus lens" (metric + on/off). Display-only; no migration; never touches
  capture. Fiber joins the metric union only after fiber pull-through lands (below).
- **Targets + adherence benchmark**: targets are **not** a separate store — a target
  *is* the behavior face of a nutrition benchmark, created in one gesture
  (2026-07-10 resolution). The shapes are `phase-5-pass-2-6-nutrition-benchmarks.md`
  as written (two picker options — *Nutrition target* with bundled daily-implicit
  fields + optional bodyweight outcome, and *Log food plainly* — plus
  `nutritionTargets` dimension, `nutritionDay` measure, `share.minTier` T1 widening,
  `status: 'archived'`, fiber pull-through in the USDA/OFF adapters), with one
  correction: **its "M010" migration number is stale — renumber the soft-archive
  migration to 017+** (010–013 are burned; 015 is reserved for `spots_sport`, 016 for
  `routes`). The pass-2.6 suggestion engine stays prefill-only and user-summoned
  (they tap Compute) — the one sanctioned door to a computed number, and it enters as
  an editable form value, never persists as the app's opinion.
- **No new tables** for the tab itself; everything else is read-models over existing
  stores. Energy balance is derived on read, never stored; nothing here writes a
  tier-3 value over a tier-1 one.

## 5. Interactions & cross-tab flows

- **Home log bar → Log Food → existing nutrition logger** (routing specced in
  `home-tab.md` § 5; locked #6 covers only the Log Session element-picker routing).
  Done — no change.
- **Home nutrition-today card** → tap lands on Nutrition **Intake**; the card reuses
  this tab's three-valued day-engine target-status component and respects Focus (a
  Focus-mode user sees their one metric there, nothing else). Contract owned here;
  consumption specced in `home-tab.md` §§ 3–4.
- **Weigh-in** → lives on Trend (button + edit path via the existing
  `log-weigh-in` modal). Home shows no weigh-in card and no Log Weight button
  (`home-tab.md`); the shipped Today-screen weigh-in card retires with the Home
  rework.
- **Backfill/plan-ahead logging** → tapping Log food from a non-today day passes
  `?date=` (shipped Pass 2.5).
- **Adherence benchmark** → created in the target gesture; appears as today's
  standing in-line on Intake; benchmark management/detail flows live with the
  benchmarks surface (see `training-tab.md`; the type-field and list-layout questions
  are locked-open #12 and nothing here assumes a `type` column). **Where the full
  hit-rate history renders is genuinely open — ⚑1.**
- **Summoned coach** (Ring 3b) may propose a target or an adjustment **only when
  asked**, entering as an editable prefill the user saves or discards — never
  auto-applied, never a drift notification. If measured expenditure drifts from what
  a self-set target assumed, that is Trend-side information the user can *see*; the
  app never touches their number.
- **Reflect dissolution intake**: this tab receives `WeightTrendChart` + expenditure
  interpretation from the retiring Reflect tab (coordination in
  `profile-settings.md`). The Stimulus Ledger goes to Settings (locked #2), not here.

## 6. Build passes

Ordered; each independently shippable. Matches the Notion V2 sequencing. N1 can land
on the current 4-tab shell; nothing below blocks on the 5-tab swap.

- **N1 (M) — Intake/Trend split + relocation.** Add the two-segment switch; move
  `ExpenditureCard` off the fact surface onto Trend; bring `WeightTrendChart` +
  weigh-in entry over from Reflect; Trend renders shipped pieces only (charts wait
  for N4). Intake = the existing day view unchanged. Pure relocation + shell; no
  storage work.
- **N2 (L) — targets + adherence benchmark + status card.** Implement
  phase-5-pass-2-6 (data model, form, one-gesture creation, soft-archive migration
  renumbered 017+, fiber pull-through), then the Intake target-status card on the
  three-valued day engine with adherence-neutral rendering + in-line progress line.
  Exports the status component for Home (H2 consumes it).
- **N3 (M) — Focus lens.** Extend the KV setting; single-metric rendering across
  meal rows, totals, target card, logger hero; "see all" tap-out; Home-card contract
  honored. Display-only — a settings write, zero capture changes.
- **N4 (M) — Trend completion.** Intake-over-time charts (custom SVG, house idiom);
  energy-balance history with error band + confidence-gated rendering; honest empty
  states throughout.
- **N5 (S) — provenance tap-through.** Expose source detail in the item editor
  (exposure of existing tags only). Cosmetic, any time after N1.

Barcode requires no pass — shipped (§ 4); hold the 1–3 s floor if the scan path is
ever touched.

## 7. Dependencies

- **PRO-63 benchmarks→main merge**: Notion sequences Nutrition V2 after it; N2's
  data-model work builds on the benchmark faces (007/008) plus that branch's
  expenditure/TDEE state. N1 does not wait.
- **`home-tab.md`**: H2 consumes N2's target-status component and N3's Focus
  semantics; Home's removed weigh-in/meal-list content assumes N1's Trend home
  exists (interim: current tab suffices).
- **`training-tab.md` / benchmarks decisions** (locked #12): N2 must not assume the
  Outcome/Compliance/Trend `type` column or a list layout; it uses the existing
  two-faces model as pass-2.6 specifies.
- **`profile-settings.md`**: Reflect dissolution hands `WeightTrendChart` here; ⚑1's
  resolution may land a surface there instead of here.
- **Rebrand track** (locked #13): explicitly independent — the Notion resolution says
  so. One mechanic binds: confidence/fidelity rendering (opacity steps, stroke
  styles, the tier-3 reservation) must be expressed as **tokens** in
  `src/theme/tokens.ts`, not hardcoded colors, so the Gorge palette lands as a value
  swap. Mechanics only; no visual finalization here.
- **Research**: `nutrition-ux.md` is complete for this spec; no further research
  gates any pass.

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 Adherence-benchmark history location** (locked #12 — genuinely open, not
  decided here). In-line today-standing on Intake is enough for V2; the full
  hit-rate/consistency view over time needs a home. Candidates on the table:
  (a) the Trend side of this tab (a factual "days within your self-set band" overlay
  on intake trends — keeps the nutrition story in one room); (b) the benchmark
  surface / Reflect remnant (keeps all benchmark history in one idiom across
  domains); (c) Profile; (d) its own surface. Rendered as counts, never streaks,
  wherever it lands.
- **⚑2 Intake landing hierarchy when a target exists but Focus is off** (research
  ⚑8): lead with the four-macro totals card or with the target-status card? Both are
  constitutional; it's a tone call about whether a self-set target earns the top slot
  on the fact surface. Leaning facts-first with target-status directly beneath — but
  this is exactly the kind of call Dylan has overridden before, so flagged, not
  decided. (This spec's § 2 ordering shows target-status above totals per the Notion
  "target status" listing — confirm or flip.)
- **⚑3 `nutrition-tab-v2-spec.md` is missing from the repo.** Notion calls it
  authoritative for the 2026-07-10 session, but it exists in no branch extract or
  planning/ copy. This spec reconstructs it from the Notion summary + locked #10 +
  the research note. If the file surfaces, diff it against this one — decisions here
  believed complete, but unverifiable.
- **⚑4 Focus metric set.** The shipped union is calories/protein/carbs/fat; fiber
  becomes a plausible focus metric once N2 lands fiber pull-through (the GLP-1
  cluster treats protein/fiber/water as heroes). Include fiber at N3, or hold the
  union until asked? Small, but it shapes the Focus picker.

## 9. Open questions

- Focus entry points beyond target setup: a tab-level control, Settings, or both?
  (N3 assumes a small tab-level affordance; cheap to move.)
- Do Trend charts ever gain overlays (intake vs. weight vs. training) — deferred from
  the old Pass 4 "optional overlay later"; likely intersects the correlation engine
  when it lands.
- How aggressively energy-balance history confidence-gates early windows (render
  tentatively vs. withhold until threshold) — engine supports either; tone call.
- In-tab day navigation remains non-deep-linkable (accepted Pass 2 cost); revisit
  only if Home cards ever need to link to a specific past day.
- Whether the old "optional rough-total backfill prompt" for partial logs (explicitly
  deferred in food-logging-spec) ever ships — still deferred, recorded here so it
  isn't rediscovered as new.
