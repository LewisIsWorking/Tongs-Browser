---
'tongs-browser': patch
---

Fix dragging failing whenever the pointer crosses any other element.

Reported from a device and finally named by the diagnostics report: `pointermove buttons=1 -> div#`,
where it needed to reach `canvas#board`. Every drag event was hit tested afresh, so the instant the
pointer crossed anything at all, a chat window, the modifier bar, a character sheet, the drag was
delivered **there** and the canvas simply stopped hearing about it. The token stopped following and
nothing reported an error.

A browser does not work that way: `pointerdown` implicitly **captures** the pointer to the element
that received it, and every later move and the release go to that same element however far the
pointer travels. The pointer now does the same.

⚠️ It never appeared on desktop because a drag across empty canvas never crosses anything, and the
existing test asserted the wrong behaviour outright, being named "resolves the target afresh on each
drag step rather than caching it". The reasoning behind that was sound and is preserved: Foundry
re-renders applications mid interaction, so a captured element can be detached and dispatching at a
detached element throws the event away silently. The mistake was treating "it might be detached" as a
reason to re-resolve always rather than only when it actually is.
