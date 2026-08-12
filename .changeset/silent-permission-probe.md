---
'tongs-browser': patch
---

Stop the diagnostics report warning the player, and cover the grab-then-drag path end to end.

`describeDragPermissions` asked `dragLeftStart` through `MouseInteractionManager#can`, which offers
no way to pass Foundry's `notify: false`. Every refusal path inside `_canDragLeftStart` calls
`ui.notifications.warn`, so a player pressing the diagnose button could get a toast on screen. It
now asks the placeable directly and silently, and carries the one field the check was measured to
read.

The grab button's real path had no check at all: the drag harness drives the pointer from
JavaScript and never touches the bar, and the touch harness touches the bar but never drags a token.
`check:grab` now performs the whole sequence with a finger, including the 700ms pause that a person
takes and that Foundry reads as a long press.
