---
'tongs-browser': patch
---

Record what Foundry 14.366 actually enforces about ownership, read from its own server code.

`sanitizeDocumentOwnershipField` allows a non-GM to own what they create, refuses any entry naming a
different user, and the two refusals differ: an update throws, while a CREATE silently deletes the
offending entry and proceeds.

That silent path is the feature's central operation failing in the one way nothing reports. A
player-side create assigning a sheet to somebody else would look like it worked every time, and
surface days later as "why can't I open my character".
