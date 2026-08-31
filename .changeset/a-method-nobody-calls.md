---
'tongs-browser': patch
---

Remove `CanvasController.isAvailable()`, which nothing called.

It was the worst remaining function-coverage gap, and the reason was that no caller existed anywhere
in src, tests or scripts. It read `getCanvas()?.ready ?? false`, the same check `panBy` and `zoomBy`
each already make inline, so keeping it meant two statements of one rule with only one of them
reachable.

Writing a test for it would have raised the number and locked dead code in place, which is the
failure mode the coverage gate exists to avoid rather than cause.

Project coverage to 98.03 statements and 98.16 functions, by deletion rather than by test.
