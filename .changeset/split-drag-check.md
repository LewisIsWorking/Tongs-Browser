---
'tongs-browser': patch
---

Split `foundry-drag-check.ts`, at 775 the second largest file, into seven modules under
`scripts/drag/`. The runner drops to 265. Zero script type errors, 750 tests green.

- **`Options`** is every flag, with the reasoning kept BESIDE the flag rather than in a README nobody
  opens while a check is failing. Each one exists because a run answered one question and raised
  another.
- **`Surface`** opens whichever surface was asked for. ⚠️ Playwright's `Page` and the raw CDP client
  are two genuinely different surfaces, not one type with two shapes: they agree on exactly one call
  and nothing else, which is what lets the same assertions run against desktop Chromium or against a
  phone over adb without the checks knowing which.
- **`EvaluateOn`** is that one call, named.
- **`ProbeToken`** creates the token to drag and removes it whatever happens.
- **`DragToken`** drives one drag and watches every step. ⚠️ It waits for the token's position to
  **settle**, not merely to change: Foundry animates a commit, and a position read mid animation is
  neither where it started nor where it is going.
- **`Report`** says what the drag did in terms somebody can act on.

The pan flag is now an argument rather than a global the drag reaches for, so the same function can
be asked either question rather than reading its answer from module scope.
