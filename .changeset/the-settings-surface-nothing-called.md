---
'tongs-browser': patch
---

Test the settings surface, which no test called.

`main.ts` registers a Foundry setting for each of `setUiScale`, `setCursorSize`, `setDebugOverlay`,
`setModifierBarVisible`, `updateGestureConfig`, `refreshTray` and `getKeyboardStrategy`, and nothing
else calls them. An unexercised one is a setting that silently does nothing, or does half of what it
says.

Half was the real risk: `setUiScale` also re-clamps because a scale change moves where every window
sits, and `setModifierBarVisible` also probes the keyboard on show and releases held modifiers on
hide. A test checking only the obvious effect would pass with the second one deleted.

Mutation checked line by line: dropping the re-clamp, the probe, the attach, the detach, the cursor
resize or the scale apply each kills a test.

Project coverage 96.12 to 96.59 statements, 93.57 to 94.49 functions.
