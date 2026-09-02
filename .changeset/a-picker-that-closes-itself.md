---
'tongs-browser': patch
---

Add the picker the create button will put on screen, and a notice for when there is nothing to pick.

It closes itself before running the callback rather than leaving that to the caller. #304 showed why:
when closing is the caller's job it is the half that gets lost, and a picker sitting on top of what it
just opened reads as the tap having done nothing, with nothing thrown.

Rows carry an id separate from their label, so a picker of parties cannot act on a name two parties
share, and the container carries the gesture-layer opt out without which the rows look perfect and are
untappable.
