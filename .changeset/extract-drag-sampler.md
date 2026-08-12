---
'tongs-browser': patch
---

Extract every drag measurement into `debug/DragSampler.ts`, at 100% coverage.

The composition root was carrying sixteen fields of sampling state and a 257 line method doing the
arithmetic on them. They now live in one class whose design point is a single rule: **nothing leaves
without its sample count**.

A peak alone is not a measurement over a gesture, it is a measurement over however many samples it
happened to get, and those are the same thing only when the sampling covers the gesture. This report
stated a peak of `0.0px` as fact three separate times while holding two samples out of two hundred,
and each time it sent the investigation somewhere it did not need to go. Making the count
structurally inseparable from the reading is the fix for the class rather than the instance.

The tests assert the distinctions that cost real time, above all this one: **a drag origin that was
never readable and one that was readable and pinned both produce a peak of zero, and they mean
opposite things.** There is a test that pins exactly that apart.

`TongsBrowser.ts` is down from 1,853 to 1,457. Verified against a live Foundry after the refactor:
`foundry-drag-check` still moves a token (600, 600) to (800, 600) with peak state DRAG.
