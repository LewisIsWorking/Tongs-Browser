---
'tongs-browser': patch
---

Extract the modifier bar's clamping arithmetic into `modifiers/BarClamp.ts`, at 100% coverage.

⚠️ **These cases were unreachable from the DOM suite.** jsdom reports `offsetWidth` as 0 for every
element, so every clamp the bar's DOM tests ran was against a zero sized bar, where the maths
degenerates and all four branches collapse to the same answer. 825 lines of `modifierBar.test.ts` and
336 of `modifierBarDragHandle.test.ts` could not touch any of it. Separating the numbers from the
element is the only way this behaviour gets checked without a real layout engine.

What is now pinned, all of it measured on a 412px phone rather than reasoned about:

- **Keeps out of the SIDEBAR, not merely out of the window.** Once the bar wraps it reaches the right
  edge, where Foundry's sidebar lives, and the shipped default covered the sidebar's icon column
  between y 120 and 250. Worse than covering anything else, because the sidebar is how the user
  reaches chat, actors and the rest of Foundry.
- **Falls back to the whole window when the bar cannot fit beside the sidebar.** Trading a covered
  sidebar for a bar hanging off the left edge is not a fix. A bar wider than the room beside the
  sidebar has no correct position, so the least wrong answer is the one where all of it is reachable.
- **The width is capped, not just the position.** The bar is `position: fixed` with only `left` set,
  so it is shrink to fit: moving it LEFT makes it WIDER and its right edge stays pinned to the
  viewport edge. Clamping x from 88 to 65 changed the width from 324 to 347 while the right edge
  stayed at 412. The cap is computed from the CLAMPED x, so one pass converges.
- **A bar with no layout yet is left alone**, or it gets dragged to the origin by any render that
  runs before the browser has measured it.

`BarPosition` moves to its own file, so `BarClamp` can name a position without importing the bar that
imports it. Re-exported, so every existing importer keeps working unchanged.
