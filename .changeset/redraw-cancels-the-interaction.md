---
'tongs-browser': patch
---

Count token redraws and viewport resizes during a drag, because **redrawing a token cancels its
interaction**.

From Foundry's `PlaceableObject`, in both `draw()` and `destroy()`:

```js
if ( this.mouseInteractionManager?.state > INTERACTION_STATES.HOVER ) {
  this.mouseInteractionManager.interactionData.cancelled = true;
  this.mouseInteractionManager.cancel();
}
```

Anything that redraws a token mid gesture destroys the drag, at `GRABBED`, silently, and wipes
`interactionData` with it. That is the exact signature a device keeps reporting: the state never
leaves `GRABBED`, the drag origin is readable for a couple of samples out of hundreds, and no ending
callback fires because the ending callback needs `DRAG` to have been reached first.

The suspected cause is recorded as a suspicion rather than a conclusion, and measured instead of
argued: Foundry redraws the canvas when it resizes, and on Android the URL bar slides in and out
during a gesture, which resizes the viewport. A desktop window does not change size mid drag, which
would explain why every desktop run passes and every device run does not.

So the report now carries the viewport at the grab, the viewport now, the number of resizes during
the drag, and every `draw` or `destroy` that landed on the token while it was held. If the resize
count is zero while redraws are not, the hypothesis is dead and the cause is elsewhere. Either way it
stops being a guess.
