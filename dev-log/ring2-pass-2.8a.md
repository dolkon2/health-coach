# Ring 2 — Pass 2.8a — Photo → LLM nutrition estimate

**Goal:** Turn a photo of a plate into editable, keyless estimate rows — the
constitution's canonical "AI in the plumbing" example. Mirrors the shipped
Describe-estimate path (`foodEstimate.ts`) with three swaps: an image input, the
`photoestimate` source, and the `photo` fidelity band (~0.35, capped 0.55 —
always LOW/dashed, because 2D portion estimation is limited by nature).
(planning/ring2-camera-build.md § Pass 2.8a; built on branch
`claude/ring2-photo-nutrition-9t4c8b` off main `c10894a`.)

## What shipped

- **`src/lib/anthropicClient.ts`** (`2393786`) — `callClaude` accepts an optional
  `image: { data, mediaType }` content block alongside `userMessage`, keeping the
  `json_schema` structured-output mechanism (no SDK, no tool-use).
- **`src/lib/foodVision.ts`** (`87983dd`) — modeled line-for-line on
  `foodEstimate.ts`; reuses its `ESTIMATE_SCHEMA` + `estimatedItemToFoodItem`.
  One Claude call segments the plate AND estimates each food (`portionStated`
  always false — a photo never states an amount; `basis` records the size cue).
  `VISION_MODEL = 'claude-haiku-4-5'` (single swap point; flip to
  `claude-sonnet-4-6` if real-plate accuracy is poor), 12 s timeout, 1024
  max tokens. Returns `[]` on ANY failure; `photoToItems([])` yields one blank
  manual row so the logger works with no key and no network.
- **`useFoodLog.addPhoto`** (`fe1a014`) — logs a `photo` meal:
  `inputMethod: 'photo'`, source `{ type: 'photoestimate', modelVersion }`,
  `quantityMethod: 'estimated'`, keyless items, null-preserving macros.
- **Photo mode in `app/log-food.tsx`** (`e35e62d`) — 4th input chip. Live
  `CameraView` → capture (base64, quality 0.4 — keeps the payload sane without
  an image-manipulator dep) → estimate → rows land in the same editable estimate
  list Describe uses (name/portion/kcal/P·C·F, dashed fidelity).
- **Polish round** (`cfc9fcc` + `21f241b`) — capture IS the commit (the separate
  "Estimate this plate" tap is gone; a bad shot = remove its rows and reshoot);
  once the meal has rows the camera collapses to a "Take another photo" button;
  mode chips render 2×2 via a new `ChipSelect` `columns` prop; square frames.

## Deferred vs. the spec (deliberate, per Dylan's 2026-07-01 call)

- **`expo-image-manipulator` downscale** — capture-time `quality: 0.4` stands in;
  no new dependency.
- **`expo-secure-store` key migration** — the key stays in gitignored
  `.env.local` (`EXPO_PUBLIC_ANTHROPIC_API_KEY` via `config.ts`). Secure-store is
  a NATIVE module: adding it forces a fresh EAS dev build on the phone. Deferred
  so this pass runs on the existing dev client.
- Both remain flagged in the spec as the 2.8a hardening tail.

## Tests & verification

- `src/lib/__tests__/foodVision.test.ts` — mocked `callClaude`: multi-item plate
  fixture, **null-macro preservation** (null ≠ 0), empty/no-food → `[]`,
  failure → blank-row fallback, name trimming/filtering.
- `src/lib/__tests__/anthropicClient.test.ts` — image content block shape,
  text-only path unchanged.
- `src/lib/__tests__/foodLog.test.ts` — `photo` meal source/inputMethod.
- **278/278 jest (27 suites), tsc 0** after the polish round.
- **Device verify still owed (Dylan):** camera needs the physical-iPhone dev
  client (sim CameraView is a black box) — photograph a plate → editable dashed
  rows with plausible macros → edit one → log → `photo` entry persists; pull the
  key → capture falls back to a manual row. Metro from this worktree.

## Constitution check

AI in the plumbing (food + macros + a dashed dot — never "AI" as a surface);
photo fidelity honest at LOW, ceiling 0.55; null ≠ 0 in schema AND prompt;
keyless items can't launder into a database lineage; pull-not-push (user points
the camera); the estimate stays editable — a mirror, never a verdict.
