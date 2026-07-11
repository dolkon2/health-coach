# Rework Session 4 — Training landing skeleton + template library v2 (T1/T2)

**Branch/worktree:** `main`, `~/Projects/health-coach`. 1 commit, `be9bcc4..33fecf5`.

## What was built

Per `planning/rework/session-playbook.md` Session 4 and
`planning/rework/tabs/training-tab.md`, with Dylan's pinned answer:

- **Landing lead order, resolved differently than either proposed
  option:** rather than Start-first vs Library-first ordering inside
  the scroll, Dylan specified "Log Body Session" as a **persistent
  button anchored above the bottom tab bar**, not a section in the
  scroll. Tapping it browses Body-element activities freely, no
  template required. The scrollable area above it is recent-template
  chips → template library → Progress & tools. The same "Log ___"
  pattern is meant to repeat for the Routes shelf's own button at
  Session 9 (recorded as a code comment on the new `Screen` prop).

**T1 — Landing skeleton.** `Screen` gained a `footer` prop: a
non-scrolling row pinned to the bottom of the screen's own content
area (above the tab bar boundary), with extra scroll-content padding
so it never covers the last item. Training's old `elementSections()`
picker (all four elements + Snow Sports/More/Review trays) is gone
from the main scroll; in its place, the footer button opens a sheet
scoped to Body activities (gym, calisthenics, yoga, mobility, dance,
breathwork, pt) plus the Snow Sports and More trays. History stays
pinned at the bottom, completely untouched — T4's removal is gated on
Profile's logbook pass (Session 7's hard gate), per the explicit
instruction not to move it yet.

**T2 — Template library v2.** The library now renders inline on
Training instead of behind a separate `/templates` route: recent
templates as ≤3 chips (icon + element tint, last-used order via
`listTemplates()`'s existing `updatedAt DESC`), then the full library
with a search field (appears only at ≥10 templates), a new shared
`TemplateCard` (element-tinted activity icon, descriptive shape line,
a "repeats \<Day\>" recurrence chip when the template has an active
day assignment), and "+ New template". `describeTemplateShape` and
`activitiesForElement` were extracted to `src/lib` so Home, Training,
and `TemplateCard` share one source instead of hand-rolling their own
copies.

**The standalone `/templates` screen was removed.** Once the library
moved inline, `/templates` became fully redundant (same list, search,
cards) and nothing in the app linked to it anymore — confirmed via
`/code-review`'s removed-behavior finder. Its stale `Stack.Screen`
registration in `app/_layout.tsx` was also removed (was producing a
benign but real "No route named templates" warning in Metro).

**Recurrence chip, not a new recurrence field.** `session_templates`
already had `dayAssignment`/`isActive` (migration 005, Phase 6 Pass
1, previously unconsumed) — training-tab.md's "recurrence property"
ask is satisfied by *displaying* that existing single-day field as a
"repeats \<Day\>" chip, not by adding a weekday-set schema. Plain
decision, not escalated: the existing column is exactly what's
described, and inventing a multi-day array would need either a
migration or repurposing the INTEGER column's storage class for no
concrete ask yet.

## Code review

Ran `/code-review --fix` at medium effort (8 finder agents: 3
correctness angles, reuse/simplification/efficiency, altitude,
conventions). Four real issues survived verification and were fixed:

- **Template deletion had become unreachable (correctness, confirmed
  independently by the removed-behavior finder).** `/templates` was
  the only screen with swipe-to-delete for templates; once it was
  orphaned by the inline library, `deleteTemplate()` had no caller
  anywhere in the UI. Fixed by wrapping the inline library's
  `TemplateCard`s in `SwipeToDelete`, same idiom as History.
- **`RecentTemplateChip` hardcoded a dumbbell icon (correctness,
  confirmed independently by 4 of 8 finders)** instead of resolving
  the template's real activity/element like `TemplateCard` does — a
  climbing or run template showed a barbell in the chip row and its
  correct icon in the card below. Fixed to derive icon + tint from
  `activityById`/`elementOf`.
- **`BodyActivitySheet`'s content wasn't scrollable,** unlike the
  analogous `ElementPickerSheet`. With both Snow Sports and More
  expanded, the tile grid could exceed the sheet's 80% `maxHeight`
  with no way to reach the rest. Wrapped in a `ScrollView`; confirmed
  fixed on-sim (Snow Sports expand + scroll both work).
  {Sim-verified}
- **`Screen`'s new `footer` padding double-counted the safe area** —
  it added `insets.bottom` on top of the tab bar's own home-indicator
  reservation, since every current caller is a tab screen (not flush
  with the physical edge). Removed; documented that a future non-tab
  caller of `footer` would need its own inset.

Two findings noted and left as-is: `BodyActivitySheet` duplicates
`ElementPickerSheet`'s bottom-sheet chrome (backdrop + rounded surface
+ maxHeight 80%) instead of a shared primitive — a real "shared
BottomSheet component" case, but extracting it now would touch a file
outside this session's scope; and `TemplateCard`'s recurrence chip
re-implements `DimensionTag`'s bordered-pill styling instead of
reusing it — cosmetic, low value to fix mid-session.

