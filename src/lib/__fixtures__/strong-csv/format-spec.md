# Strong CSV import — format spec (v1)

Researched 2026-07-05. Sources: a real 1,904-row Strong iOS export
(AlexandrosKyriakakis/StrongAppAnalytics `Data/strong.csv`), four independent
open-source parsers (thehipposcientist/Makros `strong_parser.py`,
Edward-Handley/macrofactor-scraper `_strong.py`, placy2/strong-app-data-analysis,
jjaju/statlift `columns.json`), Aebel-Shajan/gym-data-analysis (Android
semicolon sample), intervals.icu forum thread #5531, openweight.dev/migrate/strong,
strengthjourneys.xyz/import/strong, Strong Help Center article 235.

One CSV row = ONE SET. Session identity = group by (`Date`, `Workout Name`) —
`Date` is the workout START timestamp repeated on every row of that workout.
There are NO per-set timestamps in any variant. Strong support confirms exports
cannot be re-imported into Strong (one-way door — good switcher lever).

## Variant matrix (both are in the wild; detect, don't assume)

### Variant A — "classic" (iOS, ~2017 through ~2023; the majority of historical files)
Comma-delimited, RFC-4180 quoting (double quotes, `""` escaping). Verified
against a real export.

```
Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
```

| Col | Type / format | Notes |
|---|---|---|
| Date | `YYYY-MM-DD HH:MM:SS` | workout start; repeated per row; session grouping key |
| Workout Name | quoted string | e.g. `"Evening Workout"`, `"Push Day"` |
| Duration | `2h 38m` \| `45m` \| `5m` | whole-workout duration, repeated per row |
| Exercise Name | quoted string | pattern `Name (Equipment)`: `"Bench Press (Barbell)"` |
| Set Order | int 1..n per exercise, OR letter | `W`=warm-up, `D`=drop set, `F`=failure (letters replace the number) |
| Weight | float, dot decimal | user's DISPLAY unit, **no unit column**. Bodyweight/none = `0.0` |
| Reps | int | `0` when not applicable (e.g. plank) |
| Distance | float | cardio-in-workout rows; display unit (km or miles), no unit col |
| Seconds | int | duration-based sets (plank = `60`); `0` otherwise |
| Notes | quoted string or empty | set-level; real exports alternate `""` and fully-empty |
| Workout Notes | quoted string or empty | repeated inconsistently across the workout's rows — take first non-empty |
| RPE | float or empty | 6–10 in 0.5 steps when user logged it; usually empty |

`0` vs null is ambiguous throughout — Strong writes `0`/`0.0` for "not
applicable", never blank, in numeric columns.

### Variant B — "unit-columns" (2023+; Android exports commonly SEMICOLON-delimited)
Adds `Weight Unit` (`kg`/`lbs`) and `Distance Unit` (`km`/`miles`) per-row
columns; RPE moves next to Reps; duration column moves/renames.

iOS ordering (comma):
```
Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Weight Unit,Reps,RPE,Distance,Distance Unit,Seconds,Notes,Workout Notes
```
Android ordering (semicolon, duration LAST and renamed):
```
Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration
```

### Localized headers (real hazard)
Headers are translated to the app language. German (from statlift):
`Datum; Workout-Name; Name der Übung; Reihenfolge festlegen; Gewicht; Wiederh.;
RPE; Entfernung; Sekunden; Notizen; Workout-Notizen; Dauer` (iOS) /
`Workout-Dauer` (Android). v1: alias-match English + fall back to a clear
error ("re-export with app language set to English") rather than positional guessing.

### Other row-level hazards
- "Rest Timer" pseudo-exercise rows (only `Seconds` populated) appear in some
  newer exports — skip when exercise name ∈ {rest timer, rest} and only Seconds set (Makros).
- All-zero placeholder rows (exercise added, no sets logged) — skip.
- Encoding: decode utf-8-sig first (BOM seen), then utf-8, then latin-1.
- Decimal separator: dot confirmed in all observed samples incl. German/Android;
  comma-decimals UNCONFIRMED but cheap to tolerate when delimiter is `;`
  (treat `82,5` as `82.5`).

## Parser rules (recommended)
1. Sniff delimiter from the header line (`;` vs `,`) — statlift does exactly
   this (`sep=None`); Strength Journeys calls out "semicolon delimiters and
   weight-unit headers" as THE Strong quirks.
2. Header-normalize with an alias table (case/space-insensitive):
   `duration|workout duration` → duration, etc. Require at minimum `date` +
   `exercise name`; everything else optional.
3. Date: try `%Y-%m-%d %H:%M:%S`, then `%Y-%m-%d %H:%M`, ISO-T, bare date.
4. Duration: `(\d+)h`, `(\d+)m` tokens ("1h 10m", "45m"); tolerate `H:MM:SS`
   and bare-minutes fallbacks.
5. Set Order: digits → order int; `W`/`D`/`F` (and word forms) → set-type
   marker, assign order = position within exercise group.
6. Units: per-row `Weight Unit`/`Distance Unit` when present (Variant B) —
   values `kg|lbs`, `km|miles`. Variant A: NO unit info in file (openweight's
   converter forces a `--weight-unit` flag for exactly this reason).

## Unit handling for our import (recommendation)
- Variant B: trust per-row unit columns, convert to kg at parse time. No prompt.
- Variant A: single import-screen choice "Weights in this file are: kg / lb",
  prefilled by heuristic, never silent:
  - share of values that are "clean" in lb-space (135/185/225/…, steps of 5/2.5 lb)
    vs kg-space (steps of 2.5/1.25 kg);
  - any max weight ≥ 250 → almost certainly lb (Makros heuristic);
  - default prefill = app's own display-unit setting when heuristic is ambiguous.
  Constitution fit: heuristic + explicit confirm — never silently guess a fact.

