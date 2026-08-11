---
'tongs-browser': patch
---

Keep the modifier bar clear of Foundry's sidebar.

Reported from a real phone: the sidebar could not be reached. Measured on a 412px viewport, the bar
at its default position covered the sidebar's icon column, which on a phone is the only route to
chat, actors and everything else. Foundry auto collapses the sidebar at that width, so all that
remains is a narrow strip of icons, and the bar sat on top of it.

Two halves, and only both together work. The bar now clamps its position against the room the
sidebar leaves rather than against the whole window, and it caps its own width: the bar is
`position: fixed` with only `left` set, so it is shrink to fit against the remaining space and its
right edge stays pinned to the viewport edge wherever it is placed. Clamping x from 88 to 65 made it
wider, 324 to 347, and moved the right edge not at all.

It also now re-clamps after it is attached and on resize. The clamp added in 0.2.3 ran only in the
constructor, before the element was in the document, where `offsetWidth` is 0 and every position fits
inside a width of zero, so it had never once run against a real size.
