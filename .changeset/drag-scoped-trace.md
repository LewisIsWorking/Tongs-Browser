---
'tongs-browser': patch
---

Scope the diagnostic record to the drag, and count raw touch input.

A pasted report came back showing a clean `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`
at one unchanging coordinate with zero PIXI moves. That describes a tap, not the drag it was asked
about, because the record reset on every `pointerdown` and a single tap after the drop wiped the
whole drag out of the buffer. The counters reset with it, which turned a previously measured 0.0px
gate distance into a meaningless NaN.

The window now opens when a drag begins and stays open until the next one begins, so nothing after
the drop can overwrite what is being diagnosed.

The report also counts raw touch input reaching the gesture layer. A trace with no `pointermove` has
two completely different causes, the finger producing no gesture input at all or the gesture layer
declining to move the pointer, and nothing else in the report separates them.
