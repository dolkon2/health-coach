---
name: sim-smoke-test
description: Run a headless iOS simulator smoke test of the app after a build — seed sample data, deep-link to the changed feature, screenshot the result, and check for runtime errors. Use before declaring a pass "done" when the change is user-facing and hasn't been visually verified yet.
---

# Sim smoke test

Tests passing and tsc clean prove the code is internally consistent — not that the feature actually works when a person opens the app. This is the headless verification pattern already used successfully for the Reflect milestone and the expenditure system (see [[project_app.md]] "SIM-VERIFIED headless" entries).

## When to run this

Any build pass that touches a screen, a flow, or user-visible behavior, and hasn't been confirmed on-device or on-sim yet. Skip it for pure backend/logic changes with no UI surface.

## Steps

1. **Start Metro** from the correct worktree (`npx expo start --ios`, per [[project-expo-env]] — never from `~/Claude Set up`).
2. **Boot the iPhone 17 simulator** if not already running (`xcrun simctl boot` or launch via Expo).
3. **Seed sample data** matching the feature under test — reuse existing seed patterns (DB-seed scripts) rather than manual taps where possible.
4. **Deep-link directly to the changed screen** rather than tapping through the whole app, unless the flow being tested IS the navigation.
5. **Screenshot the result** via `xcrun simctl io booted screenshot <path>` and check it against what the spec/plan describes as "done."
6. **Check logs** for red-screen errors, warnings, or silent failures Metro would surface.
7. **Leave the sim in a clean, seeded state** if the user wants to tap through by hand later — note in your summary what's seeded and where.

## Output

- Screenshot path
- Pass/fail against the spec's "done looks like" bullets
- Any runtime error surfaced (with the fix if trivial, or a flag if not)
- Whether human tap-through is still needed for anything (e.g. gesture-driven interactions headless can't exercise)
