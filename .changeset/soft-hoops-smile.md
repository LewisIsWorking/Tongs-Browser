---
'tongs-browser': patch
---

Add the README, the architecture decision records and the manual testing checklist.

ADR 0003 records what was empirically verified about PIXI, hit testing and CSS transforms, including
the two places where the original design assumptions turned out to be wrong: Foundry runs PIXI v7
rather than v8, and browser hit testing is transform aware so no coordinate conversion is needed.
