---
'tongs-browser': minor
---

Add a diagnostics button that whispers a report into chat.

A drag failure reported from a real phone could not be reproduced on any surface available for
testing. It works on desktop through the full gesture layer with real injected touch, and the
emulator's Chromium 133 cannot hit test canvas objects from synthetic events at all, so it can
neither confirm nor deny anything. Three plausible hypotheses were each disproven by measurement:
the active tool being hijacked by this module's own scene control (measured `select` before and
after), pause blocking the drag (only applies when not a GM), and moves not carrying the held button
(fixed, and desktop drags 800 to 1300).

That is the point at which guessing should stop and the device should be asked directly. The button
reports the active tool, the controlled token and its `_canDrag`, the pointer position and drag
state, the element under the pointer, `canvas.mousePosition` and whether it sits inside the selected
token, the canvas and keyboard state, and the user agent.

Chat rather than the console, deliberately: it is the one output surface a phone user already has
open and can screenshot, where reaching devtools on Android needs a cable and a laptop. Whispered to
self so it never lands in front of players.
