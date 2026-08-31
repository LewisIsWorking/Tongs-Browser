---
'tongs-browser': patch
---

Cover three accessors by asserting the state they observe.

`UiScaler.isApplied` gates whether `setScale` writes to the document at all, which is what lets the
module leave Foundry's layout untouched while it is switched off. `ExclusionZones.getSelector` now
pins a live audit finding: `#chat-log` matched nothing on 14.365 because the log is a class in that
markup, and the class form reads as a redundant duplicate without a test saying otherwise.
`CursorOverlay.setVisible` hides rather than rebuilds, so re-showing does not move the pointer to a
stale coordinate.

Mutation checked: all four mutations kill a test.

Project coverage to 97.77 statements and 97.61 functions.