## Verification

- `npx jest`: 112 suites / 1190 tests, all passing.
- `npx tsc --noEmit`: clean.
- **Sim-verified with real taps** (iPhone 17 sim, dev client, Metro on
  8081, computer-use driving the Simulator window directly). Confirmed
  live: Training tab renders the new layout (recent chips row when
  present, inline library with empty-state copy, Progress & tools
  links, Review tray, History unchanged, footer button sitting flush
  above the tab bar with no double-padding gap); tapping "Log Body
  Session" opens the sheet with exactly the Body activity set (Gym,
  Calisthenics, Yoga, Mobility, Dance, Breathwork, PT) plus Snow
  Sports (expand-and-scroll confirmed) and More trays; tapping Gym
  correctly launches `/log-session` pre-selected to Gym; creating a
  template ("Pro run", Run, repeats Wed) surfaces it immediately as
  both a correctly-iconed recent chip and a library card showing
  "REPEATS WED"; swiping the card revealed Delete, and confirming
  removed it from both the library and the recent-chips row. Metro
  log showed only the pre-existing require-cycle warnings (same ones
  Session 1–3 logs note) — no red-screen errors, and the stale
  "templates" route warning is gone after the `_layout.tsx` fix.

## ⚑ Flags raised

- **"Log Body Session" opens more than literally Body** (carries
  forward training-tab.md's own ⚑3, not a new flag). The button's
  sheet currently includes the Earth/Water Snow Sports and More trays
  alongside Body activities, because narrowing it to strictly Body
  would drop climb/pool-swim/snow-sport access from Training before
  ⚑3 (non-GPS Earth/Water routing) rules on their permanent home —
  Home's `ElementPickerSheet` expand already covers the same ground
  for Earth/Water/Sky, so this is redundant-but-not-lost, not broken.
  Narrow the sheet to Body-only once ⚑3 resolves.
- **`BodyActivitySheet` duplicates `ElementPickerSheet`'s bottom-sheet
  chrome.** Both hand-roll the same backdrop+surface+maxHeight Modal
  pattern. Worth extracting a shared `BottomSheet` primitive as its
  own small cleanup pass, especially since the Routes shelf (Session
  9) is about to want a third copy of the same "Log ___" + sheet idiom.
- **`TemplateCard`'s recurrence chip vs `DimensionTag`.** Two
  near-identical bordered-pill implementations now exist; a future
  chip-style tweak applied to one won't propagate to the other.
- **Recent-template "last-used" is really "last-edited."** `≤3 chips
  in last-used order` reads `listTemplates()`'s `updatedAt DESC`,
  which reflects the last *edit*, not the last time it was tapped to
  start a session. No `lastUsedAt` field exists yet — fine for now,
  but will read wrong once someone edits an old template and it jumps
  to the top of "recent."

## Explicitly NOT done / deferred

- **Routes shelf (§3 C / T3)** — not built, per the explicit
  instruction that it waits for Session 9.
- **History → Profile move (T4)** — not built; the hard gate (Profile
  logbook pass, Session 7) hasn't landed. History renders exactly as
  it did before this session.
- **T5 (Body deep-link scroll-to-start presentation)** — not built;
  Home's Body row still routes plainly to `/training` (unchanged).
- **T6 (3a/3b resolution + Sections)** — not built; genuinely open per
  locked #12, and out of scope for this pass regardless.
- **Template → session prefill / planned-vs-actual** — recent-template
  chips and library cards open `/log-session` with the activity
  pre-selected and `templateId` carried, but the logger doesn't read
  `templateId` yet (Pass 3/placement, unbuilt per training-tab.md).
  Same "ships interim" idiom Home already uses for its own routing.

## Status

Working tree clean (aside from `.claude/skills/` and
`planning/nutrition-tab-v2-spec.md`, both untracked and pre-existing —
untouched this session, same as Sessions 1–3 noted). Safe to leave
as-is. Metro left running on port 8081; sim left on the (now empty)
Training tab — the "Pro run" test template created during
verification was deleted as part of confirming swipe-to-delete works,
so no stray data was left seeded. Ready for Session 5 (Benchmarks
decision-proof passes + Pinned Spots on Home).

**Notion / memory sync — flagging for you:** the Notion "Active Work"
hub's Training row should move to "T1/T2 built (landing skeleton +
inline template library v2), T3/T4/T5/T6 pending." The `project_app.md`
memory file's health-coach entry is due for a refresh to record this
session's HEAD (`33fecf5`) and the flags above.
