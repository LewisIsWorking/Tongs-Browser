---
'tongs-browser': patch
---

`DragRecorder` was 81% covered with 55% of branches, and the untested part was the denominator every
other number in a drag report is judged against.

`describeThinly` refuses to state a peak sampled under 10% of the moves dispatched, so if that count
is wrong every probe is declared thin and the whole report becomes unusable. A report of "2 samples
of 227 moves" was once counting hundreds of moves that happened after the drag it described.

Now asserted: moves are counted during a drag, not after it ends, and not when no drag has started at
all. Also that a missing token records no grab position rather than a misleading zero, that raw touch
counts accumulate rather than reset, and that the movement verdict compares the grab position against
the position now.

⚠️ The most important test did not work on the first attempt, and mutation checking is the only
reason that is known. "Stops counting once the drag has ended" passed with the guard deleted, because
after a drop the capture window freezes and the recorder returns early, so that path never reaches
the counter. The case where the guard is load bearing is a move with no drag ever started, which is
constant on a phone between gestures. That case is now covered and the mutation fails.

`DragRecorder.ts` 81% to 96.9% statements and 55% to 95% branches; the project 94.9% to 95.1%.
