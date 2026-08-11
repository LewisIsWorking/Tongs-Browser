---
'tongs-browser': patch
---

Put coordinates in the event trace, and print PIXI's pointer beside Foundry's drag origin.

A device measured Foundry's drag gate as exactly `0.0px` across eleven delivered moves. Not NaN,
zero: from PIXI's point of view the pointer never moved, while our own cursor visibly did and
`canvas.mousePosition` reported somewhere else entirely.

Two possibilities remain and nothing recorded so far separates them. Either every event dispatched
carries the same `clientX` and `clientY`, which is this module's bug, or they change and PIXI is not
mapping them, which is not. The trace recorded type, buttons and target, which is everything except
the field that now decides it, so it carries coordinates. The report also prints PIXI's pointer,
Foundry's recorded origin, the canvas bounding rect PIXI maps through, and the renderer resolution,
side by side.
