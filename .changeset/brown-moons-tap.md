---
'tongs-browser': patch
---

Exercise the gesture machine with real, trusted touch input.

`npm run check:touch` injects touch through Chrome DevTools Protocol, so the events carry
`isTrusted: true` and the browser emits its own compatibility pointer and mouse events alongside them
exactly as a tablet does. That last part cannot be reproduced by a hand built `TouchEvent`, and it is
precisely what the native touch suppressor exists to handle.

Five checks, all passing on 14.365. The important one is that a tap clicks at the pointer rather than
under the finger: the pointer is parked on a sidebar tab, the finger taps far away over the canvas,
and the tab changes. Recorded in ADR 0006, which closes the touch gap ADR 0005 left open. Multi touch
is still uncovered.
