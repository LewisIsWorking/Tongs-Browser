---
'tongs-browser': patch
---

Split `ModifierBar` into `BarChrome`, `BarAttachment`, `ModifierBarOptions` and a re-homed
`DEFAULT_POSITION`. **`ModifierBar.ts` drops from 270 to 193, under the limit.** 741 tests green.

**`BarChrome`** builds the bar's furniture, and separating it lets the one load bearing line be
asserted rather than merely commented:

> **`data-tongs-browser="ignore"`, without which the bar cannot work at all.** Every touch on the
> page is routed through the virtual pointer, so a tap on a modifier key would become a pointer event
> delivered wherever the pointer happens to be. The key would modify a click somewhere else on the
> map rather than latching, which is the exact opposite of its job.

Also now asserted: `pointercancel` goes to the SAME handler as `pointerup`, because the browser
cancels a pointer whenever it takes a gesture over and a bar that never hears about it is left
believing a finger is still down, so the next unrelated move drags it across the screen.

**`BarAttachment`** owns the two moments that are easy to get wrong:

> **The clamp runs AFTER the element is in the document**, which is the first moment it has a size. A
> constructor clamp cannot possibly succeed: an element not in the DOM reports `offsetWidth` 0, every
> position fits inside a width of zero, and the clamp is a no op BY CONSTRUCTION. Measured on a 412px
> phone, the bar still opened across the sidebar, because opening is not dragging.

> **Held modifiers are released BEFORE the bar vanishes**, or Foundry is left believing shift is down
> with no visible way for the user to clear it: the bar that would have shown it is gone.

Production files over 200 lines: **five this morning, two now**.
