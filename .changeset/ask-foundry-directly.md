---
'tongs-browser': patch
---

Fix the call site naming itself, and ask Foundry directly whether it will allow a drag.

⚠️ **The call site reported `MouseInteractionManager.wrapped`, which is OUR OWN wrapper.** It is
assigned onto `MouseInteractionManager.prototype`, so its stack frame reads
`MouseInteractionManager.wrapped` and matched the search before any real frame did. The previous
release added a comment saying "naming the wrapper says only that the observer observed" and then
shipped code that did exactly that. Our frames are now filtered out before the search, not only in
the fallback.

**And the report now asks the manager instead of inferring.** `#handleDragStart` is the one cancel
path that fires on something other than a pointerup:

```
if ( !this.can(action, event) ) {
  this.#debug(action, event, this.handlerOutcomes.DISALLOWED);
  this.cancel(event);
  return;
}
```

A refused `dragLeftStart` cancels the whole interaction, and nothing else in the report would say so:
the state, the gate and the origin all look exactly as they do for any other cancel. `clickLeft`,
`dragStart` and `dragLeftStart` are now printed beside the interaction state. `dragStart` matters
separately because `#handleClickLeft` only reaches GRABBED and binds the drag handlers when it
passes, so one false and the other true are two different failures.

Reading a stack frame was the indirect way to answer this. The manager has a method that answers it
outright.
