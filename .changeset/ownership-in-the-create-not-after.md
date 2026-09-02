---
'tongs-browser': patch
---

Add sheet creation: create the actor already owned, then put it in the party.

Ownership is set in the CREATE rather than by a follow-up update, which is a measured decision.
Foundry treats the two paths differently: an update naming another user throws, while a create
silently deletes the entry and proceeds. Creating it already owned also means there is never a moment
where the sheet belongs to nobody, which on a phone would read as the button having failed.

A failed party join is a THIRD outcome rather than a failure. The sheet exists and is owned correctly;
only the membership write failed. Calling that a failure invites a second attempt and a duplicate,
when the action a user needs is to put it in the party.

Ownership names only the intended owner and never `default`, which would widen what every other user
in the world can see of that sheet.
