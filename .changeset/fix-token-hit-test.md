---
'tongs-browser': patch
---

Fix `insideSelectedToken` reporting the wrong answer in BOTH directions, and extract the test into
`debug/TokenHitTest.ts` at 100% coverage.

This field separates **"the drag did not work"** from **"the drag was never aimed at anything"**, and
those are completely different problems. It was wrong two ways at once, because the axes were guarded
differently:

```
mouse.x >= document.x && mouse.x <= document.x + (w ?? 0)      // x: guarded
(mouse.y ?? 0) >= (document.y ?? 0) && (mouse.y ?? 0) <= ...   // y: NOT guarded
```

- **A false INSIDE.** With `mouse.y` and `document.y` both absent, y evaluated `0 >= 0 && 0 <= 0`,
  which is true. Missing data reported a hit, sending somebody hunting a drag bug when the pointer
  was never on the token.
- **A false OUTSIDE.** `w ?? 0` makes the box zero pixels wide, so only the exact left edge counted
  and every real position reported a miss, sending somebody to aim a pointer already on target.

Now every field must be present, and missing data answers **no, never yes**. Also documented on the
type: `w`/`h` are the RENDERED size in scene units and are **not** `document.width`, which is a size
in GRID SQUARES. A hit test against the document's width silently tests a box one square across,
which on a 100px grid is a 99% miss.

`TongsBrowser.ts` is down to 1,153 from 1,853 at the start of the day.
