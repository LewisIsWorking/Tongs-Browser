---
'tongs-browser': patch
---

Stop Foundry cancelling a held drag as if it were a long press.

Foundry arms a 500ms timer on every pointerdown and clears it only when a drag actually starts,
which needs the pointer 10px from where it went down. Past that, `ControlsLayer._onLongPress` pings
the canvas and cancels the drag workflow.

That is a sound inference for a finger and the wrong one for this module. Dragging with the touch
gesture beats the timer because the finger is already moving. Dragging with the grab button does
not: you tap the button, lift, reposition, and only then move, which is comfortably longer than half
a second. Foundry then cancels a drag the user is in the middle of, and `_onDragLeftCancel` writes
nothing, so the token snaps back while every other measurement looks healthy.

The pointer now disarms that timer immediately after the opening pointerdown. The ping is untouched
for a genuine long press, because the timer is re-armed by the next pointerdown.
