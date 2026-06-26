# Brand Kit — Design Tokens

*Trail map meets tide chart. Gear for an outdoor life, not a gym app.*

---

## Design posture

This app is infrastructure for someone who climbs, surfs, trail runs, and treats the gym and nutrition as serious support for that life. The visual language borrows from **technical outdoor gear and honest ledgers**, not fitness apps. Dark, warm, dense enough to be useful, calm enough to leave quickly.

References: MacroFactor's typographic confidence, Säker Canine's earth-tone material palette, motion-blur effort photography. Anti-references: Whoop/Strava neon, Oura's score-centric rings, Future's hollow lifestyle aspirationalism.

The design must make three product principles visible without narrating them:

- **Fidelity is visible.** A weighed meal and a photo guess must look different on screen. Confidence is a visual property, not metadata.  
- **Silence is legible.** When the app says nothing, the UI must make clear nothing crossed the threshold — not that something broke.  
- **Tiers are felt.** Tier-1 facts (logged), tier-2 accumulated (trends), and tier-3 modeled (wearable scores) occupy visually distinct registers. Tier-3 never visually dominates tier-1.

---

## Color — Dark mode (primary)

Warm charcoal ground. Not blue-black (cold, techy), not pure black (OLED-hostile to earth tones). The warmth comes from a slight red-yellow undertone in the darks.

:root {

  /\* \--- Ground \--- \*/

  \--color-bg:              \#181614;   /\* app background \*/

  \--color-surface:         \#221F1C;   /\* cards, panels, raised containers \*/

  \--color-surface-raised:  \#2C2825;   /\* modals, popovers, active states \*/

  \--color-border:          \#38332E;   /\* dividers, card edges — subtle \*/

  \--color-border-strong:   \#4A443D;   /\* emphasized dividers \*/

  /\* \--- Text \--- \*/

  \--color-text:            \#E6E1DB;   /\* primary text — warm off-white \*/

  \--color-text-secondary:  \#9B9590;   /\* labels, captions, support text \*/

  \--color-text-muted:      \#6B6560;   /\* placeholders, disabled, timestamps \*/

  /\* \--- Earth accents \--- \*/

  \--color-sandstone:       \#C4A87A;   /\* warm gold — primary accent, CTAs, active tab \*/

  \--color-olive:           \#7B8C68;   /\* sage green — positive trends, completed states \*/

  \--color-clay:            \#B07858;   /\* terracotta — warnings, fidelity-low indicators \*/

  \--color-slate:           \#7A8896;   /\* cool stone — tier-3/modeled data, secondary charts \*/

  /\* \--- Semantic \--- \*/

  \--color-trend-line:      \#A3B490;   /\* the weight trend / primary data line — muted sage \*/

  \--color-positive:        \#7B8C68;   /\* olive — gains, surplus, upward \*/

  \--color-negative:        \#B86B5A;   /\* muted warm red — deficit, loss, caution \*/

  \--color-neutral:         \#9B9590;   /\* no change — same as text-secondary \*/

  /\* \--- Fidelity encoding \--- \*/

  \--fidelity-high:         1.0;       /\* weighed, barcode-scanned — full opacity \*/

  \--fidelity-mid:          0.7;       /\* text entry, recipe estimate \*/

  \--fidelity-low:          0.45;      /\* photo guess, AI estimate \*/

  /\* Low-fidelity data points also use dashed strokes / dotted borders \*/

  /\* to be distinguishable without relying solely on opacity. \*/

  /\* \--- Tier encoding \--- \*/

  /\* Tier 1 (logged facts): \--color-text at full weight, solid lines \*/

  /\* Tier 2 (accumulated): \--color-trend-line, smooth curves \*/

  /\* Tier 3 (modeled/wearable): \--color-slate, lighter weight, always below tier-1 visually \*/

}

## Color — Light mode (secondary)

Warm stone ground. Cream that feels like a topo map, not a lifestyle blog.

:root\[data-theme="light"\] {

  \--color-bg:              \#F2EDE7;   /\* warm parchment \*/

  \--color-surface:         \#FAFAF7;   /\* cards — near-white with warmth \*/

  \--color-surface-raised:  \#FFFFFF;

  \--color-border:          \#DDD7CF;

  \--color-border-strong:   \#C4BDB4;

  \--color-text:            \#1A1816;

  \--color-text-secondary:  \#6B6560;

  \--color-text-muted:      \#9B9590;

  /\* Accents darken slightly for contrast on light ground \*/

  \--color-sandstone:       \#A68A5B;

  \--color-olive:           \#5E7048;

  \--color-clay:            \#9A6344;

  \--color-slate:           \#62717E;

  \--color-trend-line:      \#6B7F5A;

  \--color-positive:        \#5E7048;

  \--color-negative:        \#A85545;

  \--color-neutral:         \#6B6560;

}

---

## Typography

Bold condensed display for identity. Clean sans for body. Monospace for data.

