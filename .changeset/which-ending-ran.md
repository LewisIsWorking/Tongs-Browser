---
'tongs-browser': minor
---

**The drag reaches Foundry's DRAG state with a preview clone.** Stopping the raw touch stream reaching
PIXI in 0.22.0 was the fix for that half:

| | before | after |
| --- | --- | --- |
| Foundry drag origin readable | 2 samples of 235 | **454 of 454** |
| drag gate | 0.0px | **200.9px**, needs 10 |
| peak interaction state | `GRABBED (3)` | **`DRAG (4)`** |
| preview clones | 0 | **1** |

The token still does not move, so the failure has moved from the gate to the **ending**, and those are
two different handlers on Foundry's Token that are indistinguishable from outside:
`_onDragLeftDrop` reads the clones and writes the new position, `_onDragLeftCancel` destroys the
preview and writes nothing. Both reset the state, both clear the preview, and both leave the token
where it was. The report now says which one ran, by wrapping them: the original is called with the
original `this` and its result returned untouched, so it observes without changing behaviour.

Also fixes an off by one that hid the most important event in the trace. `endDrag` clears the dragging
flag before dispatching, so at the release the recorder already saw `dragging: false`; setting the
"saw a drop" flag before the freeze meant the freeze fired on the release itself and the `pointerup`
was never recorded. Every device trace ended on a `pointermove`, which made a released drag look
exactly like one still being held.
