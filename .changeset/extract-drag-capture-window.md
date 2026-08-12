---
'tongs-browser': patch
---

Extract when the drag record opens, freezes and retires into `debug/DragCaptureWindow.ts`, and fix a
defect in the move counter that this made visible.

**The diagnostic was measuring the wrong thing.** The freeze that closes the record on the drop sat
BELOW the move counter, so every pointer move after the drop still incremented the denominator while
sampling had already stopped. That denominator decides whether a probe was watching: `describeThinly`
refuses to state a peak sampled under 10% of the moves. On a phone the pointer keeps moving for as
long as it takes to read the report, so the count ran away and every probe was declared too thinly
sampled to state. **A report of "2 samples of 227 moves" was counting hundreds of moves that happened
after the drag it was describing.**

A measuring instrument that keeps measuring after the event does not report the event. The counter
now sits after the freeze.

The state machine is now fed sequences and asserted on, at 100% including all 27 branches. The two
rules that look arbitrary and are not:

- **The release is RECORDED, not frozen on.** `endDrag` clears the dragging flag before dispatching,
  so at the release the window is already told `dragging: false`. Marking the drop any earlier froze
  on the release itself, and every device trace then ended on a `pointermove`, making a released drag
  look identical to one still held. That is the exact distinction the report exists to draw.
- **A fresh press retires the record even while frozen.** Retiring is a side effect that has to happen
  either way. Skipped whenever the record was frozen, which is every time a drag has completed, it
  could never be retired at all.

`TongsBrowser.ts` is down to 1,162 from 1,853 at the start of the day.
