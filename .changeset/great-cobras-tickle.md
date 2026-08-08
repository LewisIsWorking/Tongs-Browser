---
'tongs-browser': minor
---

Add the gesture layer and wire the module up so it runs.

A finite state machine with explicit named states translates touches into pointer actions: tap to
click at the pointer rather than at the finger, long press to right click, double tap, tap then hold
to begin a drag, two finger pan, and pinch to zoom. The machine is pure, taking timestamps as input
and requesting timers as actions, so every transition is tested without a DOM or a clock.

Text inputs, contenteditable regions, the chat log and the sidebar are excluded, so typing and
native scrolling keep working. Real touch derived pointer events are suppressed at the capture
phase, behind its own toggle since that is the most likely source of conflict with another module.
