---
'tongs-browser': patch
---

Extract two pure gesture decisions out of the state machine, both at 100% coverage:
`gesture/PointerTranslation.ts` and `gesture/TapWindow.ts`. `GestureStateMachine.ts` 368 to 330.

**Pointer translation** is the two modes, which exist because a phone and a tablet want different
things and neither is a compromise for the other. Trackpad applies a RELATIVE delta so the pointer
stays where it was left and sensitivity multiplies reach, which is what lets a thumb cover a screen
wider than it can span. Offset places the pointer a fixed distance ABOVE the finger so the finger
never covers the target, which suits a tablet where reach is not the problem.

The case worth having a test for:

> **Trackpad mode emits NOTHING when there is no previous position.** Without one the only available
> origin is the origin, so a first move would fling the pointer by the full distance from the top
> left corner of the screen to the finger. Offset mode has no such gap, because it is absolute, and
> that difference is now asserted rather than implied.

**The tap window** answers whether a new touch belongs to the tap before it, and it deliberately does
**not** decide between a double tap and a tap then hold drag. Both begin identically: a tap, a lift,
and a second touch soon after and close by. Only the DURATION of the second touch tells them apart,
so the same state covers both and the timer decides.

Both a time and a distance are required, and both now have tests saying why: time alone would join a
tap here to a tap across the screen a moment later, which is two separate intentions; distance alone
would join a tap to one in the same place a minute later, which is somebody returning to a control
they already used. The slop is a radius rather than a bounding box, so 15px on each axis correctly
falls outside a 20px slop.
