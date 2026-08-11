---
'tongs-browser': patch
---

Hook Foundry's interaction MANAGER, not just the token, because the token's callbacks have a blind
spot that hid the cancel.

The `contextmenu` fix worked: the three `_onDragLeftCancel` calls are gone. What replaced them was
`FOUNDRY'S DRAG ENDING: NEITHER ran`, with the state peaking at `GRABBED` and the drag origin
readable for 2 samples of 164 moves. That reads as "nothing happened", and reading Foundry's source
says otherwise.

From `cancel()`:

```js
if ( endState <= this.states.HOVER ) return ...SKIPPED
if ( endState >= this.states.DRAG ) { this.callback(action, event) ... }
```

**The cancel callback only fires once the state has reached DRAG.** A cancel arriving at `GRABBED`
resets the interaction and calls nothing at all, so the probe watched the drag being destroyed and
reported that neither ending ran. `reset()` sets `interactionData = {}`, which is exactly why the
origin kept vanishing.

Both `cancel` and `reset` are now wrapped on the manager prototype, recording the state they were
called in and the event that caused them, so a silent cancel is no longer silent.

Also corrects something this report has been asserting for three releases: **`interactionData` is not
transient.** It is a plain property that persists until `reset()`. A low sample count therefore never
meant "read at the wrong moment", it meant the data was being wiped mid gesture, and the report now
says so.
