---
'tongs-browser': patch
---

Cover the two worst branch gaps, both of which hide something silently.

The timeline heading only says how many entries it dropped on one side of a ternary, and that side
was never taken. A trimmed timeline that does not say so reads as a complete account of the gesture,
so the reader concludes a button press never happened rather than that it scrolled off.

`maskForButton` never took its MIDDLE case. `button` counts LEFT 0, MIDDLE 1, RIGHT 2 while the
`buttons` bitmask is LEFT 1, RIGHT 2, MIDDLE 4, so the obvious `1 << button` swaps middle and right
invisibly for anyone testing with a left click. The table is pinned, along with an assertion that the
mapping is not a bit shift.

Project coverage to 97.83 statements and 95.82 branches.
