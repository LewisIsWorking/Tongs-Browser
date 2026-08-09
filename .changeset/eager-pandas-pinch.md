---
'tongs-browser': patch
---

Fix the first pinch of every session jumping the canvas.

`CanvasController` kept its own scale, seeded to 1, and corrected it through a `syncScale` method
that nothing ever called. Foundry fits a scene to the viewport on load, so the canvas almost never
starts at 1, and `canvas.pan({ scale })` is an absolute setter. Measured against a real Foundry: a
scene sitting at 0.5 took a 1.6x pinch and landed on 1.6 rather than 0.8, a 3.2x lurch. The error is
exactly 1/initialScale, so it was worst on the large scenes a tablet user is most likely to pinch.
It also fired whenever anything else changed the zoom, including Foundry's own controls.

The live scale is now read from the canvas on every zoom, and supplying it is a required option
rather than an optional one, since an optional callback is exactly what a call site can forget.
ADR 0007.

Also adds `npm run check:multitouch`, the two finger harness that found it. It asserts the ratio
between before and after rather than an absolute scale, because an absolute assertion would have
passed while the canvas jumped.
