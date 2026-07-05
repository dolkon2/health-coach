# Brand Kit v2 — Gorge Draft (exploration only)

> **STATUS: draft, not adopted.** `brand-kit.md` remains the live, authoritative kit. Nothing
> here is wired into the app. This file exists so a color/font direction can be reacted to and
> refined before any of it touches a real screen — capture the idea while it's fresh, decide
> later once more pages exist to design against (per the plan already agreed).

*Prompted by picking the MapTiler Outdoor style (contour lines) and wanting the map's basemap
mood — forest + river — to become the app's identity, not just the map's.*

---

## The actual shift, named honestly

The live kit's earth tones (sandstone gold, clay terracotta, olive sage on warm charcoal) read
as **high desert** — dry, warm, arid climbing-and-sun register. "The gorge" is a different
biome: **temperate rainforest and river** — Douglas fir, basalt cliff, glacial-green water,
diffused overcast light. This draft is that shift, not a small palette nudge. Worth deciding
deliberately rather than discovering it accidentally three files in.

What stays: the *posture* already fits — "trail map meets tide chart" and "climbs, surfs, trail
runs" already carry water/river language, just currently rendered in desert colors. This draft
is arguably a more geographically specific execution of the same posture, not a new one.

---

## A free win: this palette can double as the `Element` palette

Your training database already tags every sport with an `Element` (`Earth | Water | Air |
Body`), and Notion already has colors assigned to those options (brown/blue/gray/pink). If the
app's hero palette *becomes* the Element palette — Earth = forest green, Water = river blue —
one design decision serves both the rebrand and the route-line-by-element idea from the map
work. No parallel color systems, no drift between "brand green" and "element green." Flagging
this now so it's a deliberate unification, not a coincidence discovered later.

---

## Color — Dark mode (primary), draft

Ground stays warm-dark (no reason to lose the cozy, OLED-friendly base) — the shift lives in
the accents, where the identity actually sits.

```
:root {
  /* --- Ground (unchanged from live kit — no reason to touch this) --- */
  --color-bg:              #181614;
  --color-surface:         #221F1C;
  --color-surface-raised:  #2C2825;
  --color-border:          #38332E;
  --color-border-strong:   #4A443D;
  --color-text:            #E6E1DB;
  --color-text-secondary:  #9B9590;
  --color-text-muted:      #6B6560;

  /* --- Gorge accents (replaces "earth accents") --- */
  --color-forest:    #3F5A45;   /* deep Douglas-fir green — primary hero, Earth element */
  --color-river:     #4A7A8C;   /* glacial river blue-teal — secondary hero, Water element */
  --color-basalt:    #6B7275;   /* cliff-rock cool gray — structural neutral, Air element */
  --color-moss:      #8AA05E;   /* bright moss accent — sparing, for "alive/positive" moments */
  --color-mist:      #B9C4C2;   /* fog/spray off-white-gray — tier-3/modeled, replaces slate */

  /* --- Semantic (re-pointed) --- */
  --color-trend-line: #6E9481;  /* muted river-green — the hero data line */
  --color-positive:   #6E9481;
  --color-negative:   #B86B5A;  /* keep — a warm caution note against all this cool works well */
  --color-neutral:    #9B9590;
}
```

