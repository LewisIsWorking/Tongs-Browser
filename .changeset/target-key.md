---
'tongs-browser': minor
---

Add a target key to the modifier bar. Foundry binds targeting to `T`, so without a keyboard there
was no way to target a token at all, and most systems resolve an attack against a target: the bar
carried Ctrl, Shift, Alt, Space, Delete, Escape, Enter and Tab, and the one key that decides who an
attack is against was the one a phone could not reach.

Measured from Foundry 14.366's own source rather than assumed. `#onTarget` acts on
`canvas.activeLayer.hover`, which the virtual pointer already sets, so a synthesised key is enough;
it toggles, so tapping a targeted token clears it; and `releaseOthers: !context.isShift` means a
latched Shift turns it into "add to my targets", which the sticky bar provides for free.
