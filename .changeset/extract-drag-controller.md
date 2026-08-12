---
'tongs-browser': patch
---

Extract `pointer/DragController.ts` at 100% coverage. **`VirtualPointer.ts` drops from 237 to 199,
under the limit**, and 725 tests stay green including the 512 line pointer suite.

The three parts move as one: whether a button is held, WHICH button, and which element owns the
gesture. Splitting them is how a drag ends up half released, with Foundry still believing a button is
down and a token stuck to the pointer.

What the new suite pins, none of it visible to a build:

- **The capture is claimed AFTER the press is dispatched**, because the press is what resolves the
  element. Claiming before would capture whatever the previous gesture left behind.
- **The release goes to the element that received the press, not where the drag ended.** The target
  is resolved before the held flag is cleared; resolving after takes the fallback path and hit tests
  at the pointer, which by then is wherever the finger stopped.
- **Any movement during a held drag is a drag move**, dispatched at the captured element. The buttons
  bitmask has to stay set on every move between the down and the up, or Foundry reads the stream as a
  hover and nothing follows the pointer.
- **`moveStep` reports whether it handled the move**, so the caller falls through to ordinary hover
  handling rather than the two paths each deciding separately what state they are in.
- **A detached capture falls back to a hit test.** Foundry re-renders applications mid interaction,
  and dispatching at a detached element throws the event away silently.

Production files over 200 lines: **five this morning, three now**.
