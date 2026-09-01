---
'tongs-browser': patch
---

Add `PartyAccess`, the one module allowed to list Foundry documents.

It reads parties and users and filters in the same breath, which is the obligation that comes with
being the boundary `check:documents` enforces. A party is kept only when the viewer has at least
LIMITED on it, which is the level at which Foundry considers a name fit to show.

It fails closed: an actor that cannot answer whether it may be seen is excluded. Foundry would not
normally send such a document, which is exactly why the permissive version would pass every test
anybody thought to run by hand.

Users are deliberately not permission filtered, and that is asserted so nobody removes it: Foundry
shows every player's name in its own interface, and who may be OFFERED is decided by
`assignableUsers`.
