---
'tongs-browser': patch
---

Add the decision layer for character sheet creation: who may create, where, and for whom.

Pure and separate from anything that touches Foundry, so the rules can be tested without standing up
a world. `PartyAccess` will do the reaching; this is a function of its arguments.

A GM may create in any party they can see. A player may create only where the per-party flag is on,
and ownership of a party deliberately does not substitute for it, so "may edit this party" and "may
add characters to it" stay separate questions.

A player may assign only to themselves. That is measured rather than chosen: Foundry silently deletes
an ownership entry naming anyone else when a document is created, so offering other users would look
like it worked and hand the sheet to nobody.

"No parties exist" and "you are not allowed" are kept distinct, because the first invites making a
party and the second tells a player to ask their GM.
