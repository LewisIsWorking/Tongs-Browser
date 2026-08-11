---
'tongs-browser': patch
---

Count the pointermove events PIXI delivers to the token layer.

A device peaked at `GRABBED (3)` during a drag and never reached `DRAG (4)`. That is informative
rather than merely negative: reaching GRABBED proves `pointerdown` DID arrive at the token through
PIXI, so PIXI delivery works for the press.

Foundry's `MouseInteractionManager` binds the drag's move handler on the LAYER, not on the object and
not on the DOM: `this.layer.on("pointermove", ...)`. GRABBED advances to DRAG only when moves reach
that layer. So the report now counts how many `pointermove` events PIXI delivered to `canvas.tokens`
and to the stage during the gesture.

Zero at the layer means PIXI is not routing the moves there at all. A non zero count means the layer
is receiving them and declining to act. Those need completely different fixes and nothing else
visible tells them apart.
