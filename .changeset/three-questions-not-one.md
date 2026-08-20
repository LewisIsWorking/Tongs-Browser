---
'tongs-browser': patch
---

`ExclusionZones` answers three questions about an element, and only one of them had tests.

`isExcluded` says "not ours to touch". `isOwnInterface` says "this is our own furniture".
`needsNativePointerEvents` says "ours, and it still needs the browser's real events". They are not
opposites and they do not nest in the obvious way: chat is excluded and is not ours, the bar is ours
and is also excluded, and the drag handle is all three.

Treating any two as one has produced a real bug each time, and both edges of the narrowest one
shipped. Suppression over our own bar is what makes tapping DROP work at all, because a finger's
`pointerup` reaching PIXI ends in `#handleDragCancel` and throws away a held drag. But the suppressor
stops events at the window, so "PIXI must not see it" became "nobody sees it" and the bar's own drag
handle stopped receiving the `pointerdown` it is built on, reported as "I can't move the tongs toolbox
now".

So the carve-out has to be exactly the handle: any wider and DROP breaks, any narrower and the bar
cannot be moved. Both directions now fail a test, along with collapsing "ours" into "excluded".

`ExclusionZones.ts` 78.6% to 92.9% statements and 100% branches; the project reaches 95.5%.
