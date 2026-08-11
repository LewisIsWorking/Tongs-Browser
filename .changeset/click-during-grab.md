---
'tongs-browser': minor
---

**Dragging a token works.** A tap while a grab was held was destroying every drag.

Found on hardware: a OnePlus 13 on Chrome 150 against Foundry 14.365, connected over wireless adb.
The report that named it showed `drag moves dispatched: 197` above `DRAG GATE: 0.0px over 6 samples`,
and a dispatch trace with a complete `pointerdown, mousedown, pointerup, mouseup, click` sitting in
the middle of a held grab. That is a finger being lifted and read as a tap.

Every click sequence opens with a `pointerdown`, and Foundry treats a pointerdown on a placeable as
the START of an interaction: it records a fresh `screenOrigin` wherever the pointer is now. Its drag
begins only once the pointer is `dragResistance` (10px) from that origin, so an origin that keeps
being re-recorded under the pointer can never be far enough from it. The drag stalls at `GRABBED`
forever, no preview is created, and the token does not move however far you drag. The pointer
travelled 140.3px and Foundry's own gate never read above zero.

Clicks are now suppressed while a grab is held. Movement, `endDrag` and `cancelDrag` are untouched,
because moving the pointer IS the drag and swallowing a release would strand a held button.

The guard lives in `GestureController` rather than in the state machine. The machine is pure, holds
no reference to the pointer, and "is a button already down" is pointer state rather than gesture
state. That separation is exactly why this survived: the machine's tap handling is correct in
isolation and every one of its tests passes.

`GestureController` had **no test file at all**, which is the second time on this project that the
class carrying out the actions went untested while the pure thing choosing them was covered
thoroughly. `CanvasController` was the first, and it was also hiding a real bug. Both
`GestureController` and `ModifierBar` are now at 100% statements, branches, functions and lines, and
that turned up two more untested things on the way: the bar's own drag handle, and the guard covering
drift between `MODIFIER_CODES` and `MODIFIER_KEYS`, two lists of the same three keys maintained
separately in two files. There is now a test asserting they agree.
