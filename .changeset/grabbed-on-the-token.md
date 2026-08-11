---
'tongs-browser': patch
---

Say whether the grab actually landed on the token, and stop the record describing the aftermath.

**The drag fix works.** A device confirmed a token moving for the first time. The very next report
showed no movement again, and it turned out to be a different thing entirely: the grab began a few
pixels off the token. Foundry starts a drag from a pointerdown that HITS a placeable, so a press on
empty canvas begins a selection rectangle instead, records no drag origin, and peaks at `HOVER`.
Every number in that report was individually correct and collectively described a gesture nobody
meant to perform.

The report now leads with **GRABBED ON THE TOKEN**, answered at the moment of the grab, and says how
far outside the token the pointer was when the answer is no. The old line for this,
`insideSelectedToken`, is read at report time, long after the pointer has moved on and been used to
tap the button that produced the report.

Two things this also fixes:

- **The record now FREEZES on the drop.** Scoping it to the drag stopped a later tap overwriting the
  gesture and still let the commoner case through: ordinary movement after the release. Those arrive
  by the hundred and the trace is eighteen entries long, so a device reported 305 drag moves above
  eighteen consecutive `buttons=0` moves, which describes the moment after the drag. The travel
  counters were polluted the same way.
- `DRAG GATE: NOT MEASURABLE` earned its keep immediately. Printing the old fake `0.0px` here would
  have read as "the pointer never moved" for a third time.
