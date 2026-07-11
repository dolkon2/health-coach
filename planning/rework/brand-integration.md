# Brand / Design Integration — token-migration mechanics (rework track)

**Status:** planning spec, 2026-07-11. Part of the coordinated rework set under `planning/rework/`.
**Scope guard (locked #13):** the rebrand itself — the Columbia River Gorge kit (Archivo / Space Grotesk / Space Mono / DM Sans; Earth `#8A7049`, Sky `#5E84A6`, Water `#4C8E85`, Body `#C15A39`) — is **in flight in parallel, owned by the user**. This spec plans the *mechanics* that make the eventual swap a single-PR mechanical change. It picks **no final visual values**. Every hex in this document is either the shipped placeholder system or a quotation of the user's in-flight draft, never a decision.

---

## 1. Purpose & constitution alignment

This track exists so that when the user's Gorge kit lands, it drops into the app as one mechanical pull request instead of a 40-file archaeology dig — and so the tab reworks that need dimension colors *now* (Home's element picker, Map's record context, Training's element headers) aren't blocked waiting for it. Constitutionally this is quiet work: the brand kit already encodes the product's honesty rules as visual law (fidelity shown by opacity+stroke, tier-3 visually demoted below tier-1, "earth not traffic lights"), and none of that changes here — the gorge draft's own "what this draft does NOT touch" list confirms spacing/radius/shadow/motion/fidelity/tier rules port forward untouched. The one constitutional connection that is new: the four dimension colors become first-class tokens, which makes the Earth/Sky/Water/Body lens (constitution § four dimensions) renderable as *description* (tags, picker rows, mix views) — never as mastery levels, scores, or any surface that colors "success."

## 2. Information architecture — where the design system lives

The system is already well-shaped; this track hardens it rather than rebuilding it:

- **`src/theme/tokens.ts`** — single source of visual truth: `darkColors` / `lightColors` (identically typed), `fidelity` opacities, `fonts`, `type` scale (ready-to-spread RN TextStyles), `spacing`, `radius`, `shadow`, `motion`. Its header comment says it "mirrors planning/brand-kit.md" — that pointer goes stale the day the kit lands and is updated in the swap PR.
- **`src/theme/fontMap.ts`** — the expo-font preload map; keys must match the `fontFamily` strings in `tokens.fonts`. This is the entire font-loading seam.
- **`src/theme/ThemeProvider.tsx`** — context + `useTheme()`; dark default, light secondary, one-line scheme switch by design.
- **Consumers** — every screen/component reads via `useTheme()`. Verified 2026-07-11: **zero raw hex, rgba, or named-color literals exist anywhere in `app/` or `src/` outside `tokens.ts`** (only `'transparent'`, which is exempt, plus a test fixture JSON). The discipline is good.

The real coupling problem is one level up: **95 references across 40 files bind to palette *proper nouns*** (`theme.colors.sandstone` / `.olive` / `.clay` / `.slate`) instead of semantic roles. Heaviest: `app/log-food.tsx` (11), `app/log-session.tsx` (8), `app/edit-template.tsx` (7), `app/edit-benchmark.tsx` (6), `src/components/StimulusLedger.tsx` (6), `src/components/surface/GymExerciseEditor.tsx` (6), `src/components/Button.tsx` (4); plus load-bearing singles — `app/(tabs)/_layout.tsx` (`tabBarActiveTintColor: theme.colors.sandstone`), `src/components/RouteMap.tsx` (GPS trace `lineColor: theme.colors.sandstone`), `FidelityIndicator` (segmented bar fill). A palette swap today would either keep desert names pointing at gorge values (incoherent) or rename keys across 40 files inside the rebrand PR (not mechanical). Hence Pass 1.

### Token naming map (old → new)

Retire exported proper nouns; export semantic roles. The mapping follows the jobs `brand-kit.md` already assigns:

