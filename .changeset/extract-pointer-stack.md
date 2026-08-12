---
'tongs-browser': patch
---

Extract the pointer wiring into `PointerStack.ts` at 100% coverage. `TongsBrowser.ts` 1,101 to 1,080.

The cursor, hit tester, dispatcher and pointer are one unit: none is useful alone, and the couple of
decisions in how they are joined are the sort a build cannot check and that read as arbitrary until
something breaks. Three now have tests rather than only comments:

- **The pointer starts in the MIDDLE of the viewport.** Anywhere else and the first thing a user does
  is drag it out of a corner, and a pointer at (0, 0) is easy to mistake for one that never appeared.
- **`elementFromPoint` is reached through the document, not passed as a bare reference.** It throws if
  it loses its receiver, and `elementFromPoint: doc.elementFromPoint` looks like a shorter way to say
  the same thing and is a TypeError at the first hit test. The test stubs a version that reads `this`,
  so a lost receiver fails there exactly as it would in a browser.
- **Every dispatched event reaches the caller.** That callback is the seam the debug overlay and the
  drag record both hang off, and a pointer wired without it looks completely normal and reports
  nothing.

Separating `eventView` from `window` is a real distinction rather than a test accommodation, and the
existing pointer suite had already found it: vitest's jsdom window is not a BRANDED Window, so
`new PointerEvent({ view })` rejects it with "member view is not of type Window". The viewport size
still has to be read from somewhere, so the two are now separate fields with the reason written down.
