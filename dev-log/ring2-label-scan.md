# Ring 2 — Nutrition-label scanning (Scan mode's second target)

**Goal:** Photograph the Nutrition Facts panel itself and log from its printed
values — for the packaged food whose barcode isn't in Open Food Facts, or has no
barcode at all. Dylan's ask (2026-07-01): "add into barcode scanning and just
have a choice within there." Built on `claude/ring2-photo-nutrition-9t4c8b`
right after Pass 2.8a, because it rides on the same image plumbing
(`callClaude` image block).

**The honesty line this feature walks:** a label read is a TRANSCRIPTION, not an
estimate. The values are label-declared (like barcode); what the model adds is a
machine read of them. So it gets its own lane end to end — never `photoestimate`
(it isn't an estimate), never `foodapi` (there's no database record behind it).

## What shipped (4 commits)

- **`2c8c8ad` core** — `InputMethod` gains `'label'`; `ObservationSource` gains
  `{ type: 'labelscan', modelVersion }`. Fidelity: barcode's band exactly —
  0.55 partial → 0.80 full read (completeness = fraction of the four macros the
  read produced), ceiling 0.85. Rationale in code: transcription risk replaces
  OFF's crowd-sourcing risk, and the user confirms the read on screen with the
  physical label in hand. Both stores are JSON columns — no migration.
- **`6d55873` `src/lib/foodLabel.ts`** — `transcribeLabel` (Haiku 4.5, single
  swap point, 12 s timeout): transcription-only prompt — printed per-serving
  values verbatim, per-100g fallback when that's all the panel prints, kJ never
  converted to kcal, glare/unprinted = null while a printed 0 is a real 0.
  Typed `'unreadable'` miss on found:false, all-null reads, and every failure
  mode. `labelToItem` scales the declared values by the confirmed serving count
  (null never scaled into existence), stamps package-vs-estimated, keyless.
- **`24edb2c` meal builder + hook** — scan meals read `inputMethod: 'label'`
  when any item is keyless (else `'barcode'`); `mealSource` then stamps
  `labelscan` + the transcriber model. Edit mode hydrates label meals back into
  Scan. `useFoodLog.addLabel` mirrors `addBarcode`.
- **`93581ab` UI** — Barcode | Nutrition label chips at the top of Scan mode.
  Label flow: live camera → Capture label (quality 0.7 — small print needs more
  detail than a plate shot) → still + "Reading the label…" → confirm card
  (product name or "Nutrition label", printed serving line, Servings field,
  grams field two-way-synced when the label declares a serving weight, live
  macros, As-labeled/I-estimated chips) → Add to meal. Unreadable → retake or
  describe. Rows are keyless → the existing estimate editor works on them, so a
  misread digit is correctable in place.

## Tests & verification

- `src/lib/__tests__/foodLabel.test.ts` (14) — image block + model + schema on
  the wire; printed-0-vs-null; found:false / all-null / no-key / empty-image /
  HTTP / refusal / network → unreadable; labelToItem serving scaling with null
  preserved, HIGH full read / MID partial, package-vs-estimated, no-grams and
  no-name fallbacks.
- `core/__tests__/fidelity.test.ts` — label == barcode at full completeness
  (HIGH at the 0.8 boundary, ceiling 0.85), partial → MID, ceiling never
  exceeded.
- `src/lib/__tests__/foodLog.test.ts` — a label meal's source is `labelscan`
  (never claims a provider), payload ceiling 0.85.
- **295/295 jest (28 suites), tsc 0.**
- **Device verify owed (Dylan, same session as the 2.8a check):** Scan →
  Nutrition label → photograph a real panel → the printed values appear (blanks
  for anything glared/cropped), servings scale them, log → a `label` meal with
  `labelscan` source persists. Also worth eyeballing: a deliberately blurry shot
  → unreadable path, and editing a transcribed row.

## Constitution check

AI in the plumbing (the user sees a label's numbers, never "AI"); null ≠ 0 held
through prompt, schema, scaling, and UI; fidelity honest per extraction (full
read HIGH like barcode, partial MID, eyeballed share recorded on
quantityMethod); keyless items can't launder into a database lineage; pull not
push; transcription stays editable — a mirror of the label, not a verdict.
