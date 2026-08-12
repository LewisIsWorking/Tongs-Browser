---
'tongs-browser': patch
---

Split the gesture state machine's arithmetic and its two finger handling into `TouchGeometry.ts` and
`TwoFingerTracker.ts`, both at 100% coverage.

`GestureStateMachine.ts` drops from 429 to 368 lines, and the 381 line state machine suite stays
green throughout, so behaviour is preserved.

**The geometry** is three small functions that decide whether a press is a tap or a drag, whether two
fingers are pinching or panning, and where a pinch is anchored. The state machine's own tests reach
their edges only by accident, arriving through a sequence of touches rather than asking directly.
Now asked directly, including the cases that matter:

- `separation` is **zero** for fewer than two fingers, and that is the honest answer rather than a
  fallback: a pinch is judged by a RATIO taken only once two fingers are down, so one finger has no
  separation to report rather than a small one.
- `centroid` anchors a pinch **between** the fingers. Following either one would make the map lurch
  toward whichever the browser reported first, and which one that is can change between events.

**The two finger tracker** carries the pan-versus-zoom rule, which is deliberately either-or:
applying both from one gesture makes the canvas lurch, because a small pinch always drags the
centroid slightly too. Two rules now pinned that were invisible before:

- **A ratio of 1, never Infinity.** Zero starting separation means both touches arrived at the same
  coordinate, which happens on the first move of a fast pinch. Dividing would zoom the canvas to
  nothing in a single frame.
- **A pan updates the separation as well as the centroid.** Left stale, a slow spread during a long
  pan would measure against the gesture's start, cross the threshold all at once and jump the zoom.
  Six 8px spreads under a 10px threshold now stay pans, all the way.

`TWO_FINGER` and `PINCHING` were near duplicates differing in one thing: whether the gesture has
already committed to zooming. That is now an argument rather than a second copy.
