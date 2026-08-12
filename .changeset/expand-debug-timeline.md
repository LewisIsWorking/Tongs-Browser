---
'tongs-browser': patch
---

Record a timeline of causes as well as effects in the diagnostics report.

Four device round trips were spent on a drag failure that a user diagnosed themselves by
experiment: dragging works with the grab button off and breaks with it on. The report could not
have said that, because nothing in it recorded that a button had been pressed at all. Every line
described the end state of a gesture and none described what the user did to start it.

The report now carries a timeline interleaving tray button presses, gestures, synthesised
dispatches and Foundry's own callbacks, with the gap before each entry. A cancel two milliseconds
after a tap and a cancel five hundred milliseconds after one are a dispatch bug and Foundry's long
press timeout respectively, and nothing in the previous report could tell them apart.

Also: the drag cancel call site now names three frames rather than one, filtered by bundle URL
rather than by source file names that do not survive bundling, and a permission check that cannot
be asked reports the reason instead of the bare word `unaskable`.
