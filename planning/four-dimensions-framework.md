# The Four Dimensions — Earth, Sky, Water, Body

*Captured 2026-07-04, from a live design conversation (map-color mockup → element taxonomy →
positioning strategy → world map → privacy). Integrated into the constitution 2026-07-04 —
see `claude-md.md` § The four dimensions and `dev-log/four-dimensions-pass-1.md`. This
document remains the full "why" behind that section.*

---

## The positioning insight this grew out of

The product can't out-Strava Strava for road running or out-Garmin Garmin for device
integration — that's not a feature gap, it's structural (network effects, a decade of
segment data, device partnerships). But `sport-mapping-research.md` already found the actual
opening: paragliding, whitewater, skiing, wing/kite have **no dominant incumbent** — they're
fragmented across niche single-sport apps that never talk to each other. Strava is
sport-specific-social-network-shaped; it can't follow anyone into "one coherent view of
everything they do." The four-dimension frame is the wedge — a shape only a life-mirror
product can occupy, not a feature Strava could bolt on.

## The core idea

Every training session is training **one of four dimensions**, not one of dozens of sports:

- **Earth** — traversing ground. Hiking, trail/road running, MTB, cycling, climbing.
- **Sky** — traversing air. Paragliding, wingfoiling, skydiving.
- **Water** — traversing water. Kayaking, surfing, swimming, SUP.
- **Body** — building/maintaining the instrument itself, independent of location or terrain.
  Gym, yoga, PT, breathwork, mobility, calisthenics.

The generative rule for Body vs. the other three: **Earth/Sky/Water are the domain you move
*through*; Body is anything where the point is the instrument, not the terrain.** Gym and
calisthenics were previously (in the Notion training database) tagged `Earth` simply because
they're "ground-based" — that was never reasoned through. Under this rule both reclassify to
`Body`: gym and calisthenics are infrastructure for the other three, not travel through earth.
*(Actioned: both rows updated in Notion as part of capturing this document.)*

**This is a lens, not a taxonomy exercise** — it's meant to be the organizing question the
whole product asks: *what dimension are you training?*

## The line that must hold: mirror, not mechanic

This is the one thing a future session must not get wrong, because the pull toward it is
strong and the framing (four elements, an expanding world) sounds exactly like a game even
when it isn't one.

**In: the four dimensions as a descriptive lens.**
- Reflect shows your actual mix — "you trained Water three times this week" — a true sentence
  about what happened.
- Brand voice, marketing language, visual identity built around the four dimensions.
- A route/session is *tagged* with a dimension. That's categorization, not scoring.

**This flag stands once, not forever.** Raising it here is the constitution's own
"stop and flag, don't quietly reinterpret" rule doing its job — but the flag isn't a veto.
If the person building this considers the tension and overrides it deliberately (not just
brushes past it), that override stands. The point of flagging is to prevent silent drift into
gamification, not to relitigate a decision already made with eyes open. See the session
prompt for the matching amendment to the constitution's own flagging rule.

**Out: the four dimensions as a mechanic.**
- No mastery levels, no percentage-complete-per-element, no defined threshold for "mastering"
  a dimension.
- No unlockable content gated behind that mastery.
- Nothing that defines what "success" looks like per dimension — that's the user's own
  benchmark, never the app's.

This maps directly onto two of the constitution's existing reject-tests: *"Does this reward
the user with anything that doesn't already exist in the world?"* and *"Does this define what
'success' means for the user?"* A mastery/unlock system fails both. A descriptive dimension
mix fails neither — it's just true sentences about real data, in good language.

**The "expanding world" feeling can still exist, honestly.** A personal geographic heatmap —
built the way `mapping-systems-research.md` documents Strava's own heatmap pipeline working —
fills in because the user actually went places, not because they cleared a threshold. Same
emotional payoff (a globe that grows), zero gamification, because it's a mirror of a real fact
rather than a reward for one.

## Archetype per dimension (brand voice, not a data restriction)

The underlying data bucket for each dimension stays fully inclusive (a road run is Earth, same
as a trail run — they already share one GPS logging surface in `session.ts`). But brand
voice/imagery/onboarding language is stronger when anchored to one vivid, archetypal sport per
dimension rather than trying to represent every included sport equally:

- **Earth** → trail running, mountain biking (dirt, forest floor — not the generic road run)
- **Sky** → paragliding, wingfoiling
- **Water** → kayaking (or surfing)
- **Body** → gym / the practice room

This is purely a voice/imagery choice layered on top of an inclusive data system — it must
never fragment the underlying bucket (no separate "road running doesn't count as Earth" logic
anywhere).

## Applications

**Reflect (Ring 3-ish, descriptive):** a real, honest breakdown of training time/effort across
the four dimensions — the dimension-mix view. Purely a mirror.

**The world map (Ring 4 — extends `gps-mapping-spec.md`'s existing cohort-map section, doesn't
replace it):** friends' activity on the shared map filterable by dimension; routes discoverable
per-dimension. Still governed by that spec's existing rules — pull-based, never real-time
location (that stays a separate, later, explicitly-safety-framed feature), privacy zones
before anything is cohort-visible.

**Body renders with no geo-pin at all — dotted/pulse, never a line on the shared map.** This
isn't a style choice, it's a privacy resolution: `gps-mapping-spec.md` already calls privacy
"the hardest line in the app" and requires privacy-zone masking before any route is
cohort-visible. Body sessions mostly happen at fixed indoor locations (home, a gym nearby) —
they were never going to be safe to pin, and under this framework they don't need to be,
because Body was never about geography. *"Inner work that helps you when you go out and
explore the world"* — Body supports the other three; it doesn't compete with them for map space.

## Open question (not resolved here)

**"Each route is tied to something"** — routes on the world map link to *something* beyond
just a dimension tag (a place, a story, a challenge, a chain of routes?). Not pinned down yet;
surface it explicitly when the world-map feature is actually specced (Ring 4).

## Cross-references

- `sport-mapping-research.md` — the fragmented-niche-sports positioning finding this grew from.
- `gps-mapping-spec.md` — the existing Ring 4 cohort-map section and the privacy "hardest
  line" rule this extends, not replaces.
- `brand-kit-gorge-draft.md` — the color mockup (ochre/blue/teal/orange-red per dimension) that
  sparked this; that draft's color section should be read alongside this doc.
- `mapping-systems-research.md` — the Strava heatmap pipeline the "personal globe" idea reuses.
