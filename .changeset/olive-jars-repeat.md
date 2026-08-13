---
'tongs-browser': patch
---

Remember whether the modifier bar was left collapsed.

`ModifierBar` has fired `onCollapsedChanged` since it was written, and a test has asserted exactly
that all along. The matching option was declared on `TongsBrowserOptions`, correctly typed, and
forwarded by nobody: `BuildModifierBar` passed the position pair and omitted the collapsed pair. So
the bar announced every collapse to no one, and the state was discarded on every reload.

Every part correct, every part covered, and the seam between them empty. It stayed invisible for as
long as the bar opened expanded, and became a complaint within an hour of it opening collapsed.

The state now persists to a client setting, so expanding the bar survives a reload. The setting's
default is imported from `BarDefaults` rather than repeated, because a default that disagrees between
the register call and the read path is the classic settings bug.