:root {

  /\* \--- Families \--- \*/

  \--font-display:    'Barlow Condensed', 'Arial Narrow', sans-serif;

  \--font-body:       'Inter', \-apple-system, system-ui, sans-serif;

  \--font-data:       'JetBrains Mono', 'SF Mono', 'Menlo', monospace;

  /\* \--- Display — used sparingly: section headers, hero stats, the trend number \--- \*/

  /\* Always uppercase. Tracking slightly opened. Weight 700 (bold) or 600 (semibold). \*/

  \--text-display-xl: 700 2.5rem/1.0 var(--font-display);   /\* hero stat: "2940 kcal" \*/

  \--text-display-lg: 700 1.75rem/1.1 var(--font-display);  /\* section headers \*/

  \--text-display-md: 600 1.25rem/1.2 var(--font-display);  /\* card titles \*/

  \--display-tracking: 0.04em;                                /\* letter-spacing for display \*/

  /\* \--- Body \--- \*/

  \--text-body:       400 0.9375rem/1.5 var(--font-body);    /\* 15px — primary reading \*/

  \--text-body-sm:    400 0.8125rem/1.5 var(--font-body);    /\* 13px — secondary, captions \*/

  \--text-label:      500 0.6875rem/1.3 var(--font-body);    /\* 11px — uppercase labels, eyebrows \*/

  \--label-tracking:  0.06em;

  /\* \--- Data — for numbers in charts, stats, tables \--- \*/

  \--text-data-lg:    500 1.5rem/1.2 var(--font-data);       /\* big stat readout \*/

  \--text-data:       400 0.875rem/1.4 var(--font-data);     /\* inline data, axis labels \*/

  \--text-data-sm:    400 0.75rem/1.4 var(--font-data);      /\* chart tick marks, timestamps \*/

  \--data-tracking:   \-0.01em;                                /\* mono is already wide — tighten \*/

  /\* Tabular nums for data alignment \*/

  \--font-feature-data: 'tnum' 1, 'kern' 1;

}

**Font loading (Expo / React Native):** Barlow Condensed 600+700, Inter 400+500, JetBrains Mono 400+500. Total: \~200KB. System fallbacks defined above for pre-load.

**Usage rules:**

- Display font is *always* uppercase, *always* with `--display-tracking`. Never used for body text or UI controls.  
- The big number on a card (e.g., "2940 kcal", "153.5 lbs") uses `--text-data-lg` in `--font-data`, not display. Display is for *labels and headers*, data font is for *values*. This separation keeps identity (display) and honesty (data) in distinct registers.  
- Body text is sentence case. Labels are uppercase with `--label-tracking`.

---

## Spacing

An 4px base unit. Dense enough for data screens, not cramped.

:root {

  \--space-1:   4px;     /\* tight: between icon and label \*/

  \--space-2:   8px;     /\* compact: inner padding, gaps in dense lists \*/

  \--space-3:   12px;    /\* default: card inner padding (compact cards) \*/

  \--space-4:   16px;    /\* comfortable: card padding, list item height \*/

  \--space-5:   20px;    /\* breathing room: between card groups \*/

  \--space-6:   24px;    /\* section gaps \*/

  \--space-8:   32px;    /\* major section breaks \*/

  \--space-10:  40px;    /\* page-level padding top/bottom \*/

  \--space-12:  48px;    /\* screen-level vertical rhythm \*/

}

**Usage rules:**

- Cards: `--space-4` padding, `--space-2` gap between internal elements.  
- Between cards in a list: `--space-2` (tight) or `--space-3` (standard).  
- Section headers to content: `--space-4`.  
- Screen edge padding (horizontal): `--space-4` on mobile, `--space-6` on tablet+.

---

## Radius

Minimal. This is a tool, not a toy. Radius signals precision, not friendliness.

:root {

  \--radius-sm:   4px;    /\* chips, tags, small interactive elements \*/

  \--radius-md:   8px;    /\* cards, input fields, buttons \*/

  \--radius-lg:   12px;   /\* modals, bottom sheets \*/

  \--radius-full: 9999px; /\* pills, avatar circles only \*/

}

No radius on chart containers or data panels — hard edges signal that the data is unmediated.

---

## Elevation / shadow

Minimal shadow. Separation comes from surface color steps, not drop shadows. On dark mode, shadows are nearly invisible anyway — color differentiation does the work.

:root {

  \--shadow-sm:  0 1px 2px rgba(0, 0, 0, 0.3);   /\* subtle lift for floating elements \*/

  \--shadow-md:  0 4px 12px rgba(0, 0, 0, 0.4);   /\* modals, popovers \*/

  /\* Prefer \--color-surface-raised over shadows when possible. \*/

}

---

## Chart & data visualization

