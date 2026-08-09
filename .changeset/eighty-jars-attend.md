---
'tongs-browser': patch
---

Add browser tests against real Chromium, covering what jsdom structurally cannot.

jsdom has no layout engine, so it cannot answer the questions carrying the most risk in this
module: whether the cursor overlay stays out of its own hit tests, whether hover resolves the
element the cursor is visually over, and whether either survives a CSS transform. Those are checked
against the built bundle in a real browser now, rather than being discovered on a tablet.

The suite empirically confirms the decision recorded in ADR 0003: clicks land on the correct
element at 100, 75 and 50 percent interface scale with no coordinate conversion applied. It also
confirms that the event view is set in a real browser, which the jsdom tests could not exercise at
all.
