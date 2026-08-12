---
'tongs-browser': patch
---

Split the Android harness, the largest file in the repo. **`foundry-android-check.ts` goes from 927
to 182**, into nine focused modules under `scripts/android/`. Zero script type errors, 750 tests
green.

The split follows what each part is FOR rather than what order it happened to be written in:

- **`CheckResults`** records what a check found, and keeps a skip separate from a pass.
- **`PageObservers`** watch the page: its errors with their stacks, its logs, and the font decode
  shim.
- **`Geometry`** measures the things a user has to be able to hit.
- **`CheckKeyboard`**, **`CheckHover`**, **`CheckTap`**: one file per question asked.
- **`HoverDriver`** drives the pointer onto a token and reports what Foundry saw.
- **`ProbeTokens`** creates the two tokens a hover needs and removes them whatever happens.
- **`CanvasChecks`** runs everything that needs a canvas, and hands back what it created so the
  caller can clean up. ⚠️ Tokens BEFORE the scene: deleting the scene first orphans the token delete,
  and a `[probe]` actor left in a real world reads as a mysterious NPC rather than harness debris.
- **`BarSetting`** puts the bar where it ships and back again. ⚠️ The geometry checks must judge the
  SHIPPED DEFAULT, not wherever the bar was last dragged to: a world used for testing has its bar
  somewhere convenient, so running against it measures a position nobody will see on a fresh install,
  which is the only position the default can be wrong at. The restore reports failure and swallows
  it, because it runs in a `finally` and a throw there would replace whatever the checks found with a
  cleanup error.
