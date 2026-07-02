# Outdoor Pass 1 — sport expansion + GPX import + route trace

*2026-07-01, branch `claude/outdoor-sports-workspace-fbl5` (worktree `~/Projects/health-coach-outdoor`). First build pass off the outdoor-sports consolidation (see `planning/outdoor-sports-master-plan.md`). 274 jest / 28 suites green, tsc clean (run last, per discipline).*

## What shipped

1. **Sport-expansion batch** (`4a9339c`) — 20 add-now identity labels on existing surfaces, straight from the `outdoor-integrations.md` v0.2 triage: walk, ruck, trail run, MTB, kayak, whitewater, SUP, canoe, row, sail, windsurf, kitesurf, snowboard, ski touring, XC ski, snowshoe, skate, paraglide (GPS surface); martial arts, dance (practice surface). Pure identity-layer data — the three-layer model doing exactly what it promised.

2. **GPX file import** (`beda296`) — the wearable addendum's Layer 2, client-side and gate-free. "Import GPX file" on the GPS surface → `expo-document-picker` → `parseGpx()` (fast-xml-parser, pure TS in `src/lib/gpxImport.ts`) → distance/duration/elevation prefill the *editable* form fields, route geometry lands in the schema's existing `endurance.gpsPath`, session is dated at the file's start time (`occurredAt`) and logged now (`loggedAt`). Fidelity 0.9 (device-recorded trace: above manual 0.5, below live watch import ~0.95). Parser honesty: distance summed per `<trkseg>` (pause gaps never count), 3 m hysteresis on elevation gain, timestampless files yield *no* duration (absent, never fabricated), stats computed on full resolution before any storage thinning (cap 4000 points).

3. **SVG route trace** (`5e56655`) — `RoutePreview` draws `gpsPath` as a quiet sandstone polyline on the session card and in the logger after import. No map library, no new native dep for rendering, no tiles — the sparse first rung of `gps-mapping-spec.md`'s display ladder; MapLibre later is additive. Routeless sessions render exactly as before (stats-only is complete, not broken).

## ⚑ Flags

- **Core contract touch (flagged, per discipline):** `ObservationSource` gained `{ type: 'fileimport'; format: 'gpx' | 'fit' | 'tcx'; filename? }`. Anticipated by `wearable-ingestion-spec.md` § Addendum (Layer 2); `data-model.md`'s source union should pick it up at its next blessed edit.
- **Timeline behavior change (intentional, reviewable):** an imported session lands on the day it *happened* (GPX start time), not the day it was logged. That's what `occurredAt`/`loggedAt` exist for, but it's the first flow where they differ for sessions — worth a look on Today/history.
- **`durationMin` prefill rounds to whole minutes** (form field is minutes-as-string); exact seconds live in the route timestamps.
- **Not built, still awaiting blessing:** native GPS *recording* (master plan ⚑1) and the climbing-surface upgrade (⚑7). This pass deliberately stops at import + display.

## New deps

`expo-document-picker` (**native** — dev-client rebuild required; this pass's sim build includes it), `expo-file-system`, `fast-xml-parser` (pure JS). Installed with `--legacy-peer-deps` per the healthkit constraint.

## Follow-ups teed up

- FIT + TCX parsers behind the same import button (research: `fit-file-parser` MIT for FIT; togeojson for TCX) — same source type, already in the union.
- Route on the session detail/edit view (preview currently: logger + Today card).
- Elevation gain display in the GPS form after import (stored + shown in the route row; no editable field yet).
- HealthKit workout ingestion (Phase 3) will reuse `gpsPath` + the same card rendering untouched.
