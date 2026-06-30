# Ring 2 — Camera input (barcode + photo): pass-by-pass build plan

*Status: DRAFT — awaiting Dylan's approval. No code until blessed.*

*Companion to `food-logging-spec.md` (the data contract) and
`ring2-food-logging-plan.md` (the Ring 2 plan this refines — it expands that
plan's fast-follows **2.7** and **2.8** into four buildable passes). Obeys
`claude-md.md` (the constitution); mirrors `phase-6-plan-tab-build.md` in
structure. Reconciled against `core/src/observation.ts`,
`core/src/nutrition/fidelity.ts`, `src/lib/foodSearch.ts`,
`src/lib/anthropicClient.ts`, `src/lib/foodEstimate.ts`,
`src/hooks/useFoodLog.ts`, `src/lib/config.ts`, `eas.json`, and `app.json` as
they exist on 2026-06-29. Decisions resolved 2026-06-29 in a planning session
with Dylan.*

---

## Resolved decisions (from the planning session)

1. **Camera dependency** → **`expo-camera`.** One first-party dep covers both
   flows: `CameraView` does barcode scanning *and* still capture, and the config
   plugin handles iOS/Android permissions through the prebuild flow already in
   use. `react-native-vision-camera` was weighed and set aside — its frame-
   processor power is overkill for scan + single still, at the cost of a heavier
   native dep to own.
2. **Dev-build path** → **EAS Build, `development` profile.** The profile already
   exists in `eas.json` (`developmentClient: true`, internal distribution), so
   this is the least new infrastructure. Cloud build, no local Xcode toolchain to
   maintain, shareable dev client. (Local `expo prebuild` + `expo run:ios` remains
   a valid fallback for fully-offline iteration — same dev client, just built on
   the Mac.) The dev client this produces is **also** the prerequisite the parked
   HealthKit work (Phase 3 Pass 2) has been waiting on — this is foundational
   infrastructure, not camera-only.
3. **LLM call location** → **direct from device, key in `expo-secure-store`.**
   `config.ts` already flags this as the intended next step ("route through
   SecureStore … before distribution"). Simplest path for a personal-use app; a
   server proxy (which would also unlock cost telemetry) is deferred until the app
   ships wider. The null-key → fallback contract is preserved either way.
4. **Vision model + call mechanism** → **Claude Haiku 4.5 first, escalate to
   Sonnet 4.6 if accuracy is poor**, reusing the existing **fetch-based
   `callClaude`** with `output_config` **`json_schema`** structured output —
   **not** the Anthropic SDK, and **not** tool-use. *(Flag: the original ask said
   "SDK with tool-use"; the codebase has neither — `foodEstimate.ts` already calls
   `callClaude` with `json_schema`, and matching it keeps the photo path identical
   to the shipped Describe-estimate path. Confirmed 2026-06-29 to reuse the
   existing client, extended with an image content block.)* Model choice matches
   `foodEstimate.ts`'s `ESTIMATOR_MODEL = 'claude-haiku-4-5'` and its documented
   Haiku-vs-Sonnet swap point.

**Reconciled against the codebase this session (surfaced, not silently reinterpreted):**

5. **Pass 2.8 photo now has a real build surface — this supersedes the v0.1
   stub.** `ring2-food-logging-plan.md` (v0.1) lists "Fast-follow 2.8 — `photo`
   (schema reservation only, no build surface)" on the reasoning that the free
   data layer has "no free vision provider." That predates the **v0.2 direct-
   estimation amendment** in `food-logging-spec.md`, which already shipped for
   Describe (`foodEstimate.ts`). Under the spec's standing covenant — *"input
   parsing is not part of the data layer"* — an LLM vision call is an input
   **parser**, not a food **database**, so it does not breach the free-only data-
   layer rule (USDA + OFF remain the only food databases). The v0.2 amendment says
   so explicitly: photo *"uses the same estimation schema with an image content
   block and the reserved `{ type: 'photoestimate', modelVersion }` source; it
   changes nothing structural."* This plan therefore treats photo as additive and
   buildable.
6. **Fidelity ceilings are already locked** in `core/src/nutrition/fidelity.ts`
   (`weighed 0.98 · barcode 0.85 · described 0.70 · photo 0.55`), with
   `defaultFidelity` cases for all four methods. These passes **consume** that
   module — they author no new ceiling math. Per-variant *starting* fidelities are
   proposed below.
7. **No Observation schema change is needed.** `InputMethod` already reserves
   `'barcode'` and `'photo'`; `ObservationSource` already has `foodapi` and
   `photoestimate`; `FoodItem` and `FoodEntryPayload` already carry
   `fidelityCeiling`. Everything here is additive — adapters, UI, a derivation
   stub — never a core record-type edit.

### Still open (do not resolve here)

- **OFF data-quality fallback beyond "describe it."** When a scanned UPC resolves
  to a sparse or garbage Open Food Facts record (missing/again-inconsistent
  macros), today's only fallback is to drop the user into Describe. Whether a
  better path exists — manual macro entry against the *confirmed* scanned identity,
  a targeted prompt for just the missing fields, or a secondary database — is open.
- **Earned-fidelity representation: `supersede` vs a new mechanism.** When a
  recurring photo meal eventually earns its way LOW→MID (Pass 2.8b / Phase 7), is
  that expressed by `supersede`-ing the observation (the `supersede` affordance
  already exists for weigh-ins in `storage/observations.ts`) or by a new derived-
  overlay that leaves the original log immutable? Decide when Phase 7 computes the
  value, not now.
- **Cost telemetry on the photo path.** Per-call token/$ tracking is **skipped for
  now** per the personal-use scope. Revisit alongside a server proxy if the app
  ships wider.

---

## Global guardrails (every pass honors)

- **Constitution holds.** AI in the plumbing, never on the surface · honesty in
  fidelity (`null ≠ 0`; an estimate never reads as measured; fidelity shown as a
  tier *visual*, never a number) · pull not push · no coaching, no gamification ·
  the felt sense outranks the model.
- **No food-database expansion.** USDA + OFF stay the only food *databases*. The
  vision LLM is an input *parser* (v0.2 covenant), not a new data source; its
  output is keyless estimate items, same shape as Describe. A regex / manual
  fallback always remains, so the logger works with **no key and no network**.
- **Fidelity stays honest and never a numeral.** Three tiers (HIGH ≥ 0.8 ·
  MID 0.4–0.8 · LOW < 0.4) rendered as opacity / stroke / dot. Barcode and photo
  log at their honest (often low) fidelity. A low-fidelity log is a valid state —
  no nag to "improve" it, no completeness CTA.
- **Secrets discipline.** The **committed** `app.json` carries
  `anthropicApiKey: null`; Dylan's real key is local-only and must **never** be
  committed. Pass 2.8a moves the key to `expo-secure-store`; through 2.7a–2.8a any
  `app.json` camera-plugin edit must not sweep the real key into a commit. (The
  committed USDA key is the documented low-sensitivity free-tier pattern and is
  out of scope here.)
- **Environment.** Worktree `~/Projects/health-coach-camera-spec`, branch
  `ring2-camera-spec`. **Expo SDK 53** (`expo ^53.0.0`, RN 0.79.6) — trust
  `package.json`; `AGENTS.md`'s "v56.0.0" line is a stale discrepancy to reconcile
  **before** any build session runs. `npm install --legacy-peer-deps` only
  (HealthKit peer conflict). Mind the parallel-worktree hazard — separate
  `node_modules`, own dev-server port; only the main session changes shared deps,
  so a build session coordinates its `expo install`s on this branch.
- **Single-concern commits**, only when Dylan asks. **`tsc` runs LAST**, after the
  test files are written.

---

## Dependencies

- **Ring 2 core (Passes 2.1–2.6) — BUILT, green, verified live.** Search → USDA →
  adapter → rollup → fidelity → Log meal all work end-to-end on the iOS sim. This
  plan attaches to that spine; it adds two input methods, not a new pipeline.
- **`core/src/nutrition/fidelity.ts` — BUILT.** All four method ceilings and
  `defaultFidelity` cases (incl. `barcode` completeness-scaling and `photo`)
  already exist. Consumed, not extended.
- **`src/lib/foodSearch.ts::getFoodByBarcode` — BUILT.** OFF UPC fetch, cache-
  first, honest typed `null` miss. Pass 2.7b *wraps* this; it does not re-implement
  the network layer.
- **`src/lib/anthropicClient.ts::callClaude` — BUILT.** Fetch-based, `json_schema`
  structured output, returns `null` on any failure (never throws). Pass 2.8a
  *extends* it with an optional image content block.
- **`src/lib/foodEstimate.ts` — BUILT.** The direct-estimation module Pass 2.8a's
  `foodVision.ts` mirrors almost line-for-line (keyless `FoodItem`, `estimate`
  source, every macro `number | null`). 2.8a swaps in the image input, the
  `photoestimate` source, and the `photo` fidelity band.
- **`src/hooks/useFoodLog.ts` — BUILT.** Exposes `addWeighed` / `addDescribed` /
  `updateItem` / `removeItem`. The new flows add `addBarcode` / `addPhoto`
  siblings; `app/log-food.tsx` is the host screen.
- **EAS `development` profile — EXISTS** (`eas.json`). Pass 2.7a builds against it;
  it does not create it.
- **Dev client — NOT YET BUILT.** Produced by Pass 2.7a. Required by every camera
  pass (Expo Go can't carry a custom native scanner/capture reliably) and by the
  parked HealthKit work.
- **`expo-camera`, `expo-secure-store`, `expo-image-manipulator` — NOT
  installed.** Added by 2.7a (camera) and 2.8a (secure key + image downscale).
- **Earned-fidelity computation — DEFERRED to Phase 7** (recurrence × residual
  scoring + signal attribution). Pass 2.8b lands only the typed boundary; the
  scaffolding it leans on (occurrences-as-query from 2.4, per-window
  `residualConfidence` from 2.6) is already standing.

---

## Fidelity ceilings & defaults (per input-method variant)

The per-method **ceilings are already locked** in `fidelity.ts` — these passes
consume them. The numbers below are first-draft, **tunable** bands (per the
constitution's "heuristics documented with their error band"), not measured.

| Method | Ceiling (locked) |
| :--- | :--- |
| `weighed` | 0.98 |
| `barcode` | **0.85** |
| `described` | 0.70 |
| `photo` | **0.55** |

**Proposed *starting* fidelity per variant** for the two methods this plan ships:

| Input method · variant | `quantityMethod` | Start | Tier | Why |
| :--- | :--- | :--- | :--- | :--- |
| `barcode` · complete OFF record, whole package / declared serving | `package` | ~0.80 | HIGH/MID edge | UPC identity is near-exact; portion is declared |
| `barcode` · complete OFF record, eyeballed fraction | `estimated` | ~0.55 | MID | identity exact, **portion guessed** — can't launder to HIGH |
| `barcode` · sparse OFF record (missing macros) | `package`/`estimated` | ~0.55 ↓, completeness-scaled | MID→LOW | crowd data is patchy → reflected in fidelity, not hidden |
| `photo` · items identified, no portion cue | `estimated` | ~0.35 | LOW | 2D portion estimation is limited **by nature** |
| `photo` · portion cue present (countable items / appended weight) | `estimated` | ~0.45 *(proposed)* | LOW (upper) | a cue tightens portion, but it's still a visual guess |

**The load-bearing detail — why the photo path forces earned fidelity to exist:**
photo's *start* (~0.35) sits **below** the LOW/MID boundary (0.4); its *ceiling*
(0.55) sits **above** it. So a fresh photo meal is **always** dashed (LOW), and
the *only* path across the boundary (dashed → hollow-ring) is the earned-fidelity
climb of Pass 2.8b — validated against outcome, never asserted by repetition.
Ship photo without that mechanic and a photo meal is permanently dashed no matter
how faithfully it's logged. That is exactly the gap Pass 2.8b closes (and exactly
why the backlog's "earned-fidelity mechanic — direction unspecified" can't stay
unspecified once photo ships). Barcode, by contrast, can reach the HIGH/MID edge
on its first scan, so it does not depend on earning anything.

---

## Pass-by-pass sequence

### Pass 2.7a — Camera infrastructure · enabler

**Concern:** Stand up the one thing both new input methods need — a camera the app
can open inside a custom dev client — *without* yet wiring either flow. Camera is
a native module, so this is also the pass that produces the dev client the project
has needed since HealthKit. Isolating it means barcode (2.7b) and photo (2.8a)
each start from a *working* camera, not a half-built one.

**What ships:**
- `expo-camera` added via `npx expo install expo-camera` (SDK-53-resolved, ~16.x),
  `--legacy-peer-deps`.
- The expo-camera **config plugin** in the existing `app.json` `plugins` array,
  with plain-English iOS `NSCameraUsageDescription` / Android `CAMERA` permission
  copy ("Scan a barcode or photograph a meal to log it").
- A **prebuild** (`npx expo prebuild`) regenerating the native projects with the
  camera permission, handled per the project's existing native-dir convention.
- A **dev-client build** on the existing EAS `development` profile
  (`eas build --profile development --platform ios`) — the profile already exists;
  this pass runs it and documents install-on-device.
- **Dev-client docs** (`dev-log/dev-client-setup.md` or an `AGENTS.md` addendum):
  how to build, install, and run against the dev client (it replaces Expo Go for
  camera/HealthKit), including the SDK-53 fact and the `AGENTS.md` "v56"
  discrepancy to reconcile.
- A **hidden test screen** (`app/camera-test.tsx`, reachable only by direct route /
  a debug entry — never in the tab bar) that opens `CameraView`, exercises the
  permission flow + live preview, and logs a scanned barcode value and a captured
  photo URI to the console. Throwaway scaffolding the later passes replace — it
  exists so 2.7a has a green, observable exit independent of either real flow.

**Verify bar:** On a physical device running the dev client, the hidden test
screen requests camera permission, shows a live preview, reports a scanned EAN/UPC
value, and captures a photo URI — all logged, **none persisted** (no Observation
written). Non-camera screens still boot under Expo Go (the camera screen is
guarded). tsc 0, all tests pass (the test screen carries a smoke test of the
permission-state branch against a mocked camera module).

**Constitution check:** Pure plumbing — a lens with no opinion. *AI in plumbing
not surface:* nothing AI here yet. *Pull not push:* the camera opens only when the
user navigates to it. *No coaching / honesty:* the only honest-surface concern is
the permission copy, which states plainly what the camera is for.

---

### Pass 2.7b — Barcode flow · fast-follow

**Concern:** Turn a scanned UPC into an honest `barcode` meal, reusing the OFF
fetch that already exists. Dylan flagged this "will be key." Item identity from a
UPC is near-exact; the honesty lives in the **portion**.

**What ships:**
- `src/lib/foodBarcode.ts` — a thin **resolution adapter** mirroring
  `foodSearch.ts`'s injectable `fetchImpl` / `db` pattern. Scanned code →
  **existing** `getFoodByBarcode` (foodSearch.ts) → a `FoodItem` with
  `sourceDb: 'openfoodfacts'`, `inputMethod: 'barcode'`, `quantityMethod`
  `'package'` (whole/declared serving) or `'estimated'` (eyeballed fraction), and
  fidelity from `defaultFidelity('barcode', { completeness })` /
  `fidelityCeiling('barcode')` (0.85). A not-found code returns the existing typed
  **null miss** — never a fabricated item.
- **Scan UI** — an `app/scan-barcode.tsx` route (or a mode of `app/log-food.tsx`)
  using `CameraView` with `barcodeScannerSettings` for EAN-13 / UPC-A / EAN-8,
  single-fire on a detected code (reuse `foodSearch.ts`'s `debounce`).
- **Resolution screen** — the scanned product (name, brand, per-serving macros)
  shown for confirm/adjust before logging. The user sets the portion (whole
  package / N servings / a fraction), which drives `quantityMethod` and pulls
  portion fidelity down to MID when eyeballed. A sparse OFF record routes its
  completeness signal into a lower fidelity, shown as the honest tier.
- `useFoodLog.addBarcode(item)`, sibling to `addWeighed` / `addDescribed`. The
  existing fidelity-tier dot renders the result unchanged.

**Verify bar:** Scan a real product UPC → resolution screen shows the OFF product →
confirm whole-package → logs a `barcode` `foodEntry` (`sourceDb 'openfoodfacts'`,
full macros, HIGH/MID-edge dot). Switch portion to "half the package" → fidelity
drops to MID. Scan an unknown code → honest "not found — describe it instead," no
fabricated item. tsc 0, all tests pass (`foodBarcode.ts` against a mocked `fetch` +
an OFF fixture, covering the sparse-record fidelity drop and the not-found miss).

**Constitution check:** *AI in plumbing not surface:* no AI at all here — a
database lookup; the only intelligence is honest portion handling. *Honesty in
fidelity:* UPC identity is high, but an eyeballed portion logs MID (not laundered
to HIGH), sparse crowd data shows as lower fidelity (not hidden), and a miss is
`null` (not invented). *Pull not push:* the scan is user-initiated. *No coaching:*
no judgment, no targets — a scanned candy bar logs as calmly as a scanned salad.

---

### Pass 2.8a — Photo capture + LLM call · fast-follow

**Concern:** Turn a photo of a plate into editable, keyless estimate rows — the
constitution's canonical "AI in the plumbing" example (*"It turns a photo into a
confident calorie estimate"*). This mirrors the shipped Describe-estimate path
(`foodEstimate.ts`) with three swaps — an image input, the `photoestimate` source,
the `photo` fidelity band — and moves the Anthropic key into secure storage.

**What ships:**
- `src/lib/foodVision.ts` — modeled almost line-for-line on `foodEstimate.ts`. One
  Claude call segments the plate into distinct foods *and* estimates each
  (`{ name, kcal, proteinG, carbsG, fatG, portionText, estimatedGrams,
  portionStated, basis }`, every macro `number | null`). Differences from the text
  path: it sends an **image content block** + text; uses `inputMethod: 'photo'`,
  source `{ type: 'photoestimate', modelVersion }`, `quantityMethod: 'estimated'`,
  and `defaultFidelity('photo', …)` (~0.35) / `fidelityCeiling('photo')` (0.55).
  Items stay **keyless** (no `sourceDb`/`foodId`). Returns `[]` on any failure →
  caller falls back to manual rows, so the logger works with no key / no network.
- **Extend `callClaude`** (`anthropicClient.ts`) to accept an optional image
  content block (base64 + media type) alongside `userMessage`, keeping the
  `json_schema` structured-output mechanism (not tool-use, not the SDK).
  `claude-haiku-4-5` via the existing swap-point constant; Sonnet 4.6 is a
  one-line escalation if accuracy is poor.
- **Image preprocessing** — add `expo-image-manipulator`; downscale/compress the
  capture before base64. Vision accuracy doesn't need full-res, and it keeps the
  token/payload cost sane.
- **Secure key storage** — add `expo-secure-store`; read the Anthropic key from
  SecureStore (fall back to the existing `app.json` `extra` for dev continuity,
  then `null` → regex/manual). Update `config.ts`; add a settings affordance to set
  the key on-device. This is the migration `config.ts` already flags.
- **Photo capture UI** (`app/capture-food.tsx` or a mode of log-food):
  `CameraView.takePictureAsync` → preview → "estimate."
- **Per-item resolution screen** — the returned estimate rows, each editable (name,
  kcal, macros, portion) before logging, reusing the editable-estimate-row
  component already built for Describe. Every row renders LOW (dashed) fidelity.
  `useFoodLog.addPhoto(items)`.

**Verify bar:** In the dev client, photograph a simple plate → within the timeout,
one or more editable estimate rows appear with plausible macros, each LOW (dashed),
source `photoestimate`. Edit a row, log → a `photo` `foodEntry` persists with
keyless items and **null-preserving** macros (a macro the model couldn't estimate
stays `null`, never `0`). Remove the key → capture falls back to manual rows, the
logger still works. tsc 0, all tests pass (`foodVision.ts` against a mocked
`callClaude` returning a fixture — covering the null-macro path and the
empty-result fallback; SecureStore read mocked).

**Constitution check:** *AI in plumbing not surface:* the vision model is invisible
engine work — the user sees food + macros + a dashed dot, never "AI" as a feature
or a chat box; the intelligence leaves no fingerprints. *Honesty in fidelity:*
photo is LOW by nature, capped at 0.55; `null ≠ 0` in both schema and prompt; the
estimate can't launder into a database lineage (keyless, `photoestimate` source).
*Pull not push:* the user points the camera; nothing fires on its own. *No
coaching:* the estimate mirrors the plate and stays editable — never a verdict,
never a "you should eat less."

---

### Pass 2.8b — Earned fidelity · scaffold (compute = Phase 7)

**Concern:** The photo path ships meals that are **permanently LOW** unless
something lets a *recurring, outcome-validated* photo meal climb toward its 0.55
ceiling. That something is **earned fidelity**. This pass does not build the
Phase-7 scoring — it **resolves the backlog's "earned-fidelity mechanic —
direction unspecified"** by locking the direction (engine-validated, per-method-
capped, forensics-only, never surfaced — all already specced in
`food-logging-spec.md`) and lands the typed derivation boundary, so Phase 7 forces
no new structure. It earns its place as a pass precisely because photo is the
first input method that makes a static fidelity field visibly insufficient.

**What ships:**
- `core/src/nutrition/earnedFidelity.ts` — a **typed derivation stub**. Its
  signature joins template **occurrences** (a query over `foodEntry` observations
  carrying a `templateId` — already available from Pass 2.4) against the
  expenditure engine's per-window **`residualConfidence`** (already exposed by Pass
  2.6) → a **per-method-capped** earned fidelity, returning
  `notImplemented('earnedFidelity', 'Phase 7')`. No value is computed; the
  *boundary* is expressed in types.
- **A guard that the logging layer never self-promotes fidelity** — encoded as a
  test: re-logging the same photo meal N× does not mutate any stored `fidelity`. A
  log's fidelity is set once, from extraction. This is the anti-streak property in
  executable form.
- **Confirmation that the existing tier visual renders an earned crossing
  silently** — a test that a composite rising past the 0.4 boundary
  (e.g. 0.45 → 0.55) flips a meal's dot dashed → hollow-ring with **no
  announcement**, no number, no progress bar. The surface needs no new code when
  Phase 7 eventually raises a real value.
- **Documentation of the two open representation mechanisms** (`supersede` vs a new
  derived overlay) — recorded, **not** chosen (see Still-open).

**Verify bar:** `earnedFidelity` is typed and stubbed (`notImplemented`); a test
proves re-logging a photo meal 4× changes no stored fidelity (logging layer never
self-promotes); a test proves a raised composite renders LOW→MID silently; and no
earned-fidelity number, bar, or goal appears anywhere in the rendered tree. tsc 0,
all tests pass.

**Constitution check:** This pass is almost purely constitutional — it exists to
**prevent** the gamification failure mode (a fidelity progress bar *is* a streak).
*AI in plumbing not surface:* the climb is engine-derived and invisible. *Honesty
in fidelity:* the per-method ceiling preserves "this is still an estimate," keeping
the forensics "your logging went blurry" move alive. *Pull not push:* there is no
"log 3 more to level up." *No coaching:* earned fidelity is never a goal or a
surfaced metric — the only visible artifact is a silent tier crossing the user may
never consciously register.

---

## Summary: build order

| Pass | What | Tag | Net new vs. reuse |
| :--- | :--- | :--- | :--- |
| 2.7a | Camera infrastructure (dep · plugin · prebuild · dev client · docs · hidden test screen) | enabler | New: `expo-camera`, dev client. Reuses the existing EAS `development` profile |
| 2.7b | Barcode flow (`foodBarcode.ts` · scan UI · resolution screen) | fast-follow | New: adapter + UI. Reuses `getFoodByBarcode`, `fidelity.ts` (`barcode` 0.85), `useFoodLog` |
| 2.8a | Photo capture + LLM (`foodVision.ts` · secure key · image input · per-item resolution) | fast-follow | New: vision module + `expo-secure-store` + image block on `callClaude`. Mirrors `foodEstimate.ts`; reuses `fidelity.ts` (`photo` 0.55) |
| 2.8b | Earned fidelity boundary | scaffold (compute = Phase 7) | New: typed derivation stub + anti-self-promotion tests. Leans on 2.4 occurrences + 2.6 `residualConfidence` |

**Order is 2.7a → 2.7b → 2.8a → 2.8b.** 2.7a is the hard gate (everything camera
needs a dev client). 2.7b and 2.8a are independent once the camera exists and could
run in either order — 2.7b first matches Dylan's "barcode will be key." 2.8b
follows 2.8a because the photo path is what forces the mechanic to exist. The
earned-fidelity *computation* stays in **Phase 7**, its scaffolding already
standing from Passes 2.4 + 2.6.

**Stop here for review before Pass 2.7a.**
