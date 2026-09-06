---
'tongs-browser': patch
---

Prove who sent a create request, closing the one known hole in player sheet creation. `userId` used
to be a claim: core Foundry rebroadcasts a socket payload without a verified sender, so a player
could name another player's id and have the sheet created owned by them.

The requester now writes the request id onto their own User document as a flag before emitting, and
the GM serves only if the user the payload names is carrying that id. Foundry's server refuses a
player writing a flag to anyone but themselves, so the flag is evidence of authorship. Measured from
14.366's own source, so this needs no socketlib dependency after all. A served claim is released, or
a replayed payload would buy a duplicate sheet.