## Mapping to LiftingBlock (core/src/observation.ts)
- Group by (Date, Workout Name) → one `session` observation (modality lifting).
  `SessionPayload.durationMin` ← parsed Duration (batch-entered semantics:
  per-set `completedAt` ABSENT — Strong has no per-set timestamps; do not fabricate).
- Row → `LiftingBlock.sets[]`: `exercise` (resolved name), `movementPattern`
  (from library resolution), `weightKg` (converted), `reps`,
  `isWarmup` ← Set Order `W`, `rir` ← `10 − RPE` when RPE present (flagged decision).
- Bodyweight rows (Weight 0.0, Reps > 0): keep `weightKg: 0` = zero EXTERNAL load
  (truthful; Strong writes 0 by design here, not missing-data).
- Duration-based sets (Seconds > 0, Reps 0, e.g. plank): LiftingBlock has no
  per-set seconds field → v1 skip + list in import report, OR extend schema
  with optional `durationSec` (flagged decision).
- Distance rows (Running/Swimming inside a Strong workout): out of LiftingBlock
  scope → v1 skip + import report line ("3 cardio entries not imported").
- `D`/`F` markers: import as normal working sets (weight×reps are the facts);
  marker noted in set notes if we keep notes. No schema support for drop/failure
  and none needed descriptively.
- Provenance: extend `ObservationSource` fileimport union:
  `{ type: 'fileimport'; format: 'gpx'|'fit'|'tcx'|'strong-csv'|'hevy-csv' }`.
- Dedupe key: hash(date, workout name, exercise, set order, weight, reps) —
  makes re-import of an overlapping export idempotent (macrofactor-scraper
  fingerprints the same tuple).

## Exercise-name resolution (Strong/Hevy name → Free Exercise DB + movementPattern)
Both apps use `Name (Equipment)` naming: "Bench Press (Barbell)",
"Lat Pulldown (Cable)", "Pull Up (Assisted)". Free Exercise DB (873 entries)
has `name`, `force` (push/pull/static), `mechanic` (compound/isolation),
`equipment`, `primaryMuscles`, `category` — but NO movement-pattern field.

Pipeline:
1. **Build-time curation (one-off):** generate `movementPattern` for all 873
   FEDB entries from tags (mechanic=isolation → `isolation`; force=push +
   chest/shoulders/triceps → `upper-push`; force=pull + lats/middle-back/biceps
   → `upper-pull`; hamstrings/glutes/lower-back hinge names → `hip-hinge`;
   quadriceps → `quad-dom`; abdominals → `core`; lunge/split-squat/step-up →
   `unilateral-leg`; carry names → `carry`; twist/chop → `rotation`), then hand-review.
   Ship as a static column, not runtime inference.
2. **Import-time matching:** (a) exact hit in a curated alias table covering
   Strong's ~300 built-in names (highest-value 100 first); (b) normalized match —
   lowercase, split parenthetical equipment, match name tokens + equipment
   against FEDB; (c) fuzzy (trigram/Jaro-Winkler) ≥0.90 auto-accept,
   0.75–0.90 queued for user confirmation on the import-review screen.
3. **Unmatched:** import anyway as a custom exercise with pattern `'other'`
   (enum already has it — import never blocks), preserve the raw Strong name,
   and surface a post-import "assign patterns" list sorted by set count with
   heuristic suggestions. Gainflow does the same (unmatched → custom entry).
   Descriptive constitution: the sets are facts regardless of taxonomy; pattern
   assignment refines analysis later.

## Hevy CSV (secondary reference)
Header (all fields quoted, comma-delimited; verified sample):
```
"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"
```
Key deltas vs Strong:
- **Unit lives in the COLUMN NAME** per user setting: `weight_kg` OR `weight_lbs`,
  `distance_km` OR `distance_miles` — detect from header, no prompt needed.
- `start_time`/`end_time` both present, format `"22 Dec 2025, 08:00"`
  (`d MMM yyyy, HH:mm`) → duration derivable, not a "1h 10m" string.
- `set_index` is 0-based; `set_type` is a word: `normal|warmup|failure|dropset`
  (vs Strong's letters-in-Set-Order).
- `superset_id`: integer group id shared by superset-partner exercises, blank
  otherwise — **Strong's CSV has NO superset representation at all** (no column
  in any variant).
- Per-exercise `exercise_notes` + workout-level `description` (Strong has
  set-level Notes + Workout Notes).
- Hevy also has a paid REST API (api.hevyapp.com): static `api-key` header,
  key generated in account settings, Hevy Pro subscribers only — not needed for
  CSV import, noted for a future sync path.

## Files here
- `samples.csv` — 10 synthetic Variant-A rows: warm-up `W`, failure `F`,
  drop `D`, RPE incl. `.5`, escaped quotes + comma in Notes, bodyweight 0.0,
  plank (Seconds only), cardio Distance row, `1h 10m`/`45m` durations,
  inconsistent `""`-vs-empty Notes/Workout Notes — mirrors the real export's quirks.
- `samples-variant-b-android.csv` — semicolon + Weight Unit/Distance Unit +
  trailing `Workout Duration`, mixed kg/lbs rows.
- `hevy-sample.csv` — Hevy header with warmup/failure set_types, a superset
  pair (`superset_id` 0), plank via `duration_seconds`.
- `refs/` — downloaded parser sources + the real 1,904-row Strong export used
  as ground truth.
