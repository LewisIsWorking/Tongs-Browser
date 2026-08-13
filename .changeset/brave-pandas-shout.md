---
'tongs-browser': patch
---

Let the bar be dragged again, and open it collapsed.

The drag handle stopped receiving anything in 0.25.52. Suppressing our own interface's pointer
events is done with `stopImmediatePropagation` on the window in the capture phase, which is upstream
of every listener in the document, so "PIXI must not see this" was implemented as "nothing may see
this" - and the handle is built entirely out of the four pointer events bound on itself.

The suppression itself is measured and stays: a finger's `pointerup` reaching PIXI runs
`#handlePointerUp`, which ends in `#handleDragCancel` and throws away a held token drag, which is
what makes tapping DROP work at the end of a drag. So the fix is a narrow carve-out rather than a
revert. Only the drag handle carries the new marker; a tray button beside it is still suppressed.

The bar now opens partially collapsed. Expanded it is the full key grid plus the tray and covers
roughly a quarter of a 360x607 phone viewport, on top of the map. Collapsing keeps the tray, so the
hand, drop, pause and diagnose buttons stay put, and `<` brings the modifier keys back in one tap.
