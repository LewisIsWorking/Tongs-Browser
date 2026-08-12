---
'tongs-browser': patch
---

Split `tests/dom/virtualPointer.test.ts` (512) into six suites plus a shared harness. 766 tests
green, none changed in meaning.

⚠️ **The same trap as the modifier bar split, caught the same way.** Several tests clear `recorded`
MID TEST to isolate a phase: move, clear, move again, then assert only the second move's events. The
harness originally exported it as a `let` that tests reassigned, and a reassignment **cannot cross a
module boundary**: the importing suite keeps the old array and asserts on events it meant to discard.
It is now a `const` emptied in place.

That is the second time today a shared-array reset has nearly broken a split, and the failure is
loud both times only because the suite runs. The rule is worth stating: **a mid test reset is doing
real work and reads exactly like redundant setup.**

The harness also records why `elementFromPoint` is injected rather than reached for: jsdom does not
implement it at all, and that injection is what lets a test place elements BY COORDINATE instead of
by layout, which is the only way to test hit testing without a layout engine.