Rationale for the individual picks:
- **Forest green as primary hero** (replacing sandstone gold's job): deep, desaturated, not
  a "brand green" screaming for attention — it's meant to sit quietly, the way an actual pine
  canopy does at dusk.
- **River blue as the true second color** you named: cool, a little gray in it (glacial silt),
  not a clean saturated "app blue." Reads as *water*, not *tech*.
- **Basalt replaces slate**: same job (cool neutral, tier-3 demotion, structural), renamed to
  match the mood — cliff rock rather than generic "stone."
- **Kept `--color-negative` warm**: one warm note against an otherwise cool palette actually
  sharpens it — an all-cool palette risks going flat/cold, and the constitution's fidelity/tier
  system needs a caution color that reads as *warning*, not just *different hue*.

## Color — Light mode, draft

```
:root[data-theme="light"] {
  --color-bg:              #EDEEE9;  /* pale river-mist parchment, cooler than the live kit's warm cream */
  --color-surface:         #F7F8F5;
  --color-surface-raised:  #FFFFFF;
  --color-border:          #D8DAD2;
  --color-border-strong:   #BFC2B7;
  --color-text:            #171916;
  --color-text-secondary:  #62655D;
  --color-text-muted:      #94978E;

  --color-forest:    #2E4536;
  --color-river:     #3A6070;
  --color-basalt:    #565D60;
  --color-moss:      #6C8148;
  --color-mist:      #8C9694;

  --color-trend-line: #4F7360;
  --color-positive:   #4F7360;
  --color-negative:   #A85545;
  --color-neutral:    #62655D;
}
```

---

## Open decisions (yours to call, not mine)

1. **Does forest green take over the CTA/active-tab job sandstone gold currently holds** (full
   replacement), or does gold survive as a small warm accent reserved for CTAs specifically,
   with forest/river doing everything else (map, charts, Element coding)? Both are defensible —
   full replacement is more coherent; keeping one warm CTA note prevents the whole UI going
   monochrome-cool.
2. **Does the ground (`--color-bg` etc.) stay warm, or shift cooler** to fully commit to the
   gorge mood (a charcoal with a slight green-gray undertone instead of red-yellow)? Draft above
   keeps it warm deliberately — cozy dark base, cool identity accents — but a fuller
   "regrounding" might want the base to shift too.
3. **Does `--color-moss` earn a real job**, or is it decoration? Right now it's the one color
   in the draft without a clear semantic assignment — either give it one (a fourth chart series?
   a "fresh/new" indicator?) or cut it. Unused accent colors are how palettes rot.

---

## Typography — draft direction

The live kit's combo (Barlow Condensed display / Inter body / JetBrains Mono data) is already
sound *functionally* — condensed-bold-uppercase for identity, neutral sans for reading, mono
for honesty-in-numbers. The gorge shift doesn't obviously require touching **body or data**
fonts; Inter and JetBrains Mono aren't "desert" or "forest," they're just clean and legible —
changing them risks losing density/legibility for a mood upgrade that's better carried by color.

Where mood *can* show: the **display** font — the one used for section headers and hero
numbers, seen big and infrequently. Two candidate directions, both real starting points to
react to, not a final call:

- **Option A — stay condensed-sans, pick one with more carved/geological character.**
  Something like **'Fjalla One'** or **'Big Shoulders Display'** — still uppercase, still
  technical, but with a bit more weight/texture than Barlow Condensed's very clean geometric
  feel. Lowest-risk change (same category, same usage rules, just a different specific face).
- **Option B — a rustic/carved serif for display only**, evoking National Park Service trail
  signage or old USGS topo-map lettering (a genuinely different texture from anything in the
  current kit). **'Fraunces'** (has real weight variability, a slightly carved/warm serif
  character used a lot in outdoor/craft branding right now) is the concrete candidate. Bigger
  swing — changes the app's "voice" more, not just its palette.

My lean, if asked: **Option A** first — it's additive to the existing system rather than a
second big shift stacked on top of the color change, and you can always revisit toward Option
B's boldness later once the color direction is settled and lived-with. But this is genuinely
a taste call more than an engineering one — happy to mock up either against the actual palette
above if that's easier to react to than font names in the abstract.

---

## What this draft does NOT touch

Spacing, radius, elevation/shadow, chart line-weight/dot rules, fidelity visualization rules,
tier visualization rules, iconography, motion, and photography direction are all unaffected —
none of those are palette- or font-specific, and nothing above gives a reason to revisit them.
If a real v2 pass happens, start from `brand-kit.md`'s structure and only the Color and
Typography sections change; everything else ports forward as-is.
