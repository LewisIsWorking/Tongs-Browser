---
'tongs-browser': minor
---

Add the pointer core: the event synthesis engine behind the virtual mouse.

Event sequences are pure functions returning ordered descriptors, dispatched by a separate thin
dispatcher, so the ordering logic is tested in plain node with no DOM. Covers hover transitions on
target change, left and right click, double click, dragging with the buttons bitmask held across
the move stream, and pixel mode wheel events. Both PointerEvent and legacy MouseEvent are emitted.

Includes the coordinate transform that converts between drawn and hit tested space, without which
clicks land somewhere other than where the cursor appears once the interface is scaled.
