---
'tongs-browser': patch
---

Count the moves PIXI delivers to the **token itself**, which is the only one of the three that decides
a drag.

Stopping the raw touch stream reaching PIXI was a real bug and was not this one: v0.22.0 changed
nothing on the device. The report still says `PEAK state: GRABBED (3)` with a pointer that travelled
122px.

Foundry evaluates its 10px drag gate inside a handler bound on the **object**, and PIXI delivers to an
object only while the pointer is over it. So the gate is checked only while the pointer is still
standing on the token, and if it has not opened by the time the pointer leaves, it never will. Every
PIXI count in this report so far has been of the **layer**, which is a different object entirely, and
it was read three times as though it answered this. A layer count stays perfectly healthy while the
token receives nothing at all.

`PIXI moves TO THE TOKEN` now leads that section, and calls out a zero explicitly, because a zero
means the gate was never evaluated after the press and no amount of travel could have opened it.

Also adds `scripts/await-device-then.ts`. Chrome on Android serves its debugging socket only while
the browser is in the foreground, which turns every device run into a rendezvous the user cannot keep:
the way they report a result is by switching to another app to paste it. Four runs died to that, each
looking like a different fault. The check now waits for the socket and starts itself, re-establishing
the adb forward on each attempt since a forward survives the socket going away and then points at
nothing.
