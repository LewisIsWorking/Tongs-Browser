---
'tongs-browser': minor
---

Add a GM-only party access picker to the tray. A new `C🔓` button lists every party the GM can see
with its current state in the label, and tapping one opens or closes it to player character
creation. The result is announced, because changing a permission moves nothing on screen and silence
is indistinguishable from a tap that missed.

The button has its own gate rather than sharing the create button's: deciding which parties are open
stays a GM's alone even once players can create in them.
