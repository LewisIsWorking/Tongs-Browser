---
'tongs-browser': patch
---

Stop the module's own bar leaking pointer events onto Foundry's canvas.

Tapping the grab button with a finger put four events on the window that PIXI listens for, all at
the button's own coordinates: a touch `pointerdown` and `pointerup`, and the browser's touch
compatibility `mousedown` and `mouseup`. PIXI maps events onto the canvas BY COORDINATE rather than
by DOM target, and the bar sits over the canvas, so Foundry received a pointerup it was never meant
to see. `MouseInteractionManager#handlePointerUp` ends with `#handleDragCancel`.

The bar was an excluded region, which is correct for the gesture layer and wrong here. Those are two
different questions about the same element: the gesture layer must keep away from our bar, and our
bar must never reach the canvas. The suppressor now decides this itself rather than by composing
predicates at the call site.

Measured before and after against a live Foundry with a real finger: four leaked events, then none,
with the button still working because `click` is deliberately untouched.
