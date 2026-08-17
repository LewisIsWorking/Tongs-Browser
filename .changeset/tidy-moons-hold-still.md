---
'tongs-browser': patch
---

Fix: a finger resting in the sidebar counted as half of a two finger gesture.

`TouchEvent.touches` holds every finger on the screen, not the fingers on the event's target.
`TouchBinder` correctly ignores an event whose target is excluded, so a finger landing in the sidebar
reported nothing to the state machine - and then the next canvas `touchmove` carried that finger in
its own `touches` list, where `SingleFingerStates` counted it, because two-fingerness is decided by
`input.touches.length >= 2`.

So the machine never heard the finger arrive and counted it regardless. One finger dragging a token
became a pan or a pinch because the other hand was holding the tablet with a thumb over the sidebar,
which is how a tablet is held.

Fixed at the single boundary where events become gesture input, in the new `ActionableTouches`, so the
four `>= 2` checks across three downstream files did not each have to learn about exclusion zones. Two
fingers on the board still pan, and a touch whose `target` cannot be read is kept rather than dropped,
since silently disabling pan and zoom on an engine that omits it would be the worse bug.

Also collapses three byte-identical touch handlers that sat beside a fourth quietly omitting
`preventDefault`, with nothing saying whether that was a decision. It is one, and now says so.
