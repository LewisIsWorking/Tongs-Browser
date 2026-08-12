---
'tongs-browser': patch
---

Extract the action tray's buttons into `ui/TrayActions.ts`, at 100% coverage.

Taken as a set of handlers rather than the module itself, so the list builds and is asserted on
without a canvas, a pointer or a Foundry. What is worth protecting is the **content**, not the
wiring: a build catches a missing handler, and catches none of these.

- **The pan signs read backwards on purpose.** Pressing right moves the VIEW right, which is the same
  as dragging the map LEFT, so the delta is negated. Getting it wrong gives four buttons that work
  perfectly and all go the wrong way. Now pinned per direction.
- **Grab says DROP while held.** The regression that cost a whole round of device diagnostics: gold
  latch styling says "on", but "on" does not say the next thing to do is tap it OFF, and Foundry only
  commits a token's move on the DROP. A report came back mid drag with the token quite correctly
  sitting where it started.
- **Zoom out is the reciprocal of zoom in**, so out-then-in lands exactly back.
- **Momentary buttons report no active state**, since a latch on one invites an undoing tap.

`TongsBrowser.ts` is down to 1,218 from 1,853 at the start of the day, across twelve extracted
modules all under 200 lines and all at 100% on statements, branches, functions and lines.
