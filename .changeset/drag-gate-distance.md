---
'tongs-browser': patch
---

Measure the exact distance Foundry gates a drag on, and lead the report with it.

A device now reports the layer genuinely receiving moves and the state still stuck:

    PEAK state: GRABBED (3), previews 0
    PIXI moves: layer=13 stage=70

So Foundry's handler is running thirteen times and declining to start the drag. Its gate is one
comparison in `#handlePointerMove`:

    Math.hypot(event.global.x - screenOrigin.x, event.global.y - screenOrigin.y) >= dragResistance

with a default resistance of 10. The report now computes that same distance from Foundry's own
`interactionData.screenOrigin` and PIXI's own pointer, and reports the peak across the gesture. Either
it never reaches 10, or it is NaN, and `NaN >= 10` is false, which fails silently and forever.

The decisive numbers now lead the report rather than trailing it. A phone chat window shows about
fifteen lines, and the previous report was cut off exactly at the field the whole round existed to
read, which costs a full round trip. Ordering a diagnostic by narrative rather than by how much each
line discriminates is a bug in the diagnostic.