| Old exported key | New semantic key | Job (unchanged) |
|---|---|---|
| `sandstone` | `accent` | Primary accent: CTAs, active tab, fidelity-bar fill, GPS trace (until element-colored) |
| `olive` | `positive` (already exists — consumers converge on it) | Positive trends, completed states |
| `clay` | `caution` | Warnings, fidelity-low indicators |
| `slate` | `modeled` | Tier-3 demotion, secondary charts |
| `trendLine`, `positive`, `negative`, `neutral`, ground & text keys | unchanged | already semantic |
| *(new)* | `element: { earth, sky, water, body }` | Dimension colors — picker rows, dimension tags, element headers, per-element map lines |
| *(new)* | `chartSeries: [1..4]` | Multi-series order (today: trendLine/sandstone/clay/slate per brand-kit) — de-proper-nouned |

Proper nouns may survive as **private** consts inside `tokens.ts` (a palette table the semantic keys point at) but are never exported again. After Pass 1, the Gorge swap touches values in one file.

Decision (obvious call): the token group is named `element` — **singular, and that spelling is normative for every consumer spec** — with record keys the exact literals of `Element` in `src/lib/activity.ts` (`'body' | 'earth' | 'water' | 'sky'`), so `theme.colors.element[elementOf(activity)]` works with no mapping layer. (Several consumer drafts wrote `elements`/`theme.colors.elements[...]`; those references should be corrected to the singular — a plural key will never exist.)

Decision (obvious call): until the kit lands, `element` ships with **placeholder values drawn from the existing palette** (e.g. earth→clay, sky→slate, water→olive, body→sandstone) so no new hex enters the codebase and element-consuming UI can build now. Placeholders are throwaway by declaration — a comment in `tokens.ts` says so — and are replaced wholesale in the swap PR.

## 3. Components & states

