---
'tongs-browser': patch
---

Make the report refuse to state a number it barely sampled, and stop a lost tab reading as a crash.

`pointercancel` was not it. v0.21.0 changed nothing on the device, and the theory is dead.

What the same report finally revealed is a fault in the instrument. `DRAG GATE` and `ORIGIN drifted`
both read Foundry's `interactionData`, which is **transient**: it exists while Foundry is handling an
event and is gone afterwards, and these read it after `dispatchEvent` has returned. Measured three
times running on a device: **2 samples**, against 55, 235 and 305 dispatched moves. Two is exactly
the number of dispatches in a grab, `pointerdown` and `mousedown`, which is the one moment the field
reliably exists.

So both numbers describe the press and not the drag, and they have looked authoritative while doing
it. `0.0px, needs >= 10` was read as "the pointer never moved" on three separate occasions and sent
the investigation somewhere else each time. Where the sampling covers less than a tenth of the moves,
the report now says **IGNORE THIS NUMBER** and why.

Also: a tab that goes away mid check, because Foundry was reloaded on the phone, produced a raw
WebSocket stack trace and a `ReferenceError: canvas is not defined` from cleanup running against a
dead context. Both read like code faults; neither was one. The CDP client now names it.
