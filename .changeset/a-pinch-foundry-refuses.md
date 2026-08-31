---
'tongs-browser': patch
---

Test the zoom limit thunk, reached only by a pinch.

`getZoomLimits` was the last of the four `ModuleParts` canvas thunks with no caller: the pan suite
reaches the other three, and only `zoomBy` asks for the limits. The clamp it feeds is what stops a
pinch driving the scale to a value Foundry refuses, after which the canvas ignores zoom entirely
until the scene is reloaded.

Asserts the ceiling, the floor, and that both are read from Foundry's published config rather than
carried as constants: two runs with different maxima must land on different ceilings. Hardcoding the
limits fails three of the four tests.

`ModuleParts` goes to 90.9% of functions; project coverage to 97.93 statements and 96.12 branches.