- **ThemeProvider / useTheme** — unchanged contract. `lightColors: typeof darkColors` is the invariant that keeps light mode compilable; the swap must preserve it.
- **Font loading** — `fontMap.ts` consumed by `useFonts` at app root; the app gates render until fonts resolve. States: *loading* (splash holds — unchanged), *error* (a failed face falls through to the `useFonts` error path; keep the existing gate rather than per-face fallbacks, since RN has no CSS-style font fallback chains). The swap replaces the three `@expo-google-fonts/*` packages with the four Gorge families; the loading behavior itself doesn't change.
- **Dark-theme baseline** — dark is and stays the default (`initialScheme='dark'`; brand-kit posture; OLED-friendly warm charcoal ground, which the gorge draft explicitly keeps). Light remains a Settings toggle. Baseline rule for this track: **every pass must leave both palettes typed and populated** — no dark-only token may exist even provisionally.
- **Fidelity & tier visualization** — `FidelityIndicator`, `FidelityTreatment`, `WeightTrendChart` band/stroke rules, `StimulusLedger` demotion styling: all re-point automatically once they read `accent`/`caution`/`modeled` instead of proper nouns. No behavior change.
- **Element-colored components (new consumers, built by other tracks):** Home element-picker rows; dimension tag chips (Training logbook entries → Profile → Social feed cards); Training `elementSections()` headers; Map record-mode armed-sport chrome and (post-kit, if the user confirms the gorge draft's element-palette-as-brand-palette unification) route lines by element. Empty/loading states of those components belong to their own specs; this track only guarantees the token exists in both schemes from Pass 2 onward.

## 4. Data touchpoints

None of substance — this is the track's virtue. Theme scheme preference lives in the existing settings KV (`appSettings`, migration 009); no new tables, **no migrations** (the 015/016 reservations for spots/routes are untouched). The `Element` type and `elementOf()` mapping live in code (`src/lib/activity.ts`), not storage. Fonts arrive as npm packages bundled at build time — no asset pipeline or OTA concern beyond a normal release. Nothing here touches observations, tiers, or fidelity *values*; only their rendering.

## 5. Interactions & cross-tab flows

This track originates no navigation; it is consumed by the flows other specs own. Verbatim anchors it must serve:

- Locked #6: "Log Session (Home log bar) opens an Earth/Sky/Water/Body element picker; Earth/Sky/Water rows lead with most-recent activity, route to Map Record with sport armed; Body routes to Training template/session selection." The four rows are the first UI whose identity *is* the element tokens — they must exist (placeholder values acceptable) before that picker builds.
- Locked #7/#8: Map Record mode and the route builder inherit `accent` for traces today; element-colored lines are a post-kit option, contingent on the ⚑ unification question below.
- Tab bar: active tint moves `sandstone` → `accent`; the 5-tab shell (locked #1) needs no other brand work to land.
- Dimension tags ride logbook entries onto Profile and thence the Social feed (locked #3) — the tag chip should be built once, against `element`, and reused.

## 6. Build passes

**Pass 1 — Semantic indirection sweep (M, shippable now, pre-rebrand enabling work).**
Add `accent`/`caution`/`modeled` (+ `chartSeries`) to both palettes in `tokens.ts` pointing at current values; migrate all 95 proper-noun references across 40 files; stop exporting `sandstone`/`olive`/`clay`/`slate`. Zero visual diff by construction (same hex behind new names). Acceptance: `grep -rE 'colors\.(sandstone|olive|clay|slate)\b' app src` returns nothing; app renders identically.

**Pass 2 — Element tokens (S, shippable now; unblocks Home/Map/Training passes).**
Add `element: { body, earth, water, sky }` to both palettes with the declared-throwaway placeholder mapping; add a `DimensionTag` chip component (or bless one in the Home spec — coordinate, don't duplicate). Acceptance: element picker rows and tags can consume `theme.colors.element[...]` in dark and light.

**Pass 3 — Handshake contract + doc hygiene (S, shippable now).**
Write the swap-artifact contract (§ 7 checklist) into `planning/brand-kit.md` as a top banner that also marks the file **stale by declaration** (locked #13); banner `planning/brand-kit-gorge-draft.md` as superseded-in-part (its forest/river palette predates the user's current element hexes — see ⚑2); fix the `tokens.ts` header pointer. Pure docs.

**Pass 4 — The swap PR (M; blocked on the user's kit artifact).**
One mechanical PR when the artifact arrives: (a) install the four font packages (`@expo-google-fonts/archivo`, `space-grotesk`, `space-mono`, `dm-sans` — verify names/availability against the **installed** Expo SDK: package.json pins expo ^53 while `AGENTS.md` points at v56 docs; check at swap time, and fall back to bundled TTFs via `expo-font` `useFonts` static require if any face isn't published); (b) rewrite `fontMap.ts` + `tokens.fonts` with the artifact's register assignment; (c) re-derive `type` scale metrics (see ⚑5 — the one step that is judgment, not mechanics; timebox with side-by-side screenshots); (d) replace accent/semantic/element values in `darkColors` and `lightColors` from the artifact; (e) update doc pointers. Acceptance: no retired keys referenced; dark and light both render; screenshot pass over Home, Training, Nutrition, Settings, one chart, one map trace.

**Pass 5 — Post-swap QA + coordination sweep (S; after Pass 4).**
Light-mode audit screen-by-screen; contrast spot-check of element colors on both grounds; confirm fidelity/tier visual rules still read correctly in the new palette; hand the "does the MapTiler basemap style still match the brand mood" question to the Map spec (the gorge direction was *born* from the MapTiler Outdoor style — coordination, not ownership).

Passes 1–3 have no dependency on the user's kit and should run ahead of it; that is the entire point.

## 7. Dependencies

- **On the rebrand track (user, parallel):** Pass 4 is hard-blocked on the artifact defined below. Passes 1–3 are deliberately not.
- **Sibling specs consuming this track:** the Home spec (`planning/rework/tabs/home-tab.md` — element picker rows, glance-card styling), Map spec (`planning/rework/tabs/map-tab.md` — record chrome, trace/route colors), Training spec (`planning/rework/tabs/training-tab.md` — element section headers, template cards), Social spec (`planning/rework/tabs/social-tab.md` — feed-card dimension tags) all depend on **Pass 2**; none depend on Pass 4.
- **Explicit independences (Notion, 2026-07-10/11):** Nutrition v2 is "independent of the Gorge rebrand" — the Nutrition spec (`planning/rework/tabs/nutrition-tab.md`) must not wait on this track. Conversely the **Body-dimension backlog is deliberately sequenced *after* the Gorge redesign** (Dylan, 2026-07-09) — Pass 4 landing is what unblocks it.
- **On research/verification:** font package availability vs the pinned Expo SDK (Pass 4a); nothing else.

### The handshake — what the artifact must contain for the swap to be mechanical

1. **Colors, both modes.** A value for every semantic slot in `ColorTokens` (ground ×5, text ×3, `accent`, `positive`, `caution`, `modeled`, `trendLine`, `negative`, `neutral`) **plus the four element colors — in dark AND light variants.** Any omitted slot = "keep current value," stated explicitly.
2. **Fonts with register assignment.** Four families are named (Archivo / Space Grotesk / Space Mono / DM Sans) but the code has **three registers** (display / body / data). The artifact must say which family takes which register — and if a fourth register is being introduced (e.g. display vs. heading), define where it's used, since that's a `type`-scale schema change, not a value swap.
3. **Type scale.** Size / weight / line-height / tracking / case per variant, or an explicit "keep current metrics, retune tracking only." Barlow Condensed's metrics don't transfer to a grotesk; silent reuse would be a downgrade wearing new fonts.
4. **Unchanged-by-default list.** Spacing, radius, shadow, motion, fidelity opacities, tier rules are assumed untouched (per the gorge draft's own non-touch list) unless the artifact says otherwise.

## 8. ⚑ Flagged concerns (for Dylan)

- **⚑1 Artifact format — the required ask.** For Pass 4 to be scheduled: does the rebrand deliver **Figma tokens/variables export, a JSON token file, or a markdown kit** (the `brand-kit.md` convention)? Any of the three works *if it covers the § 7 checklist*; markdown-in-the-existing-structure is the lowest-friction since `tokens.ts` was hand-derived from that format once already. Just say which.
- **⚑2 The repo's gorge draft is older than the kit you cited today.** `planning/brand-kit-gorge-draft.md` has forest `#3F5A45` / river `#4A7A8C` / basalt / moss / mist, **no fonts section, and none of the four element hexes** you named (`#8A7049`/`#5E84A6`/`#4C8E85`/`#C15A39`). Meanwhile the Notion Brand Kit page is marked **Done but is completely blank**. Confirm: your cited values are the live draft, the repo file is superseded, and Notion is not an authority for any visual value. (Planned handling: Pass 3 banners the repo file; nothing treats either as final.)
- **⚑3 Element palette = brand accent palette?** The gorge draft's "free win" proposed unifying them (Earth green doubles as the hero accent, route lines colored by element). Your four element hexes plus four fonts suggest the kit may keep them unified — but `accent` (CTA/active-tab, sandstone's old job) needs a named successor either way. If unified: which element (or neutral) takes the CTA job? If separate: one more color in the artifact. This shapes what Pass 1's `accent` ultimately points at.
- **⚑4 Light mode coverage.** If the kit arrives dark-only, the swap cannot be fully mechanical: `lightColors` must hold *something* typed identically. Options — (a) kit includes light values (preferred), (b) dark-first swap shipping old light values temporarily (incoherent but honest, behind the existing default-dark), (c) mechanical derivation (risky, un-designed). Your call belongs in the artifact.
- **⚑5 Type-scale retune + the uppercase rule.** Condensed→grotesk cannot be value-for-value; and "display is *always* uppercase with tracking" is a Barlow-era voice rule that Archivo may or may not want to keep. Flagging that Pass 4c involves ~a screenshot-judgment session with you, not silent token math.

## 9. Open questions

1. Token key naming: `element` (matches `src/lib/activity.ts`) vs `dimension` (matches the constitution's language). Cosmetic; Pass 2 proposes `element` for zero-mapping code, rename is a one-file find-replace if the constitution word is preferred.
2. Who owns app icon / splash / store assets? Outside `tokens.ts` and this spec — presumably the rebrand track; noting so it isn't dropped between tracks.
3. Does `chartSeries` ordering change under the new palette (current order: trend-sage, gold, terracotta, slate)? Artifact can specify or default to positional re-pointing.
4. Should the GPS trace color become element-colored at swap time or stay `accent` until the Map Explore/layers design settles? Leaning: stay `accent`; revisit inside the Map spec once ⚑3 resolves.

*Cross-references: sibling tab specs under `planning/rework/tabs/`; current shipped values in `src/theme/tokens.ts`; stale kits `planning/brand-kit.md` and `planning/brand-kit-gorge-draft.md` (both bannered by Pass 3).*