:root {

  /\* \--- Line weights \--- \*/

  \--chart-line-primary:    2px;    /\* the main trend line \*/

  \--chart-line-secondary:  1.5px;  /\* comparison / overlay lines \*/

  \--chart-line-grid:       1px;    /\* grid lines — use \--color-border at 0.3 opacity \*/

  /\* \--- Data point dots \--- \*/

  \--chart-dot-radius:      3px;

  \--chart-dot-active:      5px;    /\* on hover / selected \*/

  /\* \--- Palette for multi-series (ordered) \--- \*/

  \--chart-series-1:  var(--color-trend-line);  /\* sage — primary \*/

  \--chart-series-2:  var(--color-sandstone);   /\* gold — secondary \*/

  \--chart-series-3:  var(--color-clay);        /\* terracotta — tertiary \*/

  \--chart-series-4:  var(--color-slate);       /\* cool stone — quaternary \*/

  /\* \--- Confidence bands (fidelity-aware) \--- \*/

  /\* Trend lines with low average fidelity get a wider, more transparent band. \*/

  /\* High fidelity: ±narrow band, 0.15 opacity fill \*/

  /\* Low fidelity:  ±wide band, 0.08 opacity fill, dashed center line \*/

  /\* \--- Axis and labels \--- \*/

  /\* Axis labels: \--text-data-sm, \--color-text-muted \*/

  /\* Values: \--text-data, \--color-text-secondary \*/

  /\* Active/selected value: \--text-data, \--color-text \*/

}

---

## Fidelity visualization rules

This is the product's distinctive design problem. No other app does this because no other app treats logging confidence as data.

| Fidelity | Opacity | Stroke style | Dot style | Example |
| :---- | :---- | :---- | :---- | :---- |
| High (≥0.8) | 1.0 | Solid | Solid filled | Barcode scan, scale |
| Mid (0.4–0.8) | 0.7 | Solid | Hollow ring | Text entry, recipe |
| Low (\<0.4) | 0.45 | Dashed | Dotted / no dot | Photo guess, AI est. |

On data cards: a fidelity indicator appears as a small segmented bar (like a signal-strength icon) using `--color-sandstone` for filled segments and `--color-border` for empty. Three segments: low / mid / high. This is always visible on food log entries and any AI-estimated value.

---

## Tier visualization rules

| Tier | What it is | Visual treatment |
| :---- | :---- | :---- |
| 1 | Logged fact | Full weight text, solid data points, `--color-text` |
| 2 | Accumulated (trend) | Smooth curves, `--color-trend-line`, medium weight |
| 3 | Modeled (wearable) | `--color-slate`, lighter weight, smaller scale, always positioned *below* tier-1/2 in layout |

Tier-3 values never appear in the same visual container at the same size as tier-1. They sit in a secondary row, a smaller card, or a collapsible section. The hierarchy is spatial, not just chromatic.

---

## Iconography

Line icons, 1.5px stroke, rounded caps and joins. Warm, not clinical. Source: Lucide (available in React Native via `lucide-react-native`) or a custom subset.

No filled icons except for active navigation states. Active nav: filled icon in `--color-sandstone`. Inactive nav: outline icon in `--color-text-muted`.

---

## Motion

:root {

  \--ease-out:      cubic-bezier(0.16, 1, 0.3, 1);  /\* for enters, reveals \*/

  \--ease-in-out:   cubic-bezier(0.65, 0, 0.35, 1);  /\* for transitions between states \*/

  \--duration-fast:   120ms;   /\* hover, press feedback \*/

  \--duration-base:   200ms;   /\* panel transitions, tab switches \*/

  \--duration-slow:   350ms;   /\* modal enter/exit, chart line drawing \*/

}

Respect `prefers-reduced-motion`. When reduced: instant transitions, no chart-line animation, static trend lines.

---

## Photography direction

When imagery is used (onboarding, empty states, marketing):

- **Effort in motion**, not posed bodies or finished outcomes. Motion blur is welcome.  
- **Environmental**: trails, rock, water, weather. The landscape is the context, the person is incidental.  
- **Desaturated and warm**: muted, not vivid. Pulled toward the earth palette, never oversaturated.  
- **Never**: before/after body shots, flexing, gym selfies, body-change content. This is a spine rule.

---

## Do / Don't (for Claude Code)

**Do:**

- Use the display font for section titles, uppercase, with tracking.  
- Show fidelity visually on every data point that has it.  
- Let trend lines be the hero — biggest, most prominent element on data screens.  
- Use `--color-slate` to visually demote tier-3 modeled values.  
- Leave generous whitespace around charts — the data breathes.  
- Use `--font-data` with tabular figures for any number the user might compare vertically.

**Don't:**

- Use bright/saturated accent colors. Nothing in the palette screams.  
- Use gradients on data elements (gradients on backgrounds sparingly, if at all).  
- Use the display font below section-header level — it's identity, not utility.  
- Put tier-3 data in the same visual hierarchy as tier-1. Slate, smaller, secondary.  
- Use shadows when a surface-color step will do.  
- Add border-radius to chart containers or data panels.  
- Use green/red for positive/negative — use `--color-olive` / `--color-negative` instead. The palette is earth, not traffic lights.

