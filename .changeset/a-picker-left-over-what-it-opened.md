---
'tongs-browser': patch
---

Test tapping a row in the sidebar picker.

The row handler does two things and only one is visible where the menu is built: it closes the picker
and then pops the tab out. Losing the close leaves our own menu sitting on top of the thing it was
asked to open, on a screen where the picker covers most of the width. Nothing throws, the tab really
does open underneath, and the tap looks like it did nothing.

That picker exists because Foundry's own tab strip is unusable at phone width, so these rows are the
only route to chat, actors and the rest.

Mutation checked: dropping the close, the pop-out, or the underlying call each fails a distinct test.

`FoundryActions` reaches 100% of functions; project coverage to 98.19 statements and 98.52 functions.
